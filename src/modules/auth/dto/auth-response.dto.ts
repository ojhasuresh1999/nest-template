import { UserRole } from 'src/common/enums';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDataDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Access Token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Refresh Token',
  })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer', description: 'Token Type' })
  tokenType: string;

  @ApiProperty({ example: '15m', description: 'Token Expiration Time' })
  expiresIn: string;

  @ApiProperty({
    example: {
      id: '507f1f77bcf86cd799439011',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      fullName: 'John Doe',
      phone: '1234567890',
      profileImage: 'https://example.com/profile.jpg',
      isEmailVerified: true,
      isPhoneVerified: true,
    },
    description: 'User details',
  })
  user: {
    id: string;
    email: string;
    lastName: string;
    role: string | null;
    firstName: string;
    fullName: string;
    phone: string;
    profileImage: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
  };
}

export class AuthResponseDto {
  @ApiProperty({ example: 'User logged in successfully', description: 'Success message' })
  message: string;

  @ApiProperty({ type: LoginDataDto, description: 'Login data including tokens and user info' })
  data: LoginDataDto;
}

export class TokensDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Access Token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Refresh Token',
  })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer', description: 'Token Type' })
  tokenType: string;

  @ApiProperty({ example: '15m', description: 'Token Expiration Time' })
  expiresIn: string;
}

export class SessionDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Device ID',
  })
  deviceId: string;

  @ApiProperty({ example: 'Chrome / Windows', description: 'Device Name' })
  deviceName: string;

  @ApiProperty({ example: 'desktop', description: 'Device Type' })
  deviceType: string;

  @ApiProperty({ example: '192.168.1.1', description: 'IP Address' })
  ipAddress: string;

  @ApiProperty({ example: 'New York, US', description: 'Approximate Location' })
  location: string;

  @ApiProperty({
    example: '2023-10-25T12:00:00Z',
    description: 'Last Active Timestamp',
  })
  lastActiveAt: Date;

  @ApiProperty({ example: true, description: 'Is current session' })
  isCurrent: boolean;
}

export class SessionsResponseDto {
  @ApiProperty({ type: [SessionDto], description: 'List of active sessions' })
  sessions: SessionDto[];

  @ApiProperty({ example: 2, description: 'Total number of active sessions' })
  totalCount: number;
}
