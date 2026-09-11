import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments:PaymentsService){}

  @RequirePermission('payments.write')
  @Post('customer-receipt')
  customerReceipt(@Req() req:any,@Body() body:{companyId:string;customerId:string;amount:string;date:string;currencyCode:string;exchangeRate:string;cashAccountId?:string;reference?:string}){
    return this.payments.customerReceipt({...body,postedById:req.user.sub,date:new Date(body.date)});
  }

  @RequirePermission('payments.write')
  @Post('supplier-payment')
  supplierPayment(@Req() req:any,@Body() body:{companyId:string;supplierId:string;amount:string;date:string;currencyCode:string;exchangeRate:string;cashAccountId?:string;reference?:string}){
    return this.payments.supplierPayment({...body,postedById:req.user.sub,date:new Date(body.date)});
  }
}
