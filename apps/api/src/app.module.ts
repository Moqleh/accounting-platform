import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AccountingController } from './accounting.controller';
import { ErpController } from './erp.controller';
import { AccountingService } from './accounting.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [AppController, AccountingController, ErpController],
  providers: [PrismaService, AccountingService],
})
export class AppModule {}
