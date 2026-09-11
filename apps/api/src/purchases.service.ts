import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, JournalSourceType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AccountingService } from './accounting.service';
import { IdempotencyService } from './idempotency.service';

type PurchaseLineInput = { itemId:string; quantity:string; unitCost:string; taxRateId?:string };
type PurchaseInput = { companyId:string; supplierId:string; warehouseId:string; billDate:Date; currencyCode:string; exchangeRate:string; postedById?:string; lines:PurchaseLineInput[] };

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma:PrismaService, private readonly accounting:AccountingService, private readonly idempotency:IdempotencyService){}

  async createAndPost(input:PurchaseInput,idempotencyKey?:string){
    return this.prisma.$transaction(async tx=>{
      const claim=await this.idempotency.reserve(tx,input.companyId,'POST:/purchases/bill',idempotencyKey,input);
      if(claim?.replay!==undefined) return claim.replay;
      if(!input.lines.length) throw new BadRequestException('Purchase bill requires lines');
      if(new Set(input.lines.map(l=>l.itemId)).size!==input.lines.length) throw new BadRequestException('Duplicate item lines are not allowed');
      const supplier=await tx.supplier.findUnique({where:{id:input.supplierId}});
      if(!supplier||supplier.companyId!==input.companyId||!supplier.isActive) throw new BadRequestException('Invalid supplier');
      const warehouse=await tx.warehouse.findUnique({where:{id:input.warehouseId}});
      if(!warehouse||warehouse.companyId!==input.companyId||!warehouse.isActive) throw new BadRequestException('Invalid warehouse');
      const company=await tx.company.findUnique({where:{id:input.companyId}}); if(!company) throw new NotFoundException('Company not found');
      const period=await tx.fiscalPeriod.findFirst({where:{fiscalYear:{companyId:input.companyId},startDate:{lte:input.billDate},endDate:{gte:input.billDate}}});
      if(!period||period.status==='Hard_Closed') throw new BadRequestException('No postable fiscal period for bill date');
      const ap=await tx.account.findFirst({where:{companyId:input.companyId,code:'2110',isLeaf:true,isActive:true}}); if(!ap) throw new BadRequestException('Accounts payable account is not configured');
      const itemIds=[...new Set(input.lines.map(l=>l.itemId))];
      const items=await tx.item.findMany({where:{companyId:input.companyId,id:{in:itemIds},isActive:true}});
      if(items.length!==itemIds.length) throw new BadRequestException('Invalid item');
      const itemMap=new Map(items.map(i=>[i.id,i]));
      const taxIds=[...new Set(input.lines.map(l=>l.taxRateId).filter(Boolean) as string[])];
      const taxes=taxIds.length?await tx.taxRate.findMany({where:{companyId:input.companyId,id:{in:taxIds}}}):[];
      const taxMap=new Map(taxes.map(t=>[t.id,t]));
      const billNumber=await this.nextNumber(tx,input.companyId,'PURCHASE_BILL','PUR-',period.fiscalYearId,'MAIN');
      const journalNumber=await this.nextNumber(tx,input.companyId,'JOURNAL','JV-',period.fiscalYearId,'MAIN');
      let subtotal=new Prisma.Decimal(0),taxTotal=new Prisma.Decimal(0);
      const prepared=[] as Array<{itemId:string;quantity:Prisma.Decimal;unitCost:Prisma.Decimal;taxRateId?:string;taxRateSnapshot:Prisma.Decimal;taxAmount:Prisma.Decimal;lineTotal:Prisma.Decimal}>;
      const journalLines:Array<{accountId:string;debit?:string;credit?:string;supplierId?:string;description?:string}>=[];
      const lots:Array<{itemId:string;quantity:Prisma.Decimal;unitCost:Prisma.Decimal}>=[];
      for(const raw of input.lines){
        const item=itemMap.get(raw.itemId)!; const qty=new Prisma.Decimal(raw.quantity); const cost=new Prisma.Decimal(raw.unitCost);
        if(qty.lte(0)||cost.lt(0)) throw new BadRequestException('Invalid quantity or cost');
        const tax=raw.taxRateId?taxMap.get(raw.taxRateId):undefined; if(raw.taxRateId&&!tax) throw new BadRequestException('Invalid tax rate');
        if(tax&&(tax.effectiveFrom>input.billDate||(tax.effectiveTo&&tax.effectiveTo<input.billDate))) throw new BadRequestException('Tax rate is not effective on bill date');
        const net=qty.mul(cost).toDecimalPlaces(4); const rate=tax?.rate??new Prisma.Decimal(0); const taxAmount=net.mul(rate).toDecimalPlaces(4); const total=net.add(taxAmount);
        subtotal=subtotal.add(net); taxTotal=taxTotal.add(taxAmount);
        prepared.push({itemId:item.id,quantity:qty,unitCost:cost,taxRateId:tax?.id,taxRateSnapshot:rate,taxAmount,lineTotal:total});
        if(item.type==='Inventory'){
          if(!item.inventoryAccountId) throw new BadRequestException(`Inventory account missing for ${item.code}`);
          journalLines.push({accountId:item.inventoryAccountId,debit:net.toString(),supplierId:input.supplierId,description:`Inventory ${billNumber}`});
          lots.push({itemId:item.id,quantity:qty,unitCost:cost});
        }else{
          if(!item.cogsAccountId) throw new BadRequestException(`Expense account missing for service item ${item.code}`);
          journalLines.push({accountId:item.cogsAccountId,debit:net.toString(),supplierId:input.supplierId,description:`Service purchase ${billNumber}`});
        }
        if(taxAmount.gt(0)&&tax) journalLines.push({accountId:tax.purchaseTaxAccountId,debit:taxAmount.toString(),supplierId:input.supplierId,description:`Input tax ${billNumber}`});
      }
      const grand=subtotal.add(taxTotal); journalLines.push({accountId:ap.id,credit:grand.toString(),supplierId:input.supplierId,description:`Purchase bill ${billNumber}`});
      const bill=await tx.purchaseBill.create({data:{companyId:input.companyId,billNumber,supplierId:input.supplierId,status:DocumentStatus.Draft,billDate:input.billDate,subtotal,taxTotal,grandTotal:grand,lines:{create:prepared}},include:{lines:true,supplier:true}});
      for(const lot of lots){const created=await tx.inventoryLot.create({data:{companyId:input.companyId,itemId:lot.itemId,warehouseId:input.warehouseId,receivedDate:input.billDate,unitCost:lot.unitCost,initialQuantity:lot.quantity,remainingQuantity:lot.quantity}});await tx.inventoryMovement.create({data:{companyId:input.companyId,itemId:lot.itemId,warehouseId:input.warehouseId,lotId:created.id,quantity:lot.quantity,unitCost:lot.unitCost,totalCost:lot.quantity.mul(lot.unitCost).toDecimalPlaces(4),movementDate:input.billDate,referenceType:'PurchaseBill',referenceId:bill.id}})}
      const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber,sourceType:JournalSourceType.PurchaseBill,sourceId:bill.id,transactionDate:input.billDate,currencyCode:input.currencyCode||company.baseCurrencyCode,exchangeRate:input.exchangeRate||'1',postedById:input.postedById,lines:journalLines});
      const postedBill=await tx.purchaseBill.update({where:{id:bill.id},data:{status:DocumentStatus.Posted},include:{lines:true,supplier:true}});
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'PurchaseBill',aggregateId:bill.id,eventType:'PurchaseBillPosted',payload:{billId:bill.id,journalId:journal.id,total:grand.toString()}}});
      const result={bill:postedBill,journalId:journal.id};
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
