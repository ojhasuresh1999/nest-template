import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto, GetNotificationsDto, NotificationResponseDto } from './dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get notifications',
    description: 'Retrieves a paginated list of notifications for the authenticated user.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'List of notifications with pagination',
    type: NotificationResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.NOTIFICATION.FETCH_ALL)
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetNotificationsDto,
  ) {
    return this.notificationService.findAll(user.userId, query.page, query.limit, query.isRead);
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get unread count',
    description: 'Returns the number of unread notifications for the authenticated user.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Unread notification count',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.NOTIFICATION.FETCH_ALL)
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.getUnreadCount(user.userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark as read',
    description: 'Marks a specific notification as read.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  @ResponseMessage(RESPONSE_MESSAGES.NOTIFICATION.READ_SUCCESS)
  async markAsRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationService.markAsRead(id, user.userId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all as read',
    description: 'Marks all unread notifications for the authenticated user as read.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.NOTIFICATION.READ_ALL_SUCCESS)
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markAllAsRead(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Deletes a specific notification.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  @ResponseMessage(RESPONSE_MESSAGES.NOTIFICATION.DELETED)
  async deleteNotification(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.notificationService.deleteNotification(id, user.userId);
    return null;
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete all notifications',
    description: 'Deletes all notifications for the authenticated user.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'All notifications deleted',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.NOTIFICATION.DELETED)
  async deleteAllNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.deleteAllNotifications(user.userId);
  }

  @Post('test')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send test notification',
    description: 'Sends a test push notification to the authenticated user.',
  })
  @ApiStandardResponse({
    status: 201,
    description: 'Notification sent',
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ResponseMessage(RESPONSE_MESSAGES.NOTIFICATION.SENT_SUCCESS)
  async testNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNotificationDto,
  ) {
    await this.notificationService.sendNotification({
      userId: user.userId,
      title: dto.title,
      body: dto.body,
      type: dto.type,
      data: dto.data,
      sendPush: true,
    });
    return null;
  }
}
