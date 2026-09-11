import { Body, Controller, Post } from '@nestjs/common';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales:SalesService){}
  @Post('invoice')
  create(@Body() body:{companyId:string;customerId:string;warehouseId:string;invoiceDate:string;currencyCode:string;exchangeRate:string;postedById?:string;lines:Array<{itemId:string;quantity:string;unitPrice:string;taxRateId?:string}>}){
    return this.sales.createAndPost({...body,invoiceDate:new Date(body.invoiceDate)});
  }
}
