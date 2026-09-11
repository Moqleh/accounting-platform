import { Prisma } from '@prisma/client';

export async function setTenantContext(tx: Prisma.TransactionClient, companyId: string, userId: string) {
  await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
}
