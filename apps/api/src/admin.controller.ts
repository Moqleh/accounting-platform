import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ItemType } from '@prisma/client';
import { PrismaService } from './prisma.service';

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
  users(@Param('companyId') companyId:string){return this.prisma.companyMembership.findMany({where:{companyId},include:{user:true},orderBy:{createdAt:'asc'}})}

  @Post('users/:companyId')
  async createUser(@Param('companyId') companyId:string,@Body() body:{email:string;fullName:string;role:string;dataScope?:string}){
    const user=await this.prisma.user.upsert({where:{email:body.email},update:{fullName:body.fullName},create:{email:body.email,fullName:body.fullName}});
    return this.prisma.companyMembership.upsert({where:{companyId_userId:{companyId,userId:user.id}},update:{role:body.role,dataScope:body.dataScope},create:{companyId,userId:user.id,role:body.role,dataScope:body.dataScope},include:{user:true}});
  }

  @Get('fiscal-years/:companyId')
  fiscalYears(@Param('companyId') companyId:string){return this.prisma.fiscalYear.findMany({where:{companyId},include:{periods:{orderBy:{number:'asc'}}},orderBy:{startDate:'desc'}})}

  @Post('items/:companyId')
  createItem(@Param('companyId') companyId:string,@Body() body:{code:string;name:string;type:ItemType;revenueAccountId:string;inventoryAccountId?:string;cogsAccountId?:string}){
    return this.prisma.item.create({data:{companyId,...body}});
  }

  @Post('warehouses/:companyId')
  createWarehouse(@Param('companyId') companyId:string,@Body() body:{code:string;name:string}){
    return this.prisma.warehouse.create({data:{companyId,...body}});
  }
}
