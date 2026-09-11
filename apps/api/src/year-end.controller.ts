import { Body, Controller, Post } from '@nestjs/common';
import { YearEndService } from './year-end.service';

@Controller('year-end')
export class YearEndController {
  constructor(private readonly yearEnd:YearEndService){}

  @Post('close')
  close(@Body() body:{companyId:string;fiscalYearId:string;retainedEarningsAccountId:string;closedById?:string;notes?:string}){
    return this.yearEnd.close(body);
  }
}
