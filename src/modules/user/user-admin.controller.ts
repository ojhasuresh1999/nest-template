import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { CacheInvalidate, CacheInvalidationInterceptor, CachePrefix } from '../../common/cache';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { StatusChangeDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums';
import { CustomCacheInterceptor } from '../../common/interceptors/custom-cache.interceptor';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AdminListUsersDto,
  AdminUpdateUserDto,
  AdminUserStatsResponseDto,
  UserProfileResponseDto,
} from './dto';
import { UserService } from './user.service';

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UseInterceptors(CustomCacheInterceptor, CacheInvalidationInterceptor)
@CachePrefix('users')
@Controller({ path: 'admin/users', version: '1' })
export class UserAdminController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Admin list users with pagination and role filter' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.USERS_FETCHED)
  async findAll(@Query() query: AdminListUsersDto) {
    return this.userService.adminListUsers(query);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Admin get user statistics by role and status' })
  @ApiStandardResponse({
    status: 200,
    description: 'User statistics',
    type: AdminUserStatsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.USERS_FETCHED)
  async getStats() {
    return this.userService.adminGetStats();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Admin get user profile by ID' })
  @ApiStandardResponse({
    status: 200,
    description: 'User profile details',
    type: UserProfileResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.USER_FETCHED)
  async findOne(@Param('id') id: string) {
    return this.userService.adminGetUser(id);
  }

  @Patch(':id')
  @CacheInvalidate('users')
  @ApiOperation({
    summary: 'Admin update user',
    description: 'Admin can update user details',
  })
  @ApiBody({ type: AdminUpdateUserDto })
  @ApiStandardResponse({
    status: 200,
    description: 'User updated',
    type: UserProfileResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.PROFILE_UPDATED)
  async update(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.userService.adminUpdateUser(id, dto);
  }

  @Patch(':id/status')
  @CacheInvalidate('users')
  @ApiOperation({
    summary: 'Admin update user status',
    description: 'Admin can toggle user status (Active/Inactive)',
  })
  @ApiBody({ type: StatusChangeDto })
  @ApiStandardResponse({
    status: 200,
    description: 'User status updated',
    type: UserProfileResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.STATUS_UPDATED)
  async updateStatus(@Param('id') id: string, @Body() statusDto: StatusChangeDto) {
    return this.userService.adminUpdateStatus(id, statusDto);
  }

  @Delete(':id')
  @CacheInvalidate('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin soft-delete user',
    description: 'Admin can soft-delete a user account',
  })
  @ApiStandardResponse({ status: 200, description: 'User deleted' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ResponseMessage(RESPONSE_MESSAGES.USER.USER_FETCHED)
  async remove(@Param('id') id: string) {
    return this.userService.adminSoftDeleteUser(id);
  }
}
