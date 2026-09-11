import { Body,Controller,Get,Headers,Param,Post,Req,UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DebitNotesService } from './debit-notes.service';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard,RequirePermission } from './permission.guard';
@UseGuards(JwtAuthGuard,RolesGuard,PermissionGuard)@Controller('debit-notes')
export class DebitNotesController{constructor(private readonly service:DebitNotesService,private readonly prisma:PrismaService){}
 @RequirePermission('purchases.write')@Post() create(@Req() req:any,@Headers('idempotency-key') key:string|undefined,@Body() body:{companyId:string;purchaseBillId:string;warehouseId:string;debitDate:string;reason:string;lines:Array<{purchaseBillLineId:string;quantity:string}>}){return this.service.createAndPost({...body,debitDate:new Date(body.debitDate),postedById:req.user.sub},key)}
 @RequirePermission('purchases.read')@Get(':companyId') list(@Param('companyId') companyId:string){return this.prisma.$queryRaw<Array<Record<string,unknown>>>(Prisma.sql`SELECT d.id,d."debitNoteNumber",d."purchaseBillId",d."debitDate",d.subtotal,d."taxTotal",d."grandTotal",d.reason,d.status,s.name supplier,j."currencyCode",j."exchangeRate" FROM "DebitNote" d JOIN "Supplier" s ON s.id=d."supplierId" LEFT JOIN "Journal" j ON j."sourceType"='DebitNote'::"JournalSourceType" AND j."sourceId"=d.id::text WHERE d."companyId"=${companyId}::uuid ORDER BY d."debitDate" DESC`)}
}
