import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AccountingService } from './accounting.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma:PrismaService, private readonly accounting:AccountingService){}

  customerReceipt(input:{companyId:string;customerId:string;amount:string;date:Date;currencyCode:string;exchangeRate:string;postedById?:string;cashAccountId?:string;reference?:string}){
    return this.prisma.$transaction(async tx=>{
      const company=await tx.company.findUnique({where:{id:input.companyId}}); if(!company) throw new NotFoundException('Company not found');
      const customer=await tx.customer.findUnique({where:{id:input.customerId}}); if(!customer||customer.companyId!==input.companyId) throw new BadRequestException('Invalid customer');
      const period=await this.period(tx,input.companyId,input.date);
      const cash=input.cashAccountId?await tx.account.findFirst({where:{id:input.cashAccountId,companyId:input.companyId,isLeaf:true,isActive:true}}):await tx.account.findFirst({where:{companyId:input.companyId,code:'1110',isLeaf:true,isActive:true}});
      const ar=await tx.account.findFirst({where:{companyId:input.companyId,code:'1120',isLeaf:true,isActive:true}});
      if(!cash||!ar) throw new BadRequestException('Cash or receivable account is not configured');
      const amount=new Prisma.Decimal(input.amount); if(amount.lte(0)) throw new BadRequestException('Amount must be positive');
      const number=await this.nextNumber(tx,input.companyId,'JOURNAL','JV-');
      const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber:number,sourceType:JournalSourceType.CustomerPayment,sourceId:input.reference,transactionDate:input.date,currencyCode:input.currencyCode||company.baseCurrencyCode,exchangeRate:input.exchangeRate||'1',postedById:input.postedById,lines:[{accountId:cash.id,debit:amount,customerId:customer.id,description:'Customer receipt'},{accountId:ar.id,credit:amount,customerId:customer.id,description:'Customer receipt'}]});
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'CustomerPayment',aggregateId:journal.id,eventType:'CustomerPaymentPosted',payload:{journalId:journal.id,customerId:customer.id,amount:amount.toString(),reference:input.reference}}});
      return journal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  supplierPayment(input:{companyId:string;supplierId:string;amount:string;date:Date;currencyCode:string;exchangeRate:string;postedById?:string;cashAccountId?:string;reference?:string}){
    return this.prisma.$transaction(async tx=>{
      const company=await tx.company.findUnique({where:{id:input.companyId}}); if(!company) throw new NotFoundException('Company not found');
      const supplier=await tx.supplier.findUnique({where:{id:input.supplierId}}); if(!supplier||supplier.companyId!==input.companyId) throw new BadRequestException('Invalid supplier');
      const period=await this.period(tx,input.companyId,input.date);
      const cash=input.cashAccountId?await tx.account.findFirst({where:{id:input.cashAccountId,companyId:input.companyId,isLeaf:true,isActive:true}}):await tx.account.findFirst({where:{companyId:input.companyId,code:'1110',isLeaf:true,isActive:true}});
      const ap=await tx.account.findFirst({where:{companyId:input.companyId,code:'2110',isLeaf:true,isActive:true}});
      if(!cash||!ap) throw new BadRequestException('Cash or payable account is not configured');
      const amount=new Prisma.Decimal(input.amount); if(amount.lte(0)) throw new BadRequestException('Amount must be positive');
      const number=await this.nextNumber(tx,input.companyId,'JOURNAL','JV-');
      const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber:number,sourceType:JournalSourceType.SupplierPayment,sourceId:input.reference,transactionDate:input.date,currencyCode:input.currencyCode||company.baseCurrencyCode,exchangeRate:input.exchangeRate||'1',postedById:input.postedById,lines:[{accountId:ap.id,debit:amount,supplierId:supplier.id,description:'Supplier payment'},{accountId:cash.id,credit:amount,supplierId:supplier.id,description:'Supplier payment'}]});
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'SupplierPayment',aggregateId:journal.id,eventType:'SupplierPaymentPosted',payload:{journalId:journal.id,supplierId:supplier.id,amount:amount.toString(),reference:input.reference}}});
      return journal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async period(tx:Prisma.TransactionClient,companyId:string,date:Date){const period=await tx.fiscalPeriod.findFirst({where:{fiscalYear:{companyId},startDate:{lte:date},endDate:{gte:date}}});if(!period||period.status!=='Open') throw new BadRequestException('No open fiscal period for payment date');return period}
  private async nextNumber(tx:Prisma.TransactionClient,companyId:string,documentType:string,prefix:string){let seq=await tx.documentSequence.findFirst({where:{companyId,documentType},orderBy:{id:'asc'}});if(!seq)seq=await tx.documentSequence.create({data:{companyId,documentType,prefix,padding:6}});await tx.$queryRaw`SELECT id FROM "DocumentSequence" WHERE id=${seq.id}::uuid FOR UPDATE`;seq=await tx.documentSequence.update({where:{id:seq.id},data:{currentNumber:{increment:1}}});return `${seq.prefix}${seq.currentNumber.toString().padStart(seq.padding,'0')}`}
}
