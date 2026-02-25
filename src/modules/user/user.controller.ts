import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RESPONSE_MESSAGES } from 'src/common/constants/response-messages.constant';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { UserRole } from 'src/common/enums';
import type { AuthenticatedUser } from '../auth/decorators';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.USER)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('my-profile')
  @ApiOperation({ summary: 'Get my profile' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.USER_FETCHED)
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getMyProfile(user.userId);
  }
}
