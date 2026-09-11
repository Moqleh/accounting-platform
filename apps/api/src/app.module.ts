import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AccountingController } from './accounting.controller';
import { ErpController } from './erp.controller';
import { SalesController } from './sales.controller';
import { PurchasesController } from './purchases.controller';
import { PaymentsController } from './payments.controller';
import { AccountingService } from './accounting.service';
import { SalesService } from './sales.service';
import { PurchasesService } from './purchases.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [AppController, AccountingController, ErpController, SalesController, PurchasesController, PaymentsController],
  providers: [PrismaService, AccountingService, SalesService, PurchasesService, PaymentsService],
})
export class AppModule {}
