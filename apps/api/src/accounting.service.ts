import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

type JournalInput = {
  companyId: string;
  fiscalPeriodId: string;
  journalNumber: string;
  sourceType: JournalSourceType;
  sourceId?: string;
  transactionDate: Date;
  currencyCode: string;
  exchangeRate: Prisma.Decimal | string;
  postedById?: string;
  lines: Array<{accountId:string; debit?:Prisma.Decimal|string; credit?:Prisma.Decimal|string; customerId?:string; supplierId?:string; description?:string}>;
};

type ManualJournalInput={companyId:string;transactionDate:Date;currencyCode?:string;exchangeRate?:string;postedById?:string;reference?:string;lines:JournalInput['lines']};

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async postJournal(input: JournalInput) {
    return this.prisma.$transaction((tx)=>this.postJournalInTransaction(tx,input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async postManualJournal(input:ManualJournalInput){
    return this.prisma.$transaction(async tx=>{
      const company=await tx.company.findUnique({where:{id:input.companyId}});if(!company)throw new NotFoundException('Company not found');
      const period=await tx.fiscalPeriod.findFirst({where:{fiscalYear:{companyId:input.companyId,status:{not:'Closed'}},startDate:{lte:input.transactionDate},endDate:{gte:input.transactionDate}},orderBy:{startDate:'desc'}});if(!period)throw new BadRequestException('No fiscal period contains the transaction date');
      const journalNumber=await this.nextJournalNumber(tx,input.companyId);
      const journal=await this.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:period.id,journalNumber,sourceType:JournalSourceType.Manual,sourceId:input.reference,transactionDate:input.transactionDate,currencyCode:input.currencyCode??company.baseCurrencyCode,exchangeRate:input.exchangeRate??'1',postedById:input.postedById,lines:input.lines});
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'Journal',aggregateId:journal.id,eventType:'ManualJournalPosted',payload:{journalId:journal.id,journalNumber:journal.journalNumber,reference:input.reference??null}}});
      return journal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async postJournalInTransaction(tx: Prisma.TransactionClient, input: JournalInput) {
    if (input.lines.length < 2) throw new BadRequestException('Journal requires at least two lines');
    const company = await tx.company.findUnique({where:{id:input.companyId}});
    if (!company) throw new NotFoundException('Company not found');
    const period = await tx.fiscalPeriod.findUnique({where:{id:input.fiscalPeriodId},include:{fiscalYear:true}});
    if (!period || period.fiscalYear.companyId!==input.companyId) throw new BadRequestException('Invalid fiscal period');
    if (period.fiscalYear.status==='Closed') throw new BadRequestException('Fiscal year is closed');
    if (period.status==='Hard_Closed') throw new BadRequestException('Fiscal period is hard closed');
    if (period.status==='Soft_Closed') {
      if (!input.postedById) throw new ForbiddenException('Period override permission is required');
      const membership=await tx.companyMembership.findUnique({where:{companyId_userId:{companyId:input.companyId,userId:input.postedById}}});
      if(!membership || !['Admin','Owner'].includes(membership.role)) throw new ForbiddenException('Period override permission is required');
    }
    if (input.transactionDate < period.startDate || input.transactionDate > new Date(`${period.endDate.toISOString().slice(0,10)}T23:59:59.999Z`)) throw new BadRequestException('Transaction date is outside fiscal period');
    if(input.postedById){const membership=await tx.companyMembership.findUnique({where:{companyId_userId:{companyId:input.companyId,userId:input.postedById}}});if(!membership) throw new ForbiddenException('Posting user is not a company member')}
    const accountIds=[...new Set(input.lines.map(l=>l.accountId))];
    const accounts=await tx.account.findMany({where:{id:{in:accountIds},companyId:input.companyId,isLeaf:true,isActive:true}});
    if(accounts.length!==accountIds.length) throw new BadRequestException('All journal accounts must be active leaf accounts in the same company');
    const customerIds=[...new Set(input.lines.map(l=>l.customerId).filter(Boolean) as string[])];const supplierIds=[...new Set(input.lines.map(l=>l.supplierId).filter(Boolean) as string[])];
    if(customerIds.length&&await tx.customer.count({where:{companyId:input.companyId,id:{in:customerIds}}})!==customerIds.length)throw new BadRequestException('Invalid customer on journal line');
    if(supplierIds.length&&await tx.supplier.count({where:{companyId:input.companyId,id:{in:supplierIds}}})!==supplierIds.length)throw new BadRequestException('Invalid supplier on journal line');
    if(input.lines.some(l=>l.customerId&&l.supplierId))throw new BadRequestException('A journal line cannot reference both a customer and supplier');
    const rate=new Prisma.Decimal(input.exchangeRate);
    if(rate.lte(0)) throw new BadRequestException('Exchange rate must be positive');
    let debit=new Prisma.Decimal(0), credit=new Prisma.Decimal(0);
    const lines=input.lines.map(line=>{
      const d=new Prisma.Decimal(line.debit??0); const c=new Prisma.Decimal(line.credit??0);
      if(d.lt(0)||c.lt(0)||d.gt(0)===c.gt(0)) throw new BadRequestException('Each journal line must contain either debit or credit');
      debit=debit.add(d); credit=credit.add(c);
      return {...line, transactionDebit:d,transactionCredit:c,baseDebit:d.mul(rate).toDecimalPlaces(4),baseCredit:c.mul(rate).toDecimalPlaces(4)};
    });
    if(!debit.eq(credit)) throw new BadRequestException('Journal is not balanced');

    const draft=await tx.journal.create({data:{companyId:input.companyId,fiscalPeriodId:input.fiscalPeriodId,journalNumber:input.journalNumber,sourceType:input.sourceType,sourceId:input.sourceId,transactionDate:input.transactionDate,currencyCode:input.currencyCode,exchangeRate:rate,status:JournalStatus.Draft,lines:{create:lines.map(l=>({accountId:l.accountId,transactionDebit:l.transactionDebit,transactionCredit:l.transactionCredit,baseDebit:l.baseDebit,baseCredit:l.baseCredit,customerId:l.customerId,supplierId:l.supplierId,description:l.description}))}}});
    const posted=await tx.journal.update({where:{id:draft.id},data:{status:JournalStatus.Posted,postedById:input.postedById,postedAt:new Date()},include:{lines:true}});
    return posted;
  }

  async reverseJournal(companyId:string,journalId:string,reversalDate:Date,postedById?:string,reason='Journal reversal'){
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Journal" WHERE id=${journalId}::uuid FOR UPDATE`;
      const original=await tx.journal.findUnique({where:{id:journalId},include:{lines:true}});
      if(!original||original.companyId!==companyId) throw new NotFoundException('Journal not found');
      if(original.status!==JournalStatus.Posted) throw new BadRequestException('Only posted journals can be reversed');
      if(original.reversedJournalId) throw new BadRequestException('Journal has already been reversed');
      const period=await tx.fiscalPeriod.findFirst({where:{fiscalYear:{companyId,status:{not:'Closed'}},startDate:{lte:reversalDate},endDate:{gte:reversalDate}}});
      if(!period||period.status==='Hard_Closed') throw new BadRequestException('No postable fiscal period for reversal date');
      const journalNumber=await this.nextJournalNumber(tx,companyId);
      const reversal=await this.postJournalInTransaction(tx,{companyId,fiscalPeriodId:period.id,journalNumber,sourceType:original.sourceType,sourceId:original.sourceId??undefined,transactionDate:reversalDate,currencyCode:original.currencyCode,exchangeRate:original.exchangeRate,postedById,lines:original.lines.map(l=>({accountId:l.accountId,debit:l.transactionCredit,credit:l.transactionDebit,customerId:l.customerId??undefined,supplierId:l.supplierId??undefined,description:`${reason}: ${original.journalNumber}`}))});
      await tx.journal.update({where:{id:original.id},data:{status:JournalStatus.Reversed,reversedJournalId:reversal.id}});
      await tx.outboxEvent.create({data:{companyId,aggregateType:'Journal',aggregateId:original.id,eventType:'JournalReversed',payload:{originalJournalId:original.id,reversalJournalId:reversal.id,reason}}});
      return {originalJournalId:original.id,reversalJournalId:reversal.id,reversalJournalNumber:reversal.journalNumber};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async nextJournalNumber(tx:Prisma.TransactionClient,companyId:string){
    let seq=await tx.documentSequence.findFirst({where:{companyId,documentType:'JOURNAL'},orderBy:{id:'asc'}});
    if(!seq) seq=await tx.documentSequence.create({data:{companyId,documentType:'JOURNAL',prefix:'JV-',padding:6}});
    await tx.$queryRaw`SELECT id FROM "DocumentSequence" WHERE id=${seq.id}::uuid FOR UPDATE`;
    seq=await tx.documentSequence.update({where:{id:seq.id},data:{currentNumber:{increment:1}}});
    return `${seq.prefix}${seq.currentNumber.toString().padStart(seq.padding,'0')}`;
  }
}
