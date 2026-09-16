import { BadRequestException } from '@nestjs/common';
import { FinancialAiQueryService } from './financial-ai-query.service';

describe('FinancialAiQueryService', () => {
  const facts = {
    ledgerProfitability: jest.fn(), profitabilityComparison: jest.fn(), customerReceivables: jest.fn(), supplierPayables: jest.fn(), bankBalances: jest.fn(),
  } as any;
  const service = new FinancialAiQueryService(facts);

  beforeEach(() => jest.clearAllMocks());

  it('routes an allowlisted profitability intent only', async () => {
    facts.ledgerProfitability.mockResolvedValue({ netIncome: '10' });
    await expect(service.execute('company-a', { intent: 'profitability', from: '2026-09-01', to: '2026-09-30' })).resolves.toEqual({ netIncome: '10' });
    expect(facts.ledgerProfitability).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown intents instead of executing arbitrary operations', async () => {
    await expect(service.execute('company-a', { intent: 'sql' as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects malformed and impossible dates', async () => {
    await expect(service.execute('company-a', { intent: 'receivables', asOf: '09/30/2026' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.execute('company-a', { intent: 'receivables', asOf: '2026-02-31' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
