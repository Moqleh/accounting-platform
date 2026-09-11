import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AccountingController } from './accounting.controller';
import { ErpController } from './erp.controller';
import { SalesController } from './sales.controller';
import { PurchasesController } from './purchases.controller';
import { PaymentsController } from './payments.controller';
import { YearEndController } from './year-end.controller';
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { AccountingService } from './accounting.service';
import { SalesService } from './sales.service';
import { PurchasesService } from './purchases.service';
import { PaymentsService } from './payments.service';
import { YearEndService } from './year-end.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard } from './permission.guard';
import { TenantPrismaService } from './tenant-prisma.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-only-change-me',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AppController, AuthController, AccountingController, ErpController, SalesController, PurchasesController, PaymentsController, YearEndController, AdminController],
  providers: [PrismaService, TenantPrismaService, AuthService, JwtAuthGuard, RolesGuard, PermissionGuard, AccountingService, SalesService, PurchasesService, PaymentsService, YearEndService],
})
export class AppModule {}
