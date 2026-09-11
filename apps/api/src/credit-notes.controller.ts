import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard,RolesGuard,PermissionGuard)
@Controller('credit-notes')
export class CreditNotesController{
  constructor(private readonly creditNotes:CreditNotesService){}
  @RequirePermission('sales.write')
  @Post()
  create(@Req() req:any,@Headers('idempotency-key') key:string|undefined,@Body() body:{companyId:string;invoiceId:string;warehouseId:string;creditDate:string;currencyCode:string;exchangeRate:string;reason:string;lines:Array<{invoiceLineId:string;quantity:string}>}){
    return this.creditNotes.createAndPost({...body,postedById:req.user.sub,creditDate:new Date(body.creditDate)},key);
  }
}
