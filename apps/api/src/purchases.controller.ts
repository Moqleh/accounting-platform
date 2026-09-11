import { Body, Controller, Post } from '@nestjs/common';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases:PurchasesService){}
  @Post('bill')
  create(@Body() body:{companyId:string;supplierId:string;warehouseId:string;billDate:string;currencyCode:string;exchangeRate:string;postedById?:string;lines:Array<{itemId:string;quantity:string;unitCost:string;taxRateId?:string}>}){
    return this.purchases.createAndPost({...body,billDate:new Date(body.billDate)});
  }
}
