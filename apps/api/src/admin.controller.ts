import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccountType, FiscalPeriodStatus, ItemType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@RequirePermission('admin.manage')
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma:PrismaService){}

  @Get('company/:companyId')
  company(@Param('companyId') companyId:string){return this.prisma.company.findUnique({where:{id:companyId},include:{baseCurrency:true}})}

  @Post('company/:companyId')
  updateCompany(@Param('companyId') companyId:string,@Body() body:{name?:string;taxNumber?:string;baseCurrencyCode?:string}){
    return this.prisma.company.update({where:{id:companyId},data:body});
  }

  @Get('users/:companyId')
  users(@Param('companyId') companyId:string){return this.prisma.companyMembership.findMany({where:{companyId},include:{user:{select:{id:true,email:true,fullName:true,createdAt:true}}},orderBy:{createdAt:'asc'}})}

  @Post('users/:companyId')
  async createUser(@Param('companyId') companyId:string,@Body() body:{email:string;fullName:string;role:string;dataScope?:string;password?:string}){
    const allowed=['Admin','Owner','Accountant','Sales','Purchases','Employee'];
    if(!allowed.includes(body.role)) throw new BadRequestException('Invalid role');
    if(body.password&&body.password.length<8) throw new BadRequestException('Password must contain at least 8 characters');
    const passwordHash=body.password?await bcrypt.hash(body.password,12):undefined;
    const user=await this.prisma.user.upsert({where:{email:body.email.trim().toLowerCase()},update:{fullName:body.fullName,...(passwordHash?{passwordHash}:{})},create:{email:body.email.trim().toLowerCase(),fullName:body.fullName,passwordHash}});
    return this.prisma.companyMembership.upsert({where:{companyId_userId:{companyId,userId:user.id}},update:{role:body.role,dataScope:body.dataScope},create:{companyId,userId:user.id,role:body.role,dataScope:body.dataScope},include:{user:{select:{id:true,email:true,fullName:true,createdAt:true}}}});
  }

  @Post('users/:companyId/:userId/password')
  async setPassword(@Param('companyId') companyId:string,@Param('userId') userId:string,@Body() body:{password:string}){
    if(!body.password||body.password.length<8) throw new BadRequestException('Password must contain at least 8 characters');
    const member=await this.prisma.companyMembership.findUnique({where:{companyId_userId:{companyId,userId}}});
    if(!member) throw new BadRequestException('User is not a member of this company');
    await this.prisma.user.update({where:{id:userId},data:{passwordHash:await bcrypt.hash(body.password,12)}});
    return {ok:true};
  }

  @Get('accounts/:companyId')
  accounts(@Param('companyId') companyId:string){return this.prisma.account.findMany({where:{companyId},orderBy:{code:'asc'},include:{parent:{select:{id:true,code:true,name:true}}}})}

  @Post('accounts/:companyId')
  async createAccount(@Param('companyId') companyId:string,@Body() body:{code:string;name:string;type:AccountType;parentId?:string;isLeaf?:boolean}){
    if(body.parentId){const parent=await this.prisma.account.findUnique({where:{id:body.parentId}});if(!parent||parent.companyId!==companyId)throw new BadRequestException('Invalid parent account');if(parent.type!==body.type)throw new BadRequestException('Parent and child account types must match');}
    return this.prisma.$transaction(async tx=>{if(body.parentId)await tx.account.update({where:{id:body.parentId},data:{isLeaf:false}});return tx.account.create({data:{companyId,code:body.code.trim(),name:body.name.trim(),type:body.type,parentId:body.parentId||null,isLeaf:body.isLeaf??true}})});
  }

  @Get('tax-rates/:companyId')
  taxRates(@Param('companyId') companyId:string){return this.prisma.taxRate.findMany({where:{companyId},include:{salesTaxAccount:true,purchaseTaxAccount:true},orderBy:[{code:'asc'},{effectiveFrom:'desc'}]})}

  @Post('tax-rates/:companyId')
  async createTaxRate(@Param('companyId') companyId:string,@Body() body:{code:string;name:string;rate:string;salesTaxAccountId:string;purchaseTaxAccountId:string;effectiveFrom:string;effectiveTo?:string}){
    const accountIds=[body.salesTaxAccountId,body.purchaseTaxAccountId];const accounts=await this.prisma.account.findMany({where:{companyId,id:{in:accountIds},isLeaf:true,isActive:true}});if(accounts.length!==new Set(accountIds).size)throw new BadRequestException('Tax accounts must be active leaf accounts in the same company');
    const rate=new Prisma.Decimal(body.rate);if(rate.lt(0)||rate.gt(1))throw new BadRequestException('Tax rate must be between 0 and 1');
    return this.prisma.taxRate.create({data:{companyId,code:body.code.trim(),name:body.name.trim(),rate,salesTaxAccountId:body.salesTaxAccountId,purchaseTaxAccountId:body.purchaseTaxAccountId,effectiveFrom:new Date(body.effectiveFrom),effectiveTo:body.effectiveTo?new Date(body.effectiveTo):null}});
  }

  @Get('fiscal-years/:companyId')
  fiscalYears(@Param('companyId') companyId:string){return this.prisma.fiscalYear.findMany({where:{companyId},include:{periods:{orderBy:{number:'asc'}}},orderBy:{startDate:'desc'}})}

  @Post('fiscal-years/:companyId')
  async createFiscalYear(@Param('companyId') companyId:string,@Body() body:{name:string;startDate:string;endDate:string}){
    const start=new Date(`${body.startDate}T00:00:00.000Z`),end=new Date(`${body.endDate}T00:00:00.000Z`);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end)throw new BadRequestException('Invalid fiscal year dates');
    const overlap=await this.prisma.fiscalYear.findFirst({where:{companyId,startDate:{lte:end},endDate:{gte:start}}});if(overlap)throw new BadRequestException('Fiscal year overlaps an existing fiscal year');
    return this.prisma.$transaction(async tx=>{const year=await tx.fiscalYear.create({data:{companyId,name:body.name.trim(),startDate:start,endDate:end}});const periods=[] as Array<{fiscalYearId:string;number:number;startDate:Date;endDate:Date}>;let cursor=new Date(start),number=1;while(cursor<=end){const periodStart=new Date(cursor);let periodEnd=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,0));if(periodEnd>end)periodEnd=new Date(end);periods.push({fiscalYearId:year.id,number:number++,startDate:periodStart,endDate:periodEnd});cursor=new Date(Date.UTC(periodEnd.getUTCFullYear(),periodEnd.getUTCMonth(),periodEnd.getUTCDate()+1));}await tx.fiscalPeriod.createMany({data:periods});return tx.fiscalYear.findUnique({where:{id:year.id},include:{periods:{orderBy:{number:'asc'}}}})});
  }

  @Patch('fiscal-periods/:companyId/:periodId/status')
  async setFiscalPeriodStatus(@Param('companyId') companyId:string,@Param('periodId') periodId:string,@Body() body:{status:FiscalPeriodStatus}){
    const period=await this.prisma.fiscalPeriod.findUnique({where:{id:periodId},include:{fiscalYear:true}});if(!period||period.fiscalYear.companyId!==companyId)throw new BadRequestException('Fiscal period not found');if(period.fiscalYear.status==='Closed')throw new BadRequestException('Closed fiscal years cannot be changed');return this.prisma.fiscalPeriod.update({where:{id:periodId},data:{status:body.status}});
  }

  @Post('items/:companyId')
  async createItem(@Param('companyId') companyId:string,@Body() body:{code:string;name:string;type:ItemType;revenueAccountId:string;inventoryAccountId?:string;cogsAccountId?:string}){
    const ids=[body.revenueAccountId,body.inventoryAccountId,body.cogsAccountId].filter(Boolean) as string[];
    const count=await this.prisma.account.count({where:{companyId,id:{in:ids},isLeaf:true,isActive:true}});
    if(count!==new Set(ids).size) throw new BadRequestException('Item accounts must be active leaf accounts in the same company');
    if(body.type==='Inventory'&&(!body.inventoryAccountId||!body.cogsAccountId)) throw new BadRequestException('Inventory items require inventory and COGS accounts');
    return this.prisma.item.create({data:{companyId,...body}});
  }

  @Get('warehouses/:companyId')
  warehouses(@Param('companyId') companyId:string){return this.prisma.warehouse.findMany({where:{companyId},orderBy:{code:'asc'}})}

  @Post('warehouses/:companyId')
  createWarehouse(@Param('companyId') companyId:string,@Body() body:{code:string;name:string}){
    return this.prisma.warehouse.create({data:{companyId,code:body.code.trim(),name:body.name.trim()}});
  }
}
