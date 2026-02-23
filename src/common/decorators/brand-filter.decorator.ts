import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../common/enums';

export const BrandFilter = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  const query = request.query || {};

  if (!user) {
    return query;
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    return query;
  }

  return {
    ...query,
    brand: user.brand,
  };
});
