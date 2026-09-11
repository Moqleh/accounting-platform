import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases:PurchasesService){}

  @RequirePermission('purchases.write')
  @Post('bill')
  create(@Req() req:any,@Headers('idempotency-key') idempotencyKey:string|undefined,@Body() body:{companyId:string;supplierId:string;warehouseId:string;billDate:string;currencyCode:string;exchangeRate:string;lines:Array<{itemId:string;quantity:string;unitCost:string;taxRateId?:string}>}){
    return this.purchases.createAndPost({...body,postedById:req.user.sub,billDate:new Date(body.billDate)},idempotencyKey);
  }
}
