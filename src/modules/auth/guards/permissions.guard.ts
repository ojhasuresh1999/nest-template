import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ApiError } from '../../../common/errors/api-error';
import { Reflector } from '@nestjs/core';
import { Permission } from '../../../common/enums';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleDocument } from '../../role/schemas/role.schema';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw ApiError.unauthorized('User not authenticated');
    }

    // user.role should be populated by JWT strategy
    const userRole: RoleDocument = user.role;

    if (!userRole || !userRole.permissions) {
      throw ApiError.forbidden('User has no role or permissions assigned');
    }

    // Check if user has at least one of the required permissions
    const hasPermission = requiredPermissions.some((permission) =>
      userRole.permissions.includes(permission),
    );

    if (!hasPermission) {
      throw ApiError.forbidden(
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
