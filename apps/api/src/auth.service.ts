import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private async buildSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { company: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const memberships = user.memberships.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      role: m.role,
      dataScope: m.dataScope,
    }));
    const defaultCompanyId = memberships[0]?.companyId;
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      email: user.email,
      memberships,
      defaultCompanyId,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const session = await this.buildSession(user.id);
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, companyId: session.defaultCompanyId });
    return { token, ...session };
  }

  async me(userId: string) {
    return this.buildSession(userId);
  }

  async changePassword(userId:string,currentPassword:string,newPassword:string){
    if(!newPassword||newPassword.length<10) throw new BadRequestException('New password must contain at least 10 characters');
    const user=await this.prisma.user.findUnique({where:{id:userId}});
    if(!user?.passwordHash||!(await bcrypt.compare(currentPassword,user.passwordHash))) throw new UnauthorizedException('Current password is incorrect');
    if(await bcrypt.compare(newPassword,user.passwordHash)) throw new BadRequestException('New password must be different');
    const passwordHash=await bcrypt.hash(newPassword,12);
    await this.prisma.user.update({where:{id:userId},data:{passwordHash}});
    return {changed:true};
  }
}
