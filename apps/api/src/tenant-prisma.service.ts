import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { setTenantContext } from './company-context';

@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}
  run<T>(companyId: string, userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      await setTenantContext(tx, companyId, userId);
      return fn(tx);
    });
  }
}
