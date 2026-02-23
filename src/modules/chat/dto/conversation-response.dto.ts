import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UserSummary {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  profileImage?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email?: string;
}

export class ConversationResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;

  @ApiProperty({ type: [UserSummary] })
  participants: UserSummary[];

  @ApiProperty({ example: 'Hey, how are you doing?' })
  lastMessage: string;

  @ApiProperty({ type: UserSummary })
  lastMessageSender: UserSummary;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  lastMessageAt: Date;

  @ApiProperty({
    description: 'Unread message count for the current user',
    example: 3,
  })
  unreadCount: number;

  @ApiProperty({
    description: 'The other participant in the conversation',
    type: UserSummary,
  })
  otherParticipant: UserSummary;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

export class ConversationsListResponseDto {
  @ApiProperty({ type: [ConversationResponseDto] })
  conversations: ConversationResponseDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 2 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasMore: boolean;

  @ApiProperty({
    description: 'Total unread messages across all conversations',
    example: 10,
  })
  totalUnread: number;
}
