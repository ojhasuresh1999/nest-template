import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ApiError } from '../../../common/errors/api-error';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/common/enums';
import { ROLES_KEY, IS_PUBLIC_KEY, IS_OPTIONAL_AUTH_KEY } from '../decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (isOptionalAuth) {
        return true;
      }

      throw ApiError.unauthorized('User not authenticated');
    }

    const userRole = user.role as any;
    const roleName = userRole?.name || userRole;
    const hasRole = requiredRoles.some((role) => roleName === role);

    if (!hasRole) {
      throw ApiError.forbidden(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
