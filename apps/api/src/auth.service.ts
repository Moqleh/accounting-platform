import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { memberships: { include: { company: true } } },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const memberships = user.memberships.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      role: m.role,
      dataScope: m.dataScope,
    }));
    const defaultCompanyId = memberships[0]?.companyId;
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, companyId: defaultCompanyId });
    return { token, user: { id: user.id, email: user.email, fullName: user.fullName }, memberships, defaultCompanyId };
  }
}
