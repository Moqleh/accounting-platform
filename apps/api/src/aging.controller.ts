import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';

@UseGuards(JwtAuthGuard,RolesGuard,PermissionGuard)
@RequirePermission('reports.read')
@Controller('reports')
export class AgingController{
  constructor(private readonly prisma:PrismaService){}

  @Get('customer-aging/:companyId')
  async customerAging(@Param('companyId') companyId:string,@Query('asOf') asOf?:string){
    const date=asOf?new Date(asOf):new Date();
    const invoices=await this.prisma.salesInvoice.findMany({where:{companyId,status:'Posted',invoiceDate:{lte:date}},include:{customer:true},orderBy:{invoiceDate:'asc'}});
    const rows=[] as Array<Record<string,string|number>>;
    for(const invoice of invoices){
      const allocations=await this.prisma.$queryRaw<Array<{paid:Prisma.Decimal;credited:Prisma.Decimal}>>`SELECT COALESCE((SELECT SUM(pa.amount) FROM "PaymentAllocation" pa JOIN "Journal" j ON j.id=pa."journalId" WHERE pa."salesInvoiceId"=${invoice.id}::uuid AND j.status IN ('Posted','Reversed') AND j."transactionDate"<=${date}),0) paid,COALESCE((SELECT SUM(c."grandTotal") FROM "CreditNote" c WHERE c."invoiceId"=${invoice.id}::uuid AND c.status='Posted' AND c."creditDate"<=${date}),0) credited`;
      const outstanding=invoice.grandTotal.sub(allocations[0]?.paid??0).sub(allocations[0]?.credited??0);if(outstanding.lte(0))continue;
      const days=Math.max(0,Math.floor((date.getTime()-invoice.invoiceDate.getTime())/86400000));
      rows.push({invoiceId:invoice.id,invoiceNumber:invoice.invoiceNumber,customerId:invoice.customerId,customer:invoice.customer.name,invoiceDate:invoice.invoiceDate.toISOString(),days,outstanding:outstanding.toString(),bucket:days<=30?'0-30':days<=60?'31-60':days<=90?'61-90':'90+'});
    }
    return rows;
  }

  @Get('supplier-aging/:companyId')
  async supplierAging(@Param('companyId') companyId:string,@Query('asOf') asOf?:string){
    const date=asOf?new Date(asOf):new Date();
    const bills=await this.prisma.purchaseBill.findMany({where:{companyId,status:'Posted',billDate:{lte:date}},include:{supplier:true},orderBy:{billDate:'asc'}});
    const rows=[] as Array<Record<string,string|number>>;
    for(const bill of bills){
      const allocations=await this.prisma.$queryRaw<Array<{paid:Prisma.Decimal}>>`SELECT COALESCE(SUM(pa.amount),0) paid FROM "PaymentAllocation" pa JOIN "Journal" j ON j.id=pa."journalId" WHERE pa."purchaseBillId"=${bill.id}::uuid AND j.status IN ('Posted','Reversed') AND j."transactionDate"<=${date}`;
      const outstanding=bill.grandTotal.sub(allocations[0]?.paid??0);if(outstanding.lte(0))continue;
      const days=Math.max(0,Math.floor((date.getTime()-bill.billDate.getTime())/86400000));
      rows.push({billId:bill.id,billNumber:bill.billNumber,supplierId:bill.supplierId,supplier:bill.supplier.name,billDate:bill.billDate.toISOString(),days,outstanding:outstanding.toString(),bucket:days<=30?'0-30':days<=60?'31-60':days<=90?'61-90':'90+'});
    }
    return rows;
  }

  @Get('credit-notes/:companyId')
  creditNotes(@Param('companyId') companyId:string){
    return this.prisma.$queryRaw<Array<Record<string,unknown>>>`SELECT c.id,c."creditNoteNumber",c."invoiceId",c."creditDate",c.subtotal,c."taxTotal",c."grandTotal",c.reason,c.status,cu.name customer FROM "CreditNote" c JOIN "Customer" cu ON cu.id=c."customerId" WHERE c."companyId"=${companyId}::uuid ORDER BY c."creditDate" DESC`;
  }
}
