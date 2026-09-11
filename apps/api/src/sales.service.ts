import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, JournalSourceType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AccountingService } from './accounting.service';
import { IdempotencyService } from './idempotency.service';
import { PostingConfigService } from './posting-config.service';

type SalesLineInput = { itemId:string; quantity:string; unitPrice:string; taxRateId?:string };
type SalesInput = { companyId:string; customerId:string; warehouseId:string; invoiceDate:Date; currencyCode:string; exchangeRate:string; postedById?:string; lines:SalesLineInput[] };

@Injectable()
export class SalesService {
  constructor(private readonly prisma:PrismaService, private readonly accounting:AccountingService, private readonly idempotency:IdempotencyService, private readonly postingConfig:PostingConfigService){}

  async createAndPost(input:SalesInput,idempotencyKey?:string){
    return this.prisma.$transaction(async tx=>{
      const claim=await this.idempotency.reserve(tx,input.companyId,'POST:/sales/invoice',idempotencyKey,input);
      if(claim?.replay!==undefined) return claim.replay;
      if(!input.lines.length) throw new BadRequestException('Invoice requires lines');
      if(new Set(input.lines.map(l=>l.itemId)).size!==input.lines.length) throw new BadRequestException('Duplicate item lines are not allowed');
      const customer=await tx.customer.findUnique({where:{id:input.customerId}});
      if(!customer||customer.companyId!==input.companyId||!customer.isActive) throw new BadRequestException('Invalid customer');
      const warehouse=await tx.warehouse.findUnique({where:{id:input.warehouseId}});
      if(!warehouse||warehouse.companyId!==input.companyId||!warehouse.isActive) throw new BadRequestException('Invalid warehouse');
      const period=await tx.fiscalPeriod.findFirst({where:{fiscalYear:{companyId:input.companyId,status:{not:'Closed'}},startDate:{lte:input.invoiceDate},endDate:{gte:input.invoiceDate}}});
      if(!period||period.status==='Hard_Closed') throw new BadRequestException('No postable fiscal period for invoice date');
      const company=await tx.company.findUnique({where:{id:input.companyId}}); if(!company) throw new NotFoundException('Company not found');
      const currencyCode=input.currencyCode||company.baseCurrencyCode;const currency=await tx.currency.findUnique({where:{code:currencyCode}});if(!currency)throw new BadRequestException('Unsupported currency');
      const fxRate=new Prisma.Decimal(input.exchangeRate||'1');if(fxRate.lte(0))throw new BadRequestException('Exchange rate must be positive');if(currencyCode===company.baseCurrencyCode&&!fxRate.eq(1))throw new BadRequestException('Base currency exchange rate must be 1');
      const config=await this.postingConfig.get(tx,input.companyId);
      const itemIds=[...new Set(input.lines.map(l=>l.itemId))];
      const items=await tx.item.findMany({where:{companyId:input.companyId,id:{in:itemIds},isActive:true}});
      if(items.length!==itemIds.length) throw new BadRequestException('Invalid item');
      const itemMap=new Map(items.map(i=>[i.id,i]));
      const taxIds=[...new Set(input.lines.map(l=>l.taxRateId).filter(Boolean) as string[])];
      const taxes=taxIds.length?await tx.taxRate.findMany({where:{companyId:input.companyId,id:{in:taxIds}}}):[];
      const taxMap=new Map(taxes.map(t=>[t.id,t]));
      const invoiceNumber=await this.nextNumber(tx,input.companyId,'SALES_INVOICE','INV-',period.fiscalYearId,'MAIN');
      const journalNumber=await this.nextNumber(tx,input.companyId,'JOURNAL','JV-',period.fiscalYearId,'MAIN');
      let subtotal=new Prisma.Decimal(0),taxTotal=new Prisma.Decimal(0),cogsTotal=new Prisma.Decimal(0);
      const prepared=[] as Array<{itemId:string;quantity:Prisma.Decimal;unitPrice:Prisma.Decimal;taxRateId?:string;taxRateSnapshot:Prisma.Decimal;taxAmount:Prisma.Decimal;lineTotal:Prisma.Decimal}>;
      const journalLines:Array<{accountId:string;debit?:string;credit?:string;customerId?:string;description?:string}>=[];
      const inventoryOps:Array<{itemId:string;quantity:Prisma.Decimal;allocs:Array<{lotId:string;quantity:Prisma.Decimal;unitCost:Prisma.Decimal;totalCost:Prisma.Decimal}>;totalCost:Prisma.Decimal}>=[];
      for(const raw of input.lines){
        const item=itemMap.get(raw.itemId)!; const qty=new Prisma.Decimal(raw.quantity); const price=new Prisma.Decimal(raw.unitPrice);
        if(qty.lte(0)||price.lt(0)) throw new BadRequestException('Invalid quantity or price');
        const tax=raw.taxRateId?taxMap.get(raw.taxRateId):undefined; if(raw.taxRateId&&!tax) throw new BadRequestException('Invalid tax rate');
        if(tax&&(tax.effectiveFrom>input.invoiceDate||(tax.effectiveTo&&tax.effectiveTo<input.invoiceDate))) throw new BadRequestException('Tax rate is not effective on invoice date');
        const net=qty.mul(price).toDecimalPlaces(4); const rate=tax?.rate??new Prisma.Decimal(0); const taxAmount=net.mul(rate).toDecimalPlaces(4); const total=net.add(taxAmount);
        subtotal=subtotal.add(net);taxTotal=taxTotal.add(taxAmount);
        prepared.push({itemId:item.id,quantity:qty,unitPrice:price,taxRateId:tax?.id,taxRateSnapshot:rate,taxAmount,lineTotal:total});
        journalLines.push({accountId:item.revenueAccountId,credit:net.toString(),customerId:input.customerId,description:`Sales ${invoiceNumber}`});
        if(taxAmount.gt(0)&&tax) journalLines.push({accountId:tax.salesTaxAccountId,credit:taxAmount.toString(),customerId:input.customerId,description:`Tax ${invoiceNumber}`});
        if(item.type==='Inventory'){
          if(!item.inventoryAccountId||!item.cogsAccountId) throw new BadRequestException(`Inventory accounts missing for ${item.code}`);
          const ids=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "InventoryLot" WHERE "companyId"=${input.companyId}::uuid AND "itemId"=${item.id}::uuid AND "warehouseId"=${input.warehouseId}::uuid AND "remainingQuantity">0 ORDER BY "receivedDate" ASC, id ASC FOR UPDATE`;
          const lots=await tx.inventoryLot.findMany({where:{id:{in:ids.map(x=>x.id)}},orderBy:[{receivedDate:'asc'},{id:'asc'}]});
          let remaining=qty; const allocs:Array<{lotId:string;quantity:Prisma.Decimal;unitCost:Prisma.Decimal;totalCost:Prisma.Decimal}>=[]; let lineCogs=new Prisma.Decimal(0);
          for(const lot of lots){if(remaining.lte(0))break;const take=Prisma.Decimal.min(remaining,lot.remainingQuantity);if(take.lte(0))continue;const cost=take.mul(lot.unitCost).toDecimalPlaces(4);await tx.inventoryLot.update({where:{id:lot.id},data:{remainingQuantity:{decrement:take}}});allocs.push({lotId:lot.id,quantity:take,unitCost:lot.unitCost,totalCost:cost});lineCogs=lineCogs.add(cost);remaining=remaining.sub(take)}
          if(remaining.gt(0)) throw new BadRequestException(`Insufficient stock for ${item.code}`);
          cogsTotal=cogsTotal.add(lineCogs); inventoryOps.push({itemId:item.id,quantity:qty,allocs,totalCost:lineCogs});
          const transactionCogs=lineCogs.div(fxRate).toDecimalPlaces(4);
          journalLines.push({accountId:item.cogsAccountId,debit:transactionCogs.toString(),description:`COGS ${invoiceNumber}`},{accountId:item.inventoryAccountId,credit:transactionCogs.toString(),description:`Inventory ${invoiceNumber}`});
        }
      }
      const grand=subtotal.add(taxTotal); journalLines.unshift({accountId:config.receivableAccountId,debit:grand.toString(),customerId:input.customerId,description:`Invoice ${invoiceNumber}`});
      const invoice=await tx.salesInvoice.create({data:{companyId:input.companyId,invoiceNumber,customerId:input.customerId,status:DocumentStatus.Draft,invoiceDate:input.invoiceDate,subtotal,taxTotal,grandTotal:grand,lines:{create:prepared}},include:{lines:true,customer:true}});
      for(const op of inventoryOps){const movement=await tx.inventoryMovement.create({data:{companyId:input.companyId,itemId:op.itemId,warehouseId:input.warehouseId,quantity:op.quantity.neg(),unitCost:op.quantity.eq(0)?0:op.totalCost.div(op.quantity),totalCost:op.totalCost.neg(),movementDate:input.invoiceDate,referenceType:'SalesInvoice',referenceId:invoice.id}});for(const a of op.allocs)await tx.inventoryAllocation.create({data:{movementId:movement.id,lotId:a.lotId,quantity:a.quantity,unitCost:a.unitCost,totalCost:a.totalCost}})}
      const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber,sourceType:JournalSourceType.SalesInvoice,sourceId:invoice.id,transactionDate:input.invoiceDate,currencyCode,exchangeRate:fxRate,postedById:input.postedById,lines:journalLines});
      const postedInvoice=await tx.salesInvoice.update({where:{id:invoice.id},data:{status:DocumentStatus.Posted},include:{lines:true,customer:true}});
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'SalesInvoice',aggregateId:invoice.id,eventType:'SalesInvoicePosted',payload:{invoiceId:invoice.id,journalId:journal.id,total:grand.toString(),currencyCode,exchangeRate:fxRate.toString()}}});
      await tx.auditLog.create({data:{companyId:input.companyId,userId:input.postedById,action:'POST',entityType:'SalesInvoice',entityId:invoice.id,afterPayload:{invoiceNumber,total:grand.toString(),currencyCode,exchangeRate:fxRate.toString(),journalId:journal.id}}});
      const result={invoice:postedInvoice,journalId:journal.id,cogs:cogsTotal.toString(),currencyCode,exchangeRate:fxRate.toString()};
      await this.idempotency.complete(tx,claim,201,result);
      return result;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async nextNumber(tx:Prisma.TransactionClient,companyId:string,documentType:string,fallbackPrefix:string,fiscalYearId:string,branchCode:string){
    let seq=await tx.documentSequence.findUnique({where:{companyId_fiscalYearId_branchCode_documentType:{companyId,fiscalYearId,branchCode,documentType}}});
    if(!seq) seq=await tx.documentSequence.create({data:{companyId,fiscalYearId,branchCode,documentType,prefix:fallbackPrefix,currentNumber:0n,padding:6}});
    await tx.$queryRaw`SELECT id FROM "DocumentSequence" WHERE id=${seq.id}::uuid FOR UPDATE`;
    seq=await tx.documentSequence.update({where:{id:seq.id},data:{currentNumber:{increment:1}}});
    return `${seq.prefix}${seq.currentNumber.toString().padStart(seq.padding,'0')}`;
  }
}
