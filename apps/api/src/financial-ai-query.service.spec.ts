import { BadRequestException } from '@nestjs/common';
import { FinancialAiQueryService } from './financial-ai-query.service';

describe('FinancialAiQueryService', () => {
  const facts = {
    ledgerProfitability: jest.fn(), profitabilityComparison: jest.fn(),
    customerReceivables: jest.fn(), supplierPayables: jest.fn(), bankBalances: jest.fn(),
  } as any;
  let service: FinancialAiQueryService;

  beforeEach(() => { jest.clearAllMocks(); service = new FinancialAiQueryService(facts); });

  it('routes only an allowlisted profitability intent', async () => {
    facts.ledgerProfitability.mockResolvedValue({ netIncome: '10' });
    await service.execute('company-a', { intent: 'profitability', from: '2026-09-01', to: '2026-09-30' });
    expect(facts.ledgerProfitability).toHaveBeenCalledTimes(1);
    expect(facts.ledgerProfitability.mock.calls[0][0]).toBe('company-a');
  });

  it('rejects an unsupported intent', async () => {
    await expect(service.execute('company-a', { intent: 'run-sql' as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects malformed and impossible dates', async () => {
    await expect(service.execute('company-a', { intent: 'receivables', asOf: '09/30/2026' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.execute('company-a', { intent: 'receivables', asOf: '2026-02-31' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses only the trusted route company id', async () => {
    facts.bankBalances.mockResolvedValue({ totalBase: '0' });
    await service.execute('trusted-company', { intent: 'bank-balances', asOf: '2026-09-30', companyId: 'attacker-company' } as any);
    expect(facts.bankBalances).toHaveBeenCalledWith('trusted-company', expect.any(Date));
  });
});
