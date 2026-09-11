import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales:SalesService){}

  @RequirePermission('sales.write')
  @Post('invoice')
  create(@Req() req:any,@Body() body:{companyId:string;customerId:string;warehouseId:string;invoiceDate:string;currencyCode:string;exchangeRate:string;lines:Array<{itemId:string;quantity:string;unitPrice:string;taxRateId?:string}>}){
    return this.sales.createAndPost({...body,postedById:req.user.sub,invoiceDate:new Date(body.invoiceDate)});
  }
}
