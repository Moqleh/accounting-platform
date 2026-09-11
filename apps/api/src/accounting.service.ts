import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async postJournal(input: JournalInput) {
    return this.prisma.$transaction((tx)=>this.postJournalInTransaction(tx,input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async postJournalInTransaction(tx: Prisma.TransactionClient, input: JournalInput) {
    if (!input.lines.length) throw new BadRequestException('Journal requires at least one line');
    const company = await tx.company.findUnique({where:{id:input.companyId}});
    if (!company) throw new NotFoundException('Company not found');
    const period = await tx.fiscalPeriod.findUnique({where:{id:input.fiscalPeriodId},include:{fiscalYear:true}});
    if (!period || period.fiscalYear.companyId!==input.companyId) throw new BadRequestException('Invalid fiscal period');
    if (period.status!=='Open') throw new BadRequestException('Fiscal period is not open');
    if (input.transactionDate < period.startDate || input.transactionDate > new Date(`${period.endDate.toISOString().slice(0,10)}T23:59:59.999Z`)) throw new BadRequestException('Transaction date is outside fiscal period');
    const accountIds=[...new Set(input.lines.map(l=>l.accountId))];
    const accounts=await tx.account.findMany({where:{id:{in:accountIds},companyId:input.companyId,isLeaf:true,isActive:true}});
    if(accounts.length!==accountIds.length) throw new BadRequestException('All journal accounts must be active leaf accounts in the same company');
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
    return tx.journal.create({data:{companyId:input.companyId,fiscalPeriodId:input.fiscalPeriodId,journalNumber:input.journalNumber,sourceType:input.sourceType,sourceId:input.sourceId,transactionDate:input.transactionDate,currencyCode:input.currencyCode,exchangeRate:rate,status:JournalStatus.Posted,postedById:input.postedById,postedAt:new Date(),lines:{create:lines.map(l=>({accountId:l.accountId,transactionDebit:l.transactionDebit,transactionCredit:l.transactionCredit,baseDebit:l.baseDebit,baseCredit:l.baseCredit,customerId:l.customerId,supplierId:l.supplierId,description:l.description}))}},include:{lines:true}});
  }
}
