import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ItemType } from '@prisma/client';
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
  async createUser(@Param('companyId') companyId:string,@Body() body:{email:string;fullName:string;role:string;dataScope?:string}){
    const allowed=['Admin','Owner','Accountant','Sales','Purchases','Employee'];
    if(!allowed.includes(body.role)) throw new BadRequestException('Invalid role');
    const user=await this.prisma.user.upsert({where:{email:body.email.trim().toLowerCase()},update:{fullName:body.fullName},create:{email:body.email.trim().toLowerCase(),fullName:body.fullName}});
    return this.prisma.companyMembership.upsert({where:{companyId_userId:{companyId,userId:user.id}},update:{role:body.role,dataScope:body.dataScope},create:{companyId,userId:user.id,role:body.role,dataScope:body.dataScope},include:{user:{select:{id:true,email:true,fullName:true,createdAt:true}}}});
  }

  @Get('fiscal-years/:companyId')
  fiscalYears(@Param('companyId') companyId:string){return this.prisma.fiscalYear.findMany({where:{companyId},include:{periods:{orderBy:{number:'asc'}}},orderBy:{startDate:'desc'}})}

  @Post('items/:companyId')
  async createItem(@Param('companyId') companyId:string,@Body() body:{code:string;name:string;type:ItemType;revenueAccountId:string;inventoryAccountId?:string;cogsAccountId?:string}){
    const ids=[body.revenueAccountId,body.inventoryAccountId,body.cogsAccountId].filter(Boolean) as string[];
    const count=await this.prisma.account.count({where:{companyId,id:{in:ids},isLeaf:true,isActive:true}});
    if(count!==new Set(ids).size) throw new BadRequestException('Item accounts must be active leaf accounts in the same company');
    if(body.type==='Inventory'&&(!body.inventoryAccountId||!body.cogsAccountId)) throw new BadRequestException('Inventory items require inventory and COGS accounts');
    return this.prisma.item.create({data:{companyId,...body}});
  }

  @Post('warehouses/:companyId')
  createWarehouse(@Param('companyId') companyId:string,@Body() body:{code:string;name:string}){
    return this.prisma.warehouse.create({data:{companyId,...body}});
  }
}
