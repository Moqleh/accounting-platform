import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Controller('erp')
export class ErpController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('dashboard.read')
  @Get('dashboard/:companyId')
  async dashboard(@Param('companyId') companyId:string){
    const [sales,purchases,customers,suppliers,items,journals]=await Promise.all([
      this.prisma.salesInvoice.aggregate({where:{companyId,status:'Posted'},_sum:{grandTotal:true}}),
      this.prisma.purchaseBill.aggregate({where:{companyId,status:'Posted'},_sum:{grandTotal:true}}),
      this.prisma.customer.count({where:{companyId,isActive:true}}),
      this.prisma.supplier.count({where:{companyId,isActive:true}}),
      this.prisma.item.count({where:{companyId,isActive:true}}),
      this.prisma.journal.count({where:{companyId,status:{in:['Posted','Reversed']}}}),
    ]);
    return {sales:sales._sum.grandTotal?.toString()??'0',purchases:purchases._sum.grandTotal?.toString()??'0',customers,suppliers,items,journals};
  }

  @RequirePermission('customers.read')
  @Get('customers/:companyId')
  customers(@Param('companyId') companyId:string){return this.prisma.customer.findMany({where:{companyId},orderBy:{createdAt:'desc'}})}

  @RequirePermission('customers.write')
  @Post('customers/:companyId')
  createCustomer(@Param('companyId') companyId:string,@Body() body:{code:string;name:string;email?:string;phone?:string;taxNumber?:string}){return this.prisma.customer.create({data:{companyId,...body}})}

  @RequirePermission('suppliers.read')
  @Get('suppliers/:companyId')
  suppliers(@Param('companyId') companyId:string){return this.prisma.supplier.findMany({where:{companyId},orderBy:{createdAt:'desc'}})}

  @RequirePermission('suppliers.write')
  @Post('suppliers/:companyId')
  createSupplier(@Param('companyId') companyId:string,@Body() body:{code:string;name:string;email?:string;phone?:string;taxNumber?:string}){return this.prisma.supplier.create({data:{companyId,...body}})}

  @RequirePermission('inventory.read')
  @Get('items/:companyId')
  items(@Param('companyId') companyId:string){return this.prisma.item.findMany({where:{companyId},include:{lots:true},orderBy:{code:'asc'}})}

  @RequirePermission('inventory.read')
  @Get('warehouses/:companyId')
  warehouses(@Param('companyId') companyId:string){return this.prisma.warehouse.findMany({where:{companyId,isActive:true},orderBy:{code:'asc'}})}

  @RequirePermission('accounting.read')
  @Get('tax-rates/:companyId')
  taxRates(@Param('companyId') companyId:string){return this.prisma.taxRate.findMany({where:{companyId},orderBy:[{code:'asc'},{effectiveFrom:'desc'}]})}

  @RequirePermission('accounting.read')
  @Get('accounts/:companyId')
  accounts(@Param('companyId') companyId:string){return this.prisma.account.findMany({where:{companyId},orderBy:{code:'asc'}})}

  @RequirePermission('sales.read')
  @Get('sales/:companyId')
  sales(@Param('companyId') companyId:string){return this.prisma.salesInvoice.findMany({where:{companyId},include:{customer:true,lines:{include:{item:true}}},orderBy:{invoiceDate:'desc'}})}

  @RequirePermission('purchases.read')
  @Get('purchases/:companyId')
  purchases(@Param('companyId') companyId:string){return this.prisma.purchaseBill.findMany({where:{companyId},include:{supplier:true,lines:{include:{item:true}}},orderBy:{billDate:'desc'}})}

  @RequirePermission('accounting.read')
  @Get('journals/:companyId')
  journals(@Param('companyId') companyId:string,@Query('take') take='100'){return this.prisma.journal.findMany({where:{companyId},include:{lines:{include:{account:true}}},orderBy:{transactionDate:'desc'},take:Math.min(Number(take)||100,500)})}

  @RequirePermission('reports.read')
  @Get('trial-balance/:companyId')
  async trialBalance(@Param('companyId') companyId:string,@Query('from') from?:string,@Query('to') to?:string){
    const rows=await this.prisma.journalLine.groupBy({by:['accountId'],where:{journal:{companyId,status:{in:['Posted','Reversed']},transactionDate:{gte:from?new Date(from):undefined,lte:to?new Date(to):undefined}}},_sum:{baseDebit:true,baseCredit:true}});
    const accounts=await this.prisma.account.findMany({where:{id:{in:rows.map(r=>r.accountId)}}});
    const map=new Map(accounts.map(a=>[a.id,a]));
    return rows.map(r=>({accountCode:map.get(r.accountId)?.code,accountName:map.get(r.accountId)?.name,debit:r._sum.baseDebit?.toString()??'0',credit:r._sum.baseCredit?.toString()??'0'}));
  }

  @RequirePermission('reports.read')
  @Get('profit-loss/:companyId')
  async profitLoss(@Param('companyId') companyId:string,@Query('from') from?:string,@Query('to') to?:string){
    const where: Prisma.JournalLineWhereInput={journal:{companyId,status:{in:['Posted','Reversed']},sourceType:{not:'YearEndClosing'},transactionDate:{gte:from?new Date(from):undefined,lte:to?new Date(to):undefined}},account:{type:{in:['Revenue','Expense']}}};
    const lines=await this.prisma.journalLine.findMany({where,include:{account:true}});
    let revenue=new Prisma.Decimal(0),expense=new Prisma.Decimal(0);
    for(const line of lines){if(line.account.type==='Revenue') revenue=revenue.add(line.baseCredit).sub(line.baseDebit); else expense=expense.add(line.baseDebit).sub(line.baseCredit)}
    return {revenue:revenue.toString(),expense:expense.toString(),netProfit:revenue.sub(expense).toString()};
  }

  @RequirePermission('reports.read')
  @Get('balance-sheet/:companyId')
  async balanceSheet(@Param('companyId') companyId:string,@Query('asOf') asOf?:string){
    const target=asOf?new Date(asOf):new Date();
    const lines=await this.prisma.journalLine.findMany({where:{journal:{companyId,status:{in:['Posted','Reversed']},transactionDate:{lte:target}},account:{type:{in:['Asset','Liability','Equity']}}},include:{account:true}});
    const balances=new Map<string,{code:string;name:string;type:string;balance:Prisma.Decimal}>();
    for(const line of lines){const key=line.accountId;const current=balances.get(key)??{code:line.account.code,name:line.account.name,type:line.account.type,balance:new Prisma.Decimal(0)};const movement=line.account.type==='Asset'?line.baseDebit.sub(line.baseCredit):line.baseCredit.sub(line.baseDebit);current.balance=current.balance.add(movement);balances.set(key,current)}
    const year=await this.prisma.fiscalYear.findFirst({where:{companyId,startDate:{lte:target},endDate:{gte:target}},orderBy:{startDate:'desc'}});
    if(year&&year.status!=='Closed'){
      const nominal=await this.prisma.journalLine.findMany({where:{journal:{companyId,status:{in:['Posted','Reversed']},sourceType:{not:'YearEndClosing'},transactionDate:{gte:year.startDate,lte:target}},account:{type:{in:['Revenue','Expense']}}},include:{account:true}});
      let revenue=new Prisma.Decimal(0),expense=new Prisma.Decimal(0);
      for(const line of nominal){if(line.account.type==='Revenue')revenue=revenue.add(line.baseCredit).sub(line.baseDebit);else expense=expense.add(line.baseDebit).sub(line.baseCredit)}
      balances.set('__CURRENT_YEAR_EARNINGS__',{code:'',name:'Current Year Earnings',type:'Equity',balance:revenue.sub(expense)});
    }
    return [...balances.values()].map(x=>({...x,balance:x.balance.toString()}));
  }

  @RequirePermission('reports.read')
  @Get('inventory-valuation/:companyId')
  async inventoryValuation(@Param('companyId') companyId:string){
    const lots=await this.prisma.inventoryLot.findMany({where:{companyId,remainingQuantity:{gt:0}},include:{item:true,warehouse:true},orderBy:[{item:{code:'asc'}},{receivedDate:'asc'}]});
    return lots.map(l=>({itemCode:l.item.code,itemName:l.item.name,warehouse:l.warehouse.name,receivedDate:l.receivedDate.toISOString().slice(0,10),quantity:l.remainingQuantity.toString(),unitCost:l.unitCost.toString(),value:l.remainingQuantity.mul(l.unitCost).toDecimalPlaces(4).toString()}));
  }

  @RequirePermission('reports.read')
  @Get('account-activity/:companyId')
  async accountActivity(@Param('companyId') companyId:string,@Query('accountId') accountId?:string,@Query('from') from?:string,@Query('to') to?:string){
    return this.prisma.journalLine.findMany({where:{accountId:accountId||undefined,journal:{companyId,status:{in:['Posted','Reversed']},transactionDate:{gte:from?new Date(from):undefined,lte:to?new Date(to):undefined}}},include:{account:true,journal:true},orderBy:{journal:{transactionDate:'asc'}},take:1000});
  }
}
