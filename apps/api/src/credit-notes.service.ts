import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { AccountingService } from './accounting.service';
import { IdempotencyService } from './idempotency.service';

type ReturnLine={invoiceLineId:string;quantity:string};
type Input={companyId:string;invoiceId:string;warehouseId:string;creditDate:Date;currencyCode:string;exchangeRate:string;postedById:string;reason:string;lines:ReturnLine[]};

@Injectable()
export class CreditNotesService {
  constructor(private readonly prisma:PrismaService,private readonly accounting:AccountingService,private readonly idempotency:IdempotencyService){}

  createAndPost(input:Input,idempotencyKey?:string){
    return this.prisma.$transaction(async tx=>{
      const claim=await this.idempotency.reserve(tx,input.companyId,'POST:/credit-notes',idempotencyKey,input);
      if(claim?.replay!==undefined)return claim.replay;
      if(!input.lines.length)throw new BadRequestException('Credit note requires at least one line');
      if(new Set(input.lines.map(l=>l.invoiceLineId)).size!==input.lines.length)throw new BadRequestException('Duplicate invoice return lines are not allowed');
      await tx.$queryRaw`SELECT id FROM "SalesInvoice" WHERE id=${input.invoiceId}::uuid FOR UPDATE`;
      const invoice=await tx.salesInvoice.findFirst({where:{id:input.invoiceId,companyId:input.companyId,status:'Posted'},include:{customer:true,lines:{include:{item:true,taxRate:true}}}});
      if(!invoice)throw new NotFoundException('Posted sales invoice not found');
      const warehouse=await tx.warehouse.findFirst({where:{id:input.warehouseId,companyId:input.companyId,isActive:true}});if(!warehouse)throw new BadRequestException('Invalid warehouse');
      const company=await tx.company.findUnique({where:{id:input.companyId}});if(!company)throw new NotFoundException('Company not found');
      const period=await tx.fiscalPeriod.findFirst({where:{fiscalYear:{companyId:input.companyId},startDate:{lte:input.creditDate},endDate:{gte:input.creditDate}}});if(!period||period.status==='Hard_Closed')throw new BadRequestException('No postable fiscal period for credit note date');
      const ar=await tx.account.findFirst({where:{companyId:input.companyId,code:'1120',isLeaf:true,isActive:true}});if(!ar)throw new BadRequestException('Accounts receivable account is not configured');
      const lineMap=new Map(invoice.lines.map(l=>[l.id,l]));
      const creditNoteId=randomUUID();const number=await this.nextNumber(tx,input.companyId,'CREDIT_NOTE','CN-',period.fiscalYearId,'MAIN');const journalNumber=await this.nextNumber(tx,input.companyId,'JOURNAL','JV-',period.fiscalYearId,'MAIN');
      let subtotal=new Prisma.Decimal(0),taxTotal=new Prisma.Decimal(0),returnCost=new Prisma.Decimal(0);
      const journalLines:Array<{accountId:string;debit?:string;credit?:string;customerId?:string;description?:string}>=[];
      const rawLines:Array<{id:string;lineId:string;itemId:string;qty:Prisma.Decimal;unitPrice:Prisma.Decimal;taxRate:Prisma.Decimal;taxAmount:Prisma.Decimal;lineTotal:Prisma.Decimal}>=[];
      for(const requested of input.lines){
        const line=lineMap.get(requested.invoiceLineId);if(!line)throw new BadRequestException('Return line does not belong to invoice');
        const qty=new Prisma.Decimal(requested.quantity);if(qty.lte(0))throw new BadRequestException('Return quantity must be positive');
        const returnedRows=await tx.$queryRaw<Array<{quantity:Prisma.Decimal}>>`SELECT COALESCE(SUM(cl.quantity),0) quantity FROM "CreditNoteLine" cl JOIN "CreditNote" c ON c.id=cl."creditNoteId" WHERE cl."invoiceLineId"=${line.id}::uuid AND c.status='Posted'`;
        const alreadyReturned=new Prisma.Decimal(returnedRows[0]?.quantity??0);if(qty.gt(line.quantity.sub(alreadyReturned)))throw new BadRequestException('Return quantity exceeds original invoice quantity');
        const net=qty.mul(line.unitPrice).toDecimalPlaces(4);const taxAmount=net.mul(line.taxRateSnapshot).toDecimalPlaces(4);const total=net.add(taxAmount);subtotal=subtotal.add(net);taxTotal=taxTotal.add(taxAmount);
        const creditLineId=randomUUID();rawLines.push({id:creditLineId,lineId:line.id,itemId:line.itemId,qty,unitPrice:line.unitPrice,taxRate:line.taxRateSnapshot,taxAmount,lineTotal:total});
        journalLines.push({accountId:line.item.revenueAccountId,debit:net.toString(),customerId:invoice.customerId,description:`Credit note ${number}`});
        if(taxAmount.gt(0)){if(!line.taxRate)throw new BadRequestException('Original tax rate configuration is missing');journalLines.push({accountId:line.taxRate.salesTaxAccountId,debit:taxAmount.toString(),customerId:invoice.customerId,description:`Tax reversal ${number}`})}
        if(line.item.type==='Inventory'){
          if(!line.item.inventoryAccountId||!line.item.cogsAccountId)throw new BadRequestException('Inventory accounts are missing');
          const movements=await tx.inventoryMovement.findMany({where:{companyId:input.companyId,itemId:line.itemId,warehouseId:input.warehouseId,referenceType:'SalesInvoice',referenceId:invoice.id},include:{allocations:true},orderBy:{movementDate:'asc'}});
          const allocations=movements.flatMap(m=>m.allocations);
          let remaining=qty;let cost=new Prisma.Decimal(0);
          for(const allocation of allocations){if(remaining.lte(0))break;const usedRows=await tx.$queryRaw<Array<{quantity:Prisma.Decimal}>>`SELECT COALESCE(SUM(quantity),0) quantity FROM "CreditNoteReturnAllocation" WHERE "inventoryAllocationId"=${allocation.id}::uuid`;const used=new Prisma.Decimal(usedRows[0]?.quantity??0);const available=allocation.quantity.sub(used);if(available.lte(0))continue;const take=Prisma.Decimal.min(remaining,available);const allocationCost=take.mul(allocation.unitCost).toDecimalPlaces(4);await tx.inventoryLot.update({where:{id:allocation.lotId},data:{remainingQuantity:{increment:take}}});await tx.$executeRaw`INSERT INTO "CreditNoteReturnAllocation" (id,"creditNoteLineId","inventoryAllocationId","lotId",quantity,"unitCost","totalCost") VALUES (${randomUUID()}::uuid,${creditLineId}::uuid,${allocation.id}::uuid,${allocation.lotId}::uuid,${take},${allocation.unitCost},${allocationCost})`;cost=cost.add(allocationCost);remaining=remaining.sub(take)}
          if(remaining.gt(0))throw new BadRequestException('Could not trace original FIFO cost for the full return quantity');
          await tx.inventoryMovement.create({data:{companyId:input.companyId,itemId:line.itemId,warehouseId:input.warehouseId,quantity:qty,unitCost:cost.div(qty).toDecimalPlaces(4),totalCost:cost,movementDate:input.creditDate,referenceType:'CreditNote',referenceId:creditNoteId}});
          returnCost=returnCost.add(cost);journalLines.push({accountId:line.item.inventoryAccountId,debit:cost.toString(),description:`Inventory return ${number}`},{accountId:line.item.cogsAccountId,credit:cost.toString(),description:`COGS reversal ${number}`});
        }
      }
      const grand=subtotal.add(taxTotal);journalLines.push({accountId:ar.id,credit:grand.toString(),customerId:invoice.customerId,description:`Credit note ${number}`});
      await tx.$executeRaw`INSERT INTO "CreditNote" (id,"companyId","creditNoteNumber","customerId","invoiceId",status,"creditDate",subtotal,"taxTotal","grandTotal",reason) VALUES (${creditNoteId}::uuid,${input.companyId}::uuid,${number},${invoice.customerId}::uuid,${invoice.id}::uuid,'Draft',${input.creditDate},${subtotal},${taxTotal},${grand},${input.reason})`;
      for(const line of rawLines){await tx.$executeRaw`INSERT INTO "CreditNoteLine" (id,"creditNoteId","invoiceLineId","itemId",quantity,"unitPrice","taxRateSnapshot","taxAmount","lineTotal") VALUES (${line.id}::uuid,${creditNoteId}::uuid,${line.lineId}::uuid,${line.itemId}::uuid,${line.qty},${line.unitPrice},${line.taxRate},${line.taxAmount},${line.lineTotal})`}
      const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber,sourceType:JournalSourceType.CreditNote,sourceId:creditNoteId,transactionDate:input.creditDate,currencyCode:input.currencyCode||company.baseCurrencyCode,exchangeRate:input.exchangeRate||'1',postedById:input.postedById,lines:journalLines});
      await tx.$executeRaw`UPDATE "CreditNote" SET status='Posted' WHERE id=${creditNoteId}::uuid`;
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'CreditNote',aggregateId:creditNoteId,eventType:'CreditNotePosted',payload:{creditNoteId,invoiceId:invoice.id,journalId:journal.id,total:grand.toString(),returnCost:returnCost.toString()}}});
      await tx.auditLog.create({data:{companyId:input.companyId,userId:input.postedById,action:'POST',entityType:'CreditNote',entityId:creditNoteId,afterPayload:{creditNoteNumber:number,invoiceId:invoice.id,total:grand.toString(),reason:input.reason}}});
      const result={id:creditNoteId,creditNoteNumber:number,invoiceId:invoice.id,grandTotal:grand.toString(),journalId:journal.id,returnCost:returnCost.toString()};await this.idempotency.complete(tx,claim,201,result);return result;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async nextNumber(tx:Prisma.TransactionClient,companyId:string,documentType:string,prefix:string,fiscalYearId:string,branchCode:string){let seq=await tx.documentSequence.findUnique({where:{companyId_fiscalYearId_branchCode_documentType:{companyId,fiscalYearId,branchCode,documentType}}});if(!seq)seq=await tx.documentSequence.create({data:{companyId,fiscalYearId,branchCode,documentType,prefix,padding:6}});await tx.$queryRaw`SELECT id FROM "DocumentSequence" WHERE id=${seq.id}::uuid FOR UPDATE`;seq=await tx.documentSequence.update({where:{id:seq.id},data:{currentNumber:{increment:1}}});return `${seq.prefix}${seq.currentNumber.toString().padStart(seq.padding,'0')}`}
}
