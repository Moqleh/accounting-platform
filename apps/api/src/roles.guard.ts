import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub as string | undefined;
    const companyId = (request.params?.companyId || request.body?.companyId || request.user?.companyId) as string | undefined;
    if (!userId || !companyId) throw new ForbiddenException('Company context is required');
    const membership = await this.prisma.companyMembership.findUnique({ where: { companyId_userId: { companyId, userId } } });
    if (!membership) throw new ForbiddenException('No access to this company');
    request.membership = membership;
    return true;
  }
}
