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
    if ((period.to.getTime() - period.from.getTime()) / 86400000 > 366 * 3) throw new BadRequestException('Financial analysis period is too large');
  }

  private assertAsOf(asOf: Date) {
    if (Number.isNaN(asOf.getTime())) throw new BadRequestException('Invalid as-of date');
  }

  private async company(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, baseCurrencyCode: true } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async salesSummary(companyId: string, period: FinancialPeriod) {
    this.assertPeriod(period);
    const company = await this.company(companyId);
    const aggregate = await this.prisma.salesInvoice.aggregate({ where: { companyId, status: 'Posted', invoiceDate: { gte: period.from, lte: period.to } }, _sum: { subtotal: true, taxTotal: true, grandTotal: true }, _count: { _all: true } });
    return { source: 'SalesInvoice', period: { from: period.from.toISOString(), to: period.to.toISOString() }, currency: company.baseCurrencyCode, invoiceCount: aggregate._count._all, subtotal: (aggregate._sum.subtotal ?? new Prisma.Decimal(0)).toString(), taxTotal: (aggregate._sum.taxTotal ?? new Prisma.Decimal(0)).toString(), grandTotal: (aggregate._sum.grandTotal ?? new Prisma.Decimal(0)).toString(), caveat: 'Document totals are reported as stored. Use ledger-based facts for base-currency profitability across mixed currencies.' };
  }

  async purchasesSummary(companyId: string, period: FinancialPeriod) {
    this.assertPeriod(period);
    const company = await this.company(companyId);
    const aggregate = await this.prisma.purchaseBill.aggregate({ where: { companyId, status: 'Posted', billDate: { gte: period.from, lte: period.to } }, _sum: { subtotal: true, taxTotal: true, grandTotal: true }, _count: { _all: true } });
    return { source: 'PurchaseBill', period: { from: period.from.toISOString(), to: period.to.toISOString() }, currency: company.baseCurrencyCode, billCount: aggregate._count._all, subtotal: (aggregate._sum.subtotal ?? new Prisma.Decimal(0)).toString(), taxTotal: (aggregate._sum.taxTotal ?? new Prisma.Decimal(0)).toString(), grandTotal: (aggregate._sum.grandTotal ?? new Prisma.Decimal(0)).toString(), caveat: 'Document totals are reported as stored. Use ledger-based facts for base-currency profitability across mixed currencies.' };
  }

  async ledgerProfitability(companyId: string, period: FinancialPeriod) {
    this.assertPeriod(period);
    const company = await this.company(companyId);
    const rows = await this.prisma.journalLine.groupBy({ by: ['accountId'], where: { journal: { companyId, status: 'Posted', transactionDate: { gte: period.from, lte: period.to } }, account: { companyId, type: { in: [AccountType.Revenue, AccountType.Expense] } } }, _sum: { baseDebit: true, baseCredit: true } });
    const accounts = await this.prisma.account.findMany({ where: { companyId, id: { in: rows.map(r => r.accountId) } }, select: { id: true, type: true } });
    const typeById = new Map(accounts.map(a => [a.id, a.type]));
    let revenue = new Prisma.Decimal(0), expenses = new Prisma.Decimal(0);
    for (const row of rows) { const debit = row._sum.baseDebit ?? new Prisma.Decimal(0), credit = row._sum.baseCredit ?? new Prisma.Decimal(0); if (typeById.get(row.accountId) === AccountType.Revenue) revenue = revenue.add(credit.sub(debit)); if (typeById.get(row.accountId) === AccountType.Expense) expenses = expenses.add(debit.sub(credit)); }
    return { source: 'GeneralLedger', basis: 'posted-journals-base-currency', period: { from: period.from.toISOString(), to: period.to.toISOString() }, currency: company.baseCurrencyCode, revenue: revenue.toDecimalPlaces(4).toString(), expenses: expenses.toDecimalPlaces(4).toString(), netIncome: revenue.sub(expenses).toDecimalPlaces(4).toString() };
  }

  async customerReceivables(companyId: string, asOf: Date) {
    this.assertAsOf(asOf); const company = await this.company(companyId);
    const rows = await this.prisma.$queryRaw<Array<{ customerId: string; customer: string; balance: Prisma.Decimal }>>(Prisma.sql`
      SELECT c.id AS "customerId", c.name AS customer,
      COALESCE(SUM(jl."baseDebit" - jl."baseCredit"),0)::numeric(18,4) AS balance
      FROM "Customer" c
      JOIN "JournalLine" jl ON jl."customerId"=c.id
      JOIN "Journal" j ON j.id=jl."journalId"
      WHERE c."companyId"=${companyId}::uuid AND j."companyId"=${companyId}::uuid
        AND j.status='Posted' AND j."transactionDate"<=${asOf}
      GROUP BY c.id,c.name
      HAVING COALESCE(SUM(jl."baseDebit" - jl."baseCredit"),0)>0
      ORDER BY balance DESC`);
    const total = rows.reduce((sum, r) => sum.add(r.balance), new Prisma.Decimal(0));
    return { source: 'GeneralLedgerCustomerSubledger', asOf: asOf.toISOString(), currency: company.baseCurrencyCode, total: total.toString(), customers: rows.slice(0, 20).map(r => ({ customerId: r.customerId, customer: r.customer, balance: r.balance.toString() })), truncated: rows.length > 20 };
  }

  async supplierPayables(companyId: string, asOf: Date) {
    this.assertAsOf(asOf); const company = await this.company(companyId);
    const rows = await this.prisma.$queryRaw<Array<{ supplierId: string; supplier: string; balance: Prisma.Decimal }>>(Prisma.sql`
      SELECT s.id AS "supplierId", s.name AS supplier,
      COALESCE(SUM(jl."baseCredit" - jl."baseDebit"),0)::numeric(18,4) AS balance
      FROM "Supplier" s
      JOIN "JournalLine" jl ON jl."supplierId"=s.id
      JOIN "Journal" j ON j.id=jl."journalId"
      WHERE s."companyId"=${companyId}::uuid AND j."companyId"=${companyId}::uuid
        AND j.status='Posted' AND j."transactionDate"<=${asOf}
      GROUP BY s.id,s.name
      HAVING COALESCE(SUM(jl."baseCredit" - jl."baseDebit"),0)>0
      ORDER BY balance DESC`);
    const total = rows.reduce((sum, r) => sum.add(r.balance), new Prisma.Decimal(0));
    return { source: 'GeneralLedgerSupplierSubledger', asOf: asOf.toISOString(), currency: company.baseCurrencyCode, total: total.toString(), suppliers: rows.slice(0, 20).map(r => ({ supplierId: r.supplierId, supplier: r.supplier, balance: r.balance.toString() })), truncated: rows.length > 20 };
  }

  async bankBalances(companyId: string, asOf: Date) {
    this.assertAsOf(asOf); const company = await this.company(companyId);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; code: string; name: string; currency: string; balance: Prisma.Decimal }>>(Prisma.sql`
      SELECT b.id,b.code,b.name,b.currency,
      COALESCE(SUM(CASE WHEN j.status='Posted' AND j."transactionDate"<=${asOf} THEN jl."baseDebit"-jl."baseCredit" ELSE 0 END),0)::numeric(18,4) AS balance
      FROM "BankAccount" b
      LEFT JOIN "JournalLine" jl ON jl."accountId"=b."accountId"
      LEFT JOIN "Journal" j ON j.id=jl."journalId" AND j."companyId"=${companyId}::uuid
      WHERE b."companyId"=${companyId}::uuid
      GROUP BY b.id,b.code,b.name,b.currency ORDER BY b.code`);
    const totalBase = rows.reduce((sum, r) => sum.add(r.balance), new Prisma.Decimal(0));
    return { source: 'GeneralLedgerBankAccounts', basis: 'base-currency-ledger-balance', asOf: asOf.toISOString(), currency: company.baseCurrencyCode, totalBase: totalBase.toString(), accounts: rows.map(r => ({ id: r.id, code: r.code, name: r.name, accountCurrency: r.currency, baseCurrencyBalance: r.balance.toString() })) };
  }

  async profitabilityComparison(companyId: string, first: FinancialPeriod, second: FinancialPeriod) {
    this.assertPeriod(first); this.assertPeriod(second);
    const [a, b] = await Promise.all([this.ledgerProfitability(companyId, first), this.ledgerProfitability(companyId, second)]);
    const change = (current: string, previous: string) => { const c = new Prisma.Decimal(current), p = new Prisma.Decimal(previous); return { amount: c.sub(p).toDecimalPlaces(4).toString(), percent: p.eq(0) ? null : c.sub(p).div(p.abs()).mul(100).toDecimalPlaces(2).toString() }; };
    return { source: 'GeneralLedger', currency: a.currency, first: a, second: b, change: { revenue: change(a.revenue, b.revenue), expenses: change(a.expenses, b.expenses), netIncome: change(a.netIncome, b.netIncome) }, note: 'Percent change is null when the comparison-period value is zero.' };
  }
}
