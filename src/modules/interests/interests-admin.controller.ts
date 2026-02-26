import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Delete,
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
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UserRole } from '../../common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CachePrefix, CacheInvalidate, CacheInvalidationInterceptor } from '../../common/cache';
import { CustomCacheInterceptor } from '../../common/interceptors/custom-cache.interceptor';
import { CacheTTL } from '@nestjs/cache-manager';
import { CreateInterestsDto, InterestsResponseDto, UpdateInterestsDto } from './dto';
import { InterestsService } from './interests.service';
import { BasePaginationDto, StatusChangeDto } from 'src/common/dto/pagination.dto';

@ApiTags('Admin Interests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UseInterceptors(CustomCacheInterceptor, CacheInvalidationInterceptor)
@CachePrefix('interests')
@Controller({ path: 'admin/interests', version: '1' })
export class InterestsAdminController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Admin Get all interests' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('Fetched successfully')
  async findAll(@Query() query: BasePaginationDto) {
    return this.interestsService.findAll(query, true);
  }

  @Post()
  @CacheInvalidate('interests')
  @ApiOperation({
    summary: 'Admin Create interests',
    description: 'Admin can create interests',
  })
  @ApiBody({ type: CreateInterestsDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('Interests created successfully')
  async create(@Body() createInterestsDto: CreateInterestsDto) {
    return this.interestsService.create(createInterestsDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Admin Get interests by id' })
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

  @Patch(':id')
  @CacheInvalidate('interests')
  @ApiOperation({
    summary: 'Admin Update interests',
    description: 'Admin can update interests details',
  })
  @ApiBody({ type: UpdateInterestsDto })
  @ApiStandardResponse({
    status: 200,
    description: 'Interests updated',
    type: InterestsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ResponseMessage('Interests updated successfully')
  async update(@Param('id') id: string, @Body() updateInterestsDto: UpdateInterestsDto) {
    return this.interestsService.update(id, updateInterestsDto);
  }

  @Patch(':id/status')
  @CacheInvalidate('interests')
  @ApiOperation({
    summary: 'Admin Update interests status',
    description: 'Admin can toggle interests status',
  })
  @ApiBody({ type: StatusChangeDto })
  @ApiStandardResponse({
    status: 200,
    description: 'Interests status updated',
    type: InterestsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ResponseMessage('Status updated successfully')
  async updateStatus(@Param('id') id: string, @Body() statusDto: StatusChangeDto) {
    return this.interestsService.updateStatus(id, statusDto);
  }

  @Delete(':id')
  @CacheInvalidate('interests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin Delete interests',
    description: 'Admin can delete an interest',
  })
  @ApiStandardResponse({ status: 200, description: 'Interests deleted' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ResponseMessage('Interests deleted successfully')
  async remove(@Param('id') id: string) {
    return this.interestsService.delete(id);
  }
}
