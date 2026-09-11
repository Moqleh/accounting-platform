import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments:PaymentsService){}

  @Post('customer-receipt')
  customerReceipt(@Body() body:{companyId:string;customerId:string;amount:string;date:string;currencyCode:string;exchangeRate:string;postedById?:string;cashAccountId?:string;reference?:string}){
    return this.payments.customerReceipt({...body,date:new Date(body.date)});
  }

  @Post('supplier-payment')
  supplierPayment(@Body() body:{companyId:string;supplierId:string;amount:string;date:string;currencyCode:string;exchangeRate:string;postedById?:string;cashAccountId?:string;reference?:string}){
    return this.payments.supplierPayment({...body,date:new Date(body.date)});
  }
}
