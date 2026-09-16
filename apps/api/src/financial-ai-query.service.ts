import { BadRequestException, Injectable } from '@nestjs/common';
import { FinancialFactsService, FinancialPeriod } from './financial-facts.service';

export type FinancialAiIntent =
  | 'profitability'
  | 'profitability-comparison'
  | 'receivables'
  | 'payables'
  | 'bank-balances';

export type FinancialAiQuery = {
  intent: FinancialAiIntent;
  from?: string;
  to?: string;
  compareFrom?: string;
  compareTo?: string;
  asOf?: string;
};

@Injectable()
export class FinancialAiQueryService {
  constructor(private readonly facts: FinancialFactsService) {}

  private date(value: string | undefined, label: string, endOfDay = false) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${label} must use YYYY-MM-DD`);
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException(`Invalid ${label}`);
    return date;
  }

  private period(from?: string, to?: string): FinancialPeriod {
    return { from: this.date(from, 'from'), to: this.date(to, 'to', true) };
  }

  async execute(companyId: string, query: FinancialAiQuery) {
    // Closed routing only: no model-generated SQL, table names, field names, or arbitrary functions.
    switch (query.intent) {
      case 'profitability':
        return this.facts.ledgerProfitability(companyId, this.period(query.from, query.to));
      case 'profitability-comparison':
        return this.facts.profitabilityComparison(companyId, this.period(query.from, query.to), this.period(query.compareFrom, query.compareTo));
      case 'receivables':
        return this.facts.customerReceivables(companyId, this.date(query.asOf, 'asOf', true));
      case 'payables':
        return this.facts.supplierPayables(companyId, this.date(query.asOf, 'asOf', true));
      case 'bank-balances':
        return this.facts.bankBalances(companyId, this.date(query.asOf, 'asOf', true));
      default:
        throw new BadRequestException('Unsupported financial AI intent');
    }
  }
}
