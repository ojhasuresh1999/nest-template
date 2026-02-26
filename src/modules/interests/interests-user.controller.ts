import { CacheTTL } from '@nestjs/cache-manager';
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
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { JwtAuthGuard, Public } from '../auth';
import { CustomCacheInterceptor } from '../../common/interceptors/custom-cache.interceptor';
import { CachePrefix } from '../../common/cache';
import { InterestsResponseDto } from './dto';
import { UserListInterestsDto } from './dto/list-interest.dto';
import { InterestsService } from './interests.service';

@ApiTags('Interests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(CustomCacheInterceptor)
@CachePrefix('interests')
@Controller({ path: 'interests', version: '1' })
export class InterestsUserController {
  constructor(private readonly interestsService: InterestsService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Get all interests for user' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('Fetched successfully')
  async findAll(@Query() query: UserListInterestsDto) {
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
