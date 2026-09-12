import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard, RequirePermission } from './permission.guard';
import { CreateSalesInvoiceDto } from './dto/accounting-documents.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @RequirePermission('sales.write')
  @Post('invoice')
  create(
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateSalesInvoiceDto,
  ) {
    return this.sales.createAndPost(
      { ...body, postedById: req.user.sub, invoiceDate: new Date(body.invoiceDate) },
      idempotencyKey,
    );
  }
}
