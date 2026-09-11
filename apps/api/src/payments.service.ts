import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { AccountingService } from './accounting.service';
import { IdempotencyService } from './idempotency.service';

type CustomerAllocation={invoiceId:string;amount:string};
type SupplierAllocation={billId:string;amount:string};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma:PrismaService, private readonly accounting:AccountingService, private readonly idempotency:IdempotencyService){}

  customerReceipt(input:{companyId:string;customerId:string;amount:string;date:Date;currencyCode:string;exchangeRate:string;postedById?:string;cashAccountId?:string;reference?:string;allocations?:CustomerAllocation[]},idempotencyKey?:string){
    return this.prisma.$transaction(async tx=>{
      const claim=await this.idempotency.reserve(tx,input.companyId,'POST:/payments/customer-receipt',idempotencyKey,input);
      if(claim?.replay!==undefined) return claim.replay;
      const company=await tx.company.findUnique({where:{id:input.companyId}}); if(!company) throw new NotFoundException('Company not found');
      const customer=await tx.customer.findUnique({where:{id:input.customerId}}); if(!customer||customer.companyId!==input.companyId||!customer.isActive) throw new BadRequestException('Invalid customer');
      const period=await this.period(tx,input.companyId,input.date);
      const cash=input.cashAccountId?await tx.account.findFirst({where:{id:input.cashAccountId,companyId:input.companyId,isLeaf:true,isActive:true}}):await tx.account.findFirst({where:{companyId:input.companyId,code:'1110',isLeaf:true,isActive:true}});
      const ar=await tx.account.findFirst({where:{companyId:input.companyId,code:'1120',isLeaf:true,isActive:true}});
      if(!cash||!ar) throw new BadRequestException('Cash or receivable account is not configured');
      const amount=new Prisma.Decimal(input.amount); if(amount.lte(0)) throw new BadRequestException('Amount must be positive');
      await this.validateCustomerAllocations(tx,input.companyId,input.customerId,input.allocations??[],amount);
      const number=await this.nextNumber(tx,input.companyId,'JOURNAL','JV-',period.fiscalYearId,'MAIN');
      const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber:number,sourceType:JournalSourceType.CustomerPayment,sourceId:input.reference,transactionDate:input.date,currencyCode:input.currencyCode||company.baseCurrencyCode,exchangeRate:input.exchangeRate||'1',postedById:input.postedById,lines:[{accountId:cash.id,debit:amount,customerId:customer.id,description:'Customer receipt'},{accountId:ar.id,credit:amount,customerId:customer.id,description:'Customer receipt'}]});
      for(const allocation of input.allocations??[]){await tx.$executeRaw`INSERT INTO "PaymentAllocation" (id,"companyId","journalId","salesInvoiceId",amount) VALUES (${randomUUID()}::uuid,${input.companyId}::uuid,${journal.id}::uuid,${allocation.invoiceId}::uuid,${new Prisma.Decimal(allocation.amount)})`}
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'CustomerPayment',aggregateId:journal.id,eventType:'CustomerPaymentPosted',payload:{journalId:journal.id,customerId:customer.id,amount:amount.toString(),reference:input.reference}}});
      await tx.auditLog.create({data:{companyId:input.companyId,userId:input.postedById,action:'POST',entityType:'CustomerPayment',entityId:journal.id,afterPayload:{amount:amount.toString(),customerId:customer.id,reference:input.reference??null}}});
      await this.idempotency.complete(tx,claim,201,journal);
      return journal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  supplierPayment(input:{companyId:string;supplierId:string;amount:string;date:Date;currencyCode:string;exchangeRate:string;postedById?:string;cashAccountId?:string;reference?:string;allocations?:SupplierAllocation[]},idempotencyKey?:string){
    return this.prisma.$transaction(async tx=>{
      const claim=await this.idempotency.reserve(tx,input.companyId,'POST:/payments/supplier-payment',idempotencyKey,input);
      if(claim?.replay!==undefined) return claim.replay;
      const company=await tx.company.findUnique({where:{id:input.companyId}}); if(!company) throw new NotFoundException('Company not found');
      const supplier=await tx.supplier.findUnique({where:{id:input.supplierId}}); if(!supplier||supplier.companyId!==input.companyId||!supplier.isActive) throw new BadRequestException('Invalid supplier');
      const period=await this.period(tx,input.companyId,input.date);
      const cash=input.cashAccountId?await tx.account.findFirst({where:{id:input.cashAccountId,companyId:input.companyId,isLeaf:true,isActive:true}}):await tx.account.findFirst({where:{companyId:input.companyId,code:'1110',isLeaf:true,isActive:true}});
      const ap=await tx.account.findFirst({where:{companyId:input.companyId,code:'2110',isLeaf:true,isActive:true}});
      if(!cash||!ap) throw new BadRequestException('Cash or payable account is not configured');
      const amount=new Prisma.Decimal(input.amount); if(amount.lte(0)) throw new BadRequestException('Amount must be positive');
      await this.validateSupplierAllocations(tx,input.companyId,input.supplierId,input.allocations??[],amount);
      const number=await this.nextNumber(tx,input.companyId,'JOURNAL','JV-',period.fiscalYearId,'MAIN');
      const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber:number,sourceType:JournalSourceType.SupplierPayment,sourceId:input.reference,transactionDate:input.date,currencyCode:input.currencyCode||company.baseCurrencyCode,exchangeRate:input.exchangeRate||'1',postedById:input.postedById,lines:[{accountId:ap.id,debit:amount,supplierId:supplier.id,description:'Supplier payment'},{accountId:cash.id,credit:amount,supplierId:supplier.id,description:'Supplier payment'}]});
      for(const allocation of input.allocations??[]){await tx.$executeRaw`INSERT INTO "PaymentAllocation" (id,"companyId","journalId","purchaseBillId",amount) VALUES (${randomUUID()}::uuid,${input.companyId}::uuid,${journal.id}::uuid,${allocation.billId}::uuid,${new Prisma.Decimal(allocation.amount)})`}
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'SupplierPayment',aggregateId:journal.id,eventType:'SupplierPaymentPosted',payload:{journalId:journal.id,supplierId:supplier.id,amount:amount.toString(),reference:input.reference}}});
      await tx.auditLog.create({data:{companyId:input.companyId,userId:input.postedById,action:'POST',entityType:'SupplierPayment',entityId:journal.id,afterPayload:{amount:amount.toString(),supplierId:supplier.id,reference:input.reference??null}}});
      await this.idempotency.complete(tx,claim,201,journal);
      return journal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async validateCustomerAllocations(tx:Prisma.TransactionClient,companyId:string,customerId:string,allocations:CustomerAllocation[],payment:Prisma.Decimal){
    let sum=new Prisma.Decimal(0); const ids=new Set<string>();
    for(const a of allocations){if(ids.has(a.invoiceId))throw new BadRequestException('Duplicate invoice allocation');ids.add(a.invoiceId);const v=new Prisma.Decimal(a.amount);if(v.lte(0))throw new BadRequestException('Allocation amount must be positive');sum=sum.add(v);const invoice=await tx.salesInvoice.findFirst({where:{id:a.invoiceId,companyId,customerId,status:'Posted'}});if(!invoice)throw new BadRequestException('Invalid invoice allocation');const rows=await tx.$queryRaw<Array<{paid:Prisma.Decimal;credited:Prisma.Decimal}>>`SELECT COALESCE((SELECT SUM(pa.amount) FROM "PaymentAllocation" pa WHERE pa."salesInvoiceId"=${a.invoiceId}::uuid),0) paid, COALESCE((SELECT SUM(c."grandTotal") FROM "CreditNote" c WHERE c."invoiceId"=${a.invoiceId}::uuid AND c.status='Posted'),0) credited`;const paid=new Prisma.Decimal(rows[0]?.paid??0);const credited=new Prisma.Decimal(rows[0]?.credited??0);if(v.gt(invoice.grandTotal.sub(paid).sub(credited)))throw new BadRequestException('Invoice allocation exceeds outstanding balance')}
    if(sum.gt(payment))throw new BadRequestException('Allocations exceed payment amount');
  }

  private async validateSupplierAllocations(tx:Prisma.TransactionClient,companyId:string,supplierId:string,allocations:SupplierAllocation[],payment:Prisma.Decimal){
    let sum=new Prisma.Decimal(0); const ids=new Set<string>();
    for(const a of allocations){if(ids.has(a.billId))throw new BadRequestException('Duplicate bill allocation');ids.add(a.billId);const v=new Prisma.Decimal(a.amount);if(v.lte(0))throw new BadRequestException('Allocation amount must be positive');sum=sum.add(v);const bill=await tx.purchaseBill.findFirst({where:{id:a.billId,companyId,supplierId,status:'Posted'}});if(!bill)throw new BadRequestException('Invalid bill allocation');const rows=await tx.$queryRaw<Array<{paid:Prisma.Decimal}>>`SELECT COALESCE(SUM(pa.amount),0) paid FROM "PaymentAllocation" pa WHERE pa."purchaseBillId"=${a.billId}::uuid`;const paid=new Prisma.Decimal(rows[0]?.paid??0);if(v.gt(bill.grandTotal.sub(paid)))throw new BadRequestException('Bill allocation exceeds outstanding balance')}
    if(sum.gt(payment))throw new BadRequestException('Allocations exceed payment amount');
  }

  private async period(tx:Prisma.TransactionClient,companyId:string,date:Date){const period=await tx.fiscalPeriod.findFirst({where:{fiscalYear:{companyId},startDate:{lte:date},endDate:{gte:date}}});if(!period||period.status==='Hard_Closed') throw new BadRequestException('No postable fiscal period for payment date');return period}
  private async nextNumber(tx:Prisma.TransactionClient,companyId:string,documentType:string,prefix:string,fiscalYearId:string,branchCode:string){let seq=await tx.documentSequence.findUnique({where:{companyId_fiscalYearId_branchCode_documentType:{companyId,fiscalYearId,branchCode,documentType}}});if(!seq)seq=await tx.documentSequence.create({data:{companyId,fiscalYearId,branchCode,documentType,prefix,padding:6}});await tx.$queryRaw`SELECT id FROM "DocumentSequence" WHERE id=${seq.id}::uuid FOR UPDATE`;seq=await tx.documentSequence.update({where:{id:seq.id},data:{currentNumber:{increment:1}}});return `${seq.prefix}${seq.currentNumber.toString().padStart(seq.padding,'0')}`}
}
