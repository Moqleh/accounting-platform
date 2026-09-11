import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FiscalYearStatus, JournalSourceType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AccountingService } from './accounting.service';

@Injectable()
export class YearEndService {
  constructor(private readonly prisma:PrismaService, private readonly accounting:AccountingService){}

  async close(input:{companyId:string;fiscalYearId:string;retainedEarningsAccountId:string;closedById?:string;notes?:string}){
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "FiscalYear" WHERE id=${input.fiscalYearId}::uuid FOR UPDATE`;
      const year=await tx.fiscalYear.findUnique({where:{id:input.fiscalYearId},include:{periods:{orderBy:{number:'asc'}},company:true}});
      if(!year||year.companyId!==input.companyId) throw new NotFoundException('Fiscal year not found');
      if(year.status===FiscalYearStatus.Closed||year.closingJournalId) throw new BadRequestException('Fiscal year is already closed');
      if(!year.periods.length) throw new BadRequestException('Fiscal year has no periods');
      const finalPeriod=year.periods[year.periods.length-1];
      const earlier=year.periods.slice(0,-1);
      if(earlier.some(p=>p.status!=='Hard_Closed')) throw new BadRequestException('All periods except the final period must be hard closed');
      if(finalPeriod.status!=='Open') throw new BadRequestException('Final period must remain open until the closing journal is posted');
      const retained=await tx.account.findUnique({where:{id:input.retainedEarningsAccountId}});
      if(!retained||retained.companyId!==input.companyId||retained.type!=='Equity'||!retained.isLeaf||!retained.isActive) throw new BadRequestException('Invalid retained earnings account');
      await tx.fiscalYear.update({where:{id:year.id},data:{status:FiscalYearStatus.Closing}});
      const lines=await tx.journalLine.findMany({where:{journal:{companyId:input.companyId,status:{in:['Posted','Reversed']},sourceType:{not:JournalSourceType.YearEndClosing},transactionDate:{gte:year.startDate,lte:new Date(`${year.endDate.toISOString().slice(0,10)}T23:59:59.999Z`)}},account:{type:{in:['Revenue','Expense']}}},include:{account:true}});
      const balances=new Map<string,{accountId:string;type:'Revenue'|'Expense';balance:Prisma.Decimal}>();
      for(const line of lines){const current=balances.get(line.accountId)??{accountId:line.accountId,type:line.account.type as 'Revenue'|'Expense',balance:new Prisma.Decimal(0)};const movement=line.account.type==='Revenue'?line.baseCredit.sub(line.baseDebit):line.baseDebit.sub(line.baseCredit);current.balance=current.balance.add(movement);balances.set(line.accountId,current)}
      const closingLines:Array<{accountId:string;debit?:string;credit?:string;description?:string}>=[];let netProfit=new Prisma.Decimal(0);
      for(const b of balances.values()){
        if(b.balance.eq(0)) continue;
        if(b.type==='Revenue'){if(b.balance.gt(0)) closingLines.push({accountId:b.accountId,debit:b.balance.toString(),description:'Year-end revenue closing'});else closingLines.push({accountId:b.accountId,credit:b.balance.abs().toString(),description:'Year-end revenue closing'});netProfit=netProfit.add(b.balance)}
        else {if(b.balance.gt(0)) closingLines.push({accountId:b.accountId,credit:b.balance.toString(),description:'Year-end expense closing'});else closingLines.push({accountId:b.accountId,debit:b.balance.abs().toString(),description:'Year-end expense closing'});netProfit=netProfit.sub(b.balance)}
      }
      if(netProfit.gt(0)) closingLines.push({accountId:retained.id,credit:netProfit.toString(),description:'Transfer current-year profit to retained earnings'});
      if(netProfit.lt(0)) closingLines.push({accountId:retained.id,debit:netProfit.abs().toString(),description:'Transfer current-year loss to retained earnings'});
      let closingJournalId:string|undefined;
      if(closingLines.length){const journalNumber=await this.nextJournalNumber(tx,input.companyId);const journal=await this.accounting.postJournalInTransaction(tx,{companyId:input.companyId,fiscalPeriodId:finalPeriod.id,journalNumber,sourceType:JournalSourceType.YearEndClosing,sourceId:year.id,transactionDate:new Date(`${year.endDate.toISOString().slice(0,10)}T12:00:00Z`),currencyCode:year.company.baseCurrencyCode,exchangeRate:'1',postedById:input.closedById,lines:closingLines});closingJournalId=journal.id}
      await tx.fiscalPeriod.update({where:{id:finalPeriod.id},data:{status:'Hard_Closed'}});
      const closed=await tx.fiscalYear.update({where:{id:year.id},data:{status:FiscalYearStatus.Closed,closedAt:new Date(),closedById:input.closedById,closingJournalId}});
      await tx.outboxEvent.create({data:{companyId:input.companyId,aggregateType:'FiscalYear',aggregateId:year.id,eventType:'FiscalYearClosed',payload:{fiscalYearId:year.id,closingJournalId:closingJournalId??null,netProfit:netProfit.toString(),notes:input.notes??null}}});
      return {fiscalYearId:closed.id,status:closed.status,closingJournalId:closingJournalId??null,netProfit:netProfit.toString()};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async nextJournalNumber(tx:Prisma.TransactionClient,companyId:string){let seq=await tx.documentSequence.findFirst({where:{companyId,documentType:'JOURNAL'},orderBy:{id:'asc'}});if(!seq)seq=await tx.documentSequence.create({data:{companyId,documentType:'JOURNAL',prefix:'JV-',padding:6}});await tx.$queryRaw`SELECT id FROM "DocumentSequence" WHERE id=${seq.id}::uuid FOR UPDATE`;seq=await tx.documentSequence.update({where:{id:seq.id},data:{currentNumber:{increment:1}}});return `${seq.prefix}${seq.currentNumber.toString().padStart(seq.padding,'0')}`}
}
