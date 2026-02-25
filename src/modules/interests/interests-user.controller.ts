import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { BasePaginationDto } from 'src/common/dto/pagination.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { InterestsResponseDto } from './dto';
import { InterestsService } from './interests.service';

@ApiTags('Interests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(CacheInterceptor)
@Controller({ path: 'interests', version: '1' })
export class InterestsUserController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(60000)
  @ApiOperation({ summary: 'Get all interests for user' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('Fetched successfully')
  async findAll(@Query() query: BasePaginationDto) {
    return this.interestsService.findAll(query, false);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @CacheTTL(120000)
  @ApiOperation({ summary: 'Get a interests by id' })
  @ApiStandardResponse({
    status: 200,
    description: 'Interests details',
    type: InterestsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ResponseMessage('Fetched successfully')
  async findOne(@Param('id') id: string) {
    return this.interestsService.findOne(id);
  }
}
