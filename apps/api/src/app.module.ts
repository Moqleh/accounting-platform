import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AccountingController } from './accounting.controller';
import { ErpController } from './erp.controller';
import { AgingController } from './aging.controller';
import { SalesController } from './sales.controller';
import { PurchasesController } from './purchases.controller';
import { PaymentsController } from './payments.controller';
import { CreditNotesController } from './credit-notes.controller';
import { DebitNotesController } from './debit-notes.controller';
import { YearEndController } from './year-end.controller';
import { AdminController } from './admin.controller';
import { BankingController } from './banking.controller';
import { AuthController } from './auth.controller';
import { AiFinancialController } from './ai-financial.controller';
import { AccountingService } from './accounting.service';
import { SalesService } from './sales.service';
import { PurchasesService } from './purchases.service';
import { PaymentsService } from './payments.service';
import { CreditNotesService } from './credit-notes.service';
import { DebitNotesService } from './debit-notes.service';
import { YearEndService } from './year-end.service';
import { AuthService } from './auth.service';
import { IdempotencyService } from './idempotency.service';
import { PostingConfigService } from './posting-config.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard } from './permission.guard';
import { AiFinancialAccessGuard } from './ai-financial-access.guard';
import { TenantPrismaService } from './tenant-prisma.service';
import { PrismaService } from './prisma.service';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 24) {
  throw new Error('JWT_SECRET must be configured with at least 24 characters');
}

@Module({
  imports: [JwtModule.register({ global: true, secret: jwtSecret, signOptions: { expiresIn: '8h' } })],
  controllers: [AppController, AuthController, AccountingController, ErpController, AgingController, SalesController, PurchasesController, PaymentsController, CreditNotesController, DebitNotesController, YearEndController, AdminController, BankingController, AiFinancialController],
  providers: [PrismaService, TenantPrismaService, AuthService, IdempotencyService, PostingConfigService, JwtAuthGuard, RolesGuard, PermissionGuard, AiFinancialAccessGuard, AccountingService, SalesService, PurchasesService, PaymentsService, CreditNotesService, DebitNotesService, YearEndService],
})
export class AppModule {}
