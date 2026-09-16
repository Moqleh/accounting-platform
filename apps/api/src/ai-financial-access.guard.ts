import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Server-side authorization boundary for the Financial AI Copilot.
 * This guard intentionally does not trust a role supplied by the client or JWT.
 * It re-loads the company membership from the database on every protected request.
 */
@Injectable()
export class AiFinancialAccessGuard implements CanActivate {
  private static readonly ALLOWED_ROLES = new Set(['Owner', 'FinancialManager']);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub as string | undefined;
    const companyId = request.params?.companyId as string | undefined;

    if (!userId || !companyId) {
      throw new ForbiddenException('Authenticated company context is required');
    }

    const membership = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { id: true, companyId: true, userId: true, role: true, dataScope: true },
    });

    if (!membership) throw new ForbiddenException('No access to this company');
    if (!AiFinancialAccessGuard.ALLOWED_ROLES.has(membership.role)) {
      throw new ForbiddenException('Financial AI is restricted to the company owner and financial manager');
    }

    request.membership = membership;
    request.aiCompanyId = companyId;
    return true;
  }
}
