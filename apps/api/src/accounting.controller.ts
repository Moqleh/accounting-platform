import { Body, Controller, Post } from '@nestjs/common';
import { JournalSourceType } from '@prisma/client';
import { AccountingService } from './accounting.service';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Post('journals/post')
  post(@Body() body:{companyId:string;fiscalPeriodId:string;journalNumber:string;sourceType:JournalSourceType;sourceId?:string;transactionDate:string;currencyCode:string;exchangeRate:string;postedById?:string;lines:Array<{accountId:string;debit?:string;credit?:string;customerId?:string;supplierId?:string;description?:string}>}){
    return this.accounting.postJournal({...body,transactionDate:new Date(body.transactionDate)});
  }
}
