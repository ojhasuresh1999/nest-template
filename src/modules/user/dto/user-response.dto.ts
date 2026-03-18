import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileResponseDto {
  @ApiProperty() _id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional() phone: string;
  @ApiPropertyOptional() profileImage: string;
  @ApiProperty() slug: string;
  @ApiProperty() status: string;
  @ApiProperty() isEmailVerified: boolean;
  @ApiProperty() isPhoneVerified: boolean;
}

export class AdminUserStatsResponseDto {
  @ApiProperty({ type: [Object] }) byRole: Record<string, number>[];
  @ApiProperty({ type: [Object] }) byStatus: Record<string, number>[];
  @ApiProperty() totalUsers: number;
}
