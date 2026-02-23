import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ example: 'Request successful' })
  message: string;

  @ApiProperty({ description: 'The data returned by the API' })
  data: T;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 100, description: 'Total number of documents' })
  totalDocs: number;

  @ApiProperty({ example: 0, description: 'Number of documents skipped' })
  skip: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 10, description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ example: 10, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: false, description: 'Whether previous page exists' })
  hasPrevPage: boolean;

  @ApiProperty({ example: true, description: 'Whether next page exists' })
  hasNextPage: boolean;

  @ApiProperty({ example: null, nullable: true, description: 'Previous page number or null' })
  prevPage: number | null;

  @ApiProperty({ example: 2, nullable: true, description: 'Next page number or null' })
  nextPage: number | null;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ type: PaginationMetaDto, description: 'Pagination metadata' })
  meta: PaginationMetaDto;

  @ApiProperty({ isArray: true, description: 'Array of documents' })
  docs: T[];
}
