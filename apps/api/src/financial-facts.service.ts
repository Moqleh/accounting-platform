import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type FinancialPeriod = { from: Date; to: Date };

@Injectable()
export class FinancialFactsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertPeriod(period: FinancialPeriod) {
    if (Number.isNaN(period.from.getTime()) || Number.isNaN(period.to.getTime())) throw new BadRequestException('Invalid financial period');
    if (period.from > period.to) throw new BadRequestException('Period start must not be after period end');
    const maxDays = 366 * 3;
    if ((period.to.getTime() - period.from.getTime()) / 86400000 > maxDays) throw new BadRequestException('Financial analysis period is too large');
  }

  private async company(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, baseCurrencyCode: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async salesSummary(companyId: string, period: FinancialPeriod) {
    this.assertPeriod(period);
    const company = await this.company(companyId);
    const aggregate = await this.prisma.salesInvoice.aggregate({
      where: { companyId, status: 'Posted', invoiceDate: { gte: period.from, lte: period.to } },
      _sum: { subtotal: true, taxTotal: true, grandTotal: true },
      _count: { _all: true },
    });
    return {
      source: 'SalesInvoice',
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      currency: company.baseCurrencyCode,
      invoiceCount: aggregate._count._all,
      subtotal: (aggregate._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
      taxTotal: (aggregate._sum.taxTotal ?? new Prisma.Decimal(0)).toString(),
      grandTotal: (aggregate._sum.grandTotal ?? new Prisma.Decimal(0)).toString(),
      caveat: 'Document totals are reported as stored. Use ledger-based facts for base-currency profitability across mixed currencies.',
    };
  }

  async purchasesSummary(companyId: string, period: FinancialPeriod) {
    this.assertPeriod(period);
    const company = await this.company(companyId);
    const aggregate = await this.prisma.purchaseBill.aggregate({
      where: { companyId, status: 'Posted', billDate: { gte: period.from, lte: period.to } },
      _sum: { subtotal: true, taxTotal: true, grandTotal: true },
      _count: { _all: true },
    });
    return {
      source: 'PurchaseBill',
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      currency: company.baseCurrencyCode,
      billCount: aggregate._count._all,
      subtotal: (aggregate._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
      taxTotal: (aggregate._sum.taxTotal ?? new Prisma.Decimal(0)).toString(),
      grandTotal: (aggregate._sum.grandTotal ?? new Prisma.Decimal(0)).toString(),
      caveat: 'Document totals are reported as stored. Use ledger-based facts for base-currency profitability across mixed currencies.',
    };
  }

  async ledgerProfitability(companyId: string, period: FinancialPeriod) {
    this.assertPeriod(period);
    const company = await this.company(companyId);
    const rows = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journal: { companyId, status: 'Posted', transactionDate: { gte: period.from, lte: period.to } },
        account: { companyId, type: { in: [AccountType.Revenue, AccountType.Expense] } },
      },
      _sum: { baseDebit: true, baseCredit: true },
    });
    const accounts = await this.prisma.account.findMany({
      where: { companyId, id: { in: rows.map((row) => row.accountId) } },
      select: { id: true, type: true },
    });
    const typeById = new Map(accounts.map((account) => [account.id, account.type]));
    let revenue = new Prisma.Decimal(0);
    let expenses = new Prisma.Decimal(0);
    for (const row of rows) {
      const debit = row._sum.baseDebit ?? new Prisma.Decimal(0);
      const credit = row._sum.baseCredit ?? new Prisma.Decimal(0);
      if (typeById.get(row.accountId) === AccountType.Revenue) revenue = revenue.add(credit.sub(debit));
      if (typeById.get(row.accountId) === AccountType.Expense) expenses = expenses.add(debit.sub(credit));
    }
    return {
      source: 'GeneralLedger',
      basis: 'posted-journals-base-currency',
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      currency: company.baseCurrencyCode,
      revenue: revenue.toDecimalPlaces(4).toString(),
      expenses: expenses.toDecimalPlaces(4).toString(),
      netIncome: revenue.sub(expenses).toDecimalPlaces(4).toString(),
    };
  }
}
