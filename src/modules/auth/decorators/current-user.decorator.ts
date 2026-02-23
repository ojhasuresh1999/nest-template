import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Brand } from '../../../common/enums';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  deviceId: string;
  brand: Brand;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    const user = request.user as AuthenticatedUser;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
