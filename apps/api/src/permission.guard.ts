import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from './permissions';

export const RequirePermission = (permission: string) => SetMetadata('permission', permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<string>('permission', [context.getHandler(), context.getClass()]);
    if (!permission) return true;
    const membership = context.switchToHttp().getRequest().membership;
    if (!membership || !hasPermission(membership.role, permission)) throw new ForbiddenException('Insufficient permission');
    return true;
  }
}
