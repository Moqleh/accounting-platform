import { ForbiddenException } from '@nestjs/common';
import { AiFinancialAccessGuard } from './ai-financial-access.guard';

function context(userId = 'user-a', companyId = 'company-a') {
  const request: any = { user: { sub: userId }, params: { companyId } };
  return { request, ctx: { switchToHttp: () => ({ getRequest: () => request }) } as any };
}

describe('AiFinancialAccessGuard', () => {
  it.each(['Owner', 'FinancialManager'])('allows %s only with a matching database membership', async (role) => {
    const prisma: any = { companyMembership: { findUnique: jest.fn().mockResolvedValue({ id: 'm1', companyId: 'company-a', userId: 'user-a', role, dataScope: null }) } };
    const guard = new AiFinancialAccessGuard(prisma); const { request, ctx } = context();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.companyMembership.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId_userId: { companyId: 'company-a', userId: 'user-a' } } }));
    expect(request.aiCompanyId).toBe('company-a');
  });

  it.each(['Admin', 'Accountant', 'Sales', 'Purchases', 'Employee'])('denies %s', async (role) => {
    const prisma: any = { companyMembership: { findUnique: jest.fn().mockResolvedValue({ id: 'm1', companyId: 'company-a', userId: 'user-a', role, dataScope: null }) } };
    await expect(new AiFinancialAccessGuard(prisma).canActivate(context().ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies access when no membership exists for the requested company', async () => {
    const prisma: any = { companyMembership: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(new AiFinancialAccessGuard(prisma).canActivate(context('user-a', 'company-b').ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
