import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RESPONSE_MESSAGES } from 'src/common/constants/response-messages.constant';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { UserRole } from 'src/common/enums';
import type { AuthenticatedUser } from '../auth/decorators';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { UpdateProfileDto } from './dto';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.USER, UserRole.EXPERT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('my-profile')
  @ApiOperation({ summary: 'Get my profile' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.PROFILE_FETCHED)
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getMyProfile(user.userId);
  }

  @Patch('my-profile')
  @ApiOperation({ summary: 'Update my profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ResponseMessage(RESPONSE_MESSAGES.USER.PROFILE_UPDATED)
  async updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.userService.updateMyProfile(user.userId, dto);
  }

  @Get('profile/:id')
  @ApiOperation({ summary: 'View user profile by ID' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.PROFILE_FETCHED)
  async viewProfile(@Param('id') id: string) {
    return this.userService.viewPublicProfile(id);
  }
}
