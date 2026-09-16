import { BadRequestException } from '@nestjs/common';
import { FinancialFactsService } from './financial-facts.service';

describe('FinancialFactsService safety', () => {
  const prisma: any = {};
  const service = new FinancialFactsService(prisma);

  it('rejects inverted periods before touching the database', async () => {
    await expect(service.ledgerProfitability('company-a', { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-09-01T00:00:00Z') })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects excessively broad analysis periods before touching the database', async () => {
    await expect(service.ledgerProfitability('company-a', { from: new Date('2020-01-01T00:00:00Z'), to: new Date('2026-09-01T00:00:00Z') })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid as-of dates before touching the database', async () => {
    await expect(service.bankBalances('company-a', new Date('invalid'))).rejects.toBeInstanceOf(BadRequestException);
  });
});
