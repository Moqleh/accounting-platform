import { BadRequestException, Injectable } from '@nestjs/common';
import { FinancialAiQuery, FinancialAiQueryService } from './financial-ai-query.service';

@Injectable()
export class FinancialAiAnswerService {
  constructor(private readonly queries: FinancialAiQueryService) {}

  private monthPeriod(offset = 0) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  private classify(question: string): FinancialAiQuery {
    const q = question.trim().toLowerCase();
    if (!q || q.length > 500) throw new BadRequestException('Question must contain between 1 and 500 characters');
    const current = this.monthPeriod(0), previous = this.monthPeriod(-1), asOf = new Date().toISOString().slice(0, 10);
    const comparison = /(قارن|مقارنة|مقابل|الشهر السابق|compare|previous month|last month)/.test(q);
    if (/(ذمم.*مدين|مديون.*عملا|عملاء.*مدين|تحصيل|receivable|customers owe|customer debt)/.test(q)) return { intent: 'receivables', asOf };
    if (/(ذمم.*دائن|مورد.*مستحق|مستحق.*مورد|payable|suppliers owe|supplier debt)/.test(q)) return { intent: 'payables', asOf };
    if (/(بنك|بنوك|رصيد.*بن|أرصدة.*بن|bank balance|cash at bank)/.test(q)) return { intent: 'bank-balances', asOf };
    if (/(ربح|ربحية|صافي الدخل|إيراد|مصروف|profit|income|revenue|expense)/.test(q)) {
      return comparison ? { intent: 'profitability-comparison', ...current, compareFrom: previous.from, compareTo: previous.to } : { intent: 'profitability', ...current };
    }
    throw new BadRequestException('Question is outside the supported read-only financial analysis scope');
  }

  private arNumber(value: unknown) { return typeof value === 'string' ? value : String(value ?? '0'); }

  private explain(intent: string, facts: any, language: 'ar' | 'en') {
    if (language === 'en') {
      if (intent === 'profitability') return `For the selected period, revenue is ${facts.revenue} ${facts.currency}, expenses are ${facts.expenses} ${facts.currency}, and net income is ${facts.netIncome} ${facts.currency}.`;
      if (intent === 'profitability-comparison') return `Net income is ${facts.first.netIncome} ${facts.currency} versus ${facts.second.netIncome} ${facts.currency}; the change is ${facts.change.netIncome.amount} ${facts.currency}${facts.change.netIncome.percent===null?'':` (${facts.change.netIncome.percent}%)`}.`;
      if (intent === 'receivables') return `Total customer receivables are ${facts.total} ${facts.currency} as of ${facts.asOf.slice(0,10)}.`;
      if (intent === 'payables') return `Total supplier payables are ${facts.total} ${facts.currency} as of ${facts.asOf.slice(0,10)}.`;
      if (intent === 'bank-balances') return `Total bank ledger balance is ${facts.totalBase} ${facts.currency} as of ${facts.asOf.slice(0,10)}.`;
    }
    if (intent === 'profitability') return `خلال الفترة المحددة، بلغت الإيرادات ${this.arNumber(facts.revenue)} ${facts.currency}، والمصروفات ${this.arNumber(facts.expenses)} ${facts.currency}، وصافي الدخل ${this.arNumber(facts.netIncome)} ${facts.currency}.`;
    if (intent === 'profitability-comparison') return `صافي الدخل للفترة الحالية ${facts.first.netIncome} ${facts.currency} مقابل ${facts.second.netIncome} ${facts.currency} للفترة السابقة، والتغير ${facts.change.netIncome.amount} ${facts.currency}${facts.change.netIncome.percent===null?'':` (${facts.change.netIncome.percent}%)`}.`;
    if (intent === 'receivables') return `إجمالي الذمم المدينة على العملاء هو ${facts.total} ${facts.currency} كما في ${facts.asOf.slice(0,10)}.`;
    if (intent === 'payables') return `إجمالي الذمم الدائنة للموردين هو ${facts.total} ${facts.currency} كما في ${facts.asOf.slice(0,10)}.`;
    if (intent === 'bank-balances') return `إجمالي أرصدة البنوك حسب دفتر الأستاذ هو ${facts.totalBase} ${facts.currency} كما في ${facts.asOf.slice(0,10)}.`;
    throw new BadRequestException('Unsupported answer intent');
  }

  async answer(companyId: string, question: string, language: 'ar' | 'en' = 'ar') {
    const query = this.classify(question);
    const facts = await this.queries.execute(companyId, query);
    return { answer: this.explain(query.intent, facts, language), intent: query.intent, facts, generatedFrom: 'deterministic-financial-facts', modelUsed: false, disclaimer: language === 'en' ? 'Read-only management analysis; verify source records before making material financial decisions.' : 'تحليل إداري للقراءة فقط؛ راجع المستندات والسجلات المصدرية قبل القرارات المالية الجوهرية.' };
  }
}
