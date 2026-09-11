import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AccountingController } from './accounting.controller';
import { ErpController } from './erp.controller';
import { SalesController } from './sales.controller';
import { AccountingService } from './accounting.service';
import { SalesService } from './sales.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [AppController, AccountingController, ErpController, SalesController],
  providers: [PrismaService, AccountingService, SalesService],
})
export class AppModule {}
