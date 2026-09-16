import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    // AppModule validates JWT_SECRET at startup. Never fall back to a known
    // development secret here: verification must use the configured secret.
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 24) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    try {
      request.user = await this.jwt.verifyAsync(token, { secret });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
