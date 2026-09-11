import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { YearEndService } from './year-end.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Controller('year-end')
export class YearEndController {
  constructor(private readonly yearEnd:YearEndService){}

  @RequirePermission('accounting.write')
  @Post('close')
  close(@Req() req:any,@Body() body:{companyId:string;fiscalYearId:string;retainedEarningsAccountId:string;notes?:string}){
    if(!['Admin','Owner'].includes(req.membership?.role)) throw new ForbiddenException('Only Admin/Owner can close a fiscal year');
    return this.yearEnd.close({...body,closedById:req.user.sub});
  }
}
