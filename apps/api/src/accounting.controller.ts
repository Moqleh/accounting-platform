import { Body,Controller,Headers,Post,Req,UseGuards } from '@nestjs/common';
import { JournalSourceType } from '@prisma/client';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard,RequirePermission } from './permission.guard';
@UseGuards(JwtAuthGuard,RolesGuard,PermissionGuard)@Controller('accounting')
export class AccountingController{constructor(private readonly accounting:AccountingService){}
 @RequirePermission('accounting.write')@Post('journals/post') post(@Req() req:any,@Body() body:{companyId:string;fiscalPeriodId:string;journalNumber:string;sourceType:JournalSourceType;sourceId?:string;transactionDate:string;currencyCode:string;exchangeRate:string;lines:Array<{accountId:string;debit?:string;credit?:string;customerId?:string;supplierId?:string;description?:string}>}){return this.accounting.postJournal({...body,postedById:req.user.sub,transactionDate:new Date(body.transactionDate)})}
 @RequirePermission('accounting.write')@Post('journals/manual') manual(@Req() req:any,@Headers('idempotency-key') key:string|undefined,@Body() body:{companyId:string;transactionDate:string;currencyCode?:string;exchangeRate?:string;reference?:string;lines:Array<{accountId:string;debit?:string;credit?:string;customerId?:string;supplierId?:string;description?:string}>}){return this.accounting.postManualJournal({...body,postedById:req.user.sub,transactionDate:new Date(body.transactionDate)},key)}
 @RequirePermission('accounting.write')@Post('journals/reverse') reverse(@Req() req:any,@Body() body:{companyId:string;journalId:string;reversalDate:string;reason?:string}){return this.accounting.reverseJournal(body.companyId,body.journalId,new Date(body.reversalDate),req.user.sub,body.reason)}
}
