import { ApiProperty } from '@nestjs/swagger';

export class PrivacyPolicyResponseDto {
  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
