import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'System Administrator';
  const companyName = required('BOOTSTRAP_COMPANY_NAME');
  const companyId = process.env.BOOTSTRAP_COMPANY_ID?.trim() || randomUUID();
  const currencyCode = (process.env.BOOTSTRAP_BASE_CURRENCY || 'SAR').trim().toUpperCase();
  const currencyName = process.env.BOOTSTRAP_BASE_CURRENCY_NAME?.trim() || currencyCode;
  const currencySymbol = process.env.BOOTSTRAP_BASE_CURRENCY_SYMBOL?.trim() || currencyCode;

  if (password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters');
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('BOOTSTRAP_BASE_CURRENCY must be a 3-letter ISO-style currency code');

  const existingMembership = await prisma.companyMembership.findFirst({
    where: { user: { email }, company: { name: companyName } },
    include: { company: true, user: true },
  });
  if (existingMembership) {
    console.log({ companyId: existingMembership.companyId, userId: existingMembership.userId, alreadyBootstrapped: true });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.currency.upsert({
      where: { code: currencyCode },
      update: {},
      create: { code: currencyCode, name: currencyName, symbol: currencySymbol, decimalPlaces: 2 },
    });
    const company = await tx.company.create({
      data: { id: companyId, name: companyName, taxNumber: process.env.BOOTSTRAP_TAX_NUMBER?.trim() || null, baseCurrencyCode: currencyCode },
    });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await tx.user.upsert({
      where: { email },
      update: { fullName, passwordHash },
      create: { email, fullName, passwordHash },
    });
    await tx.companyMembership.create({ data: { companyId: company.id, userId: user.id, role: 'Owner', dataScope: 'all' } });
    console.log({ companyId: company.id, userId: user.id, alreadyBootstrapped: false });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
