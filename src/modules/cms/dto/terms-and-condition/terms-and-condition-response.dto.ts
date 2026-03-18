import { ApiProperty } from '@nestjs/swagger';

export class TermsAndConditionResponseDto {
  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
