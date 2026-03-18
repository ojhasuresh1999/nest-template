import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

import { PrivacyPolicyService, TermsAndConditionService } from './cms.service';
import { CmsType, UserRole } from 'src/common/enums';
import { CustomCacheInterceptor } from 'src/common/interceptors/custom-cache.interceptor';

import { UseInterceptors } from '@nestjs/common';
import { CacheInvalidate, CacheInvalidationInterceptor, CachePrefix } from 'src/common/cache';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../auth';
import { PrivacyPolicyResponseDto, UpdatePrivacyPolicyCmsDto } from './dto';
import { ApiStandardResponse } from 'src/common/decorators/api-standard-response.decorator';
import { TermsAndConditionResponseDto } from './dto/terms-and-condition/terms-and-condition-response.dto';
import { UpdateTermsAndConditionCmsDto } from './dto/terms-and-condition/update-terms-and-condition.dto';

@Controller('admin/cms/privacy-policy')
@ApiTags('Admin Privacy Policy')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UseInterceptors(CustomCacheInterceptor, CacheInvalidationInterceptor)
@CachePrefix('privacy-policy')
export class PrivacyPolicyAdminController {
  constructor(private readonly privacyPolicyService: PrivacyPolicyService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Admin Get privacy policy' })
  @ApiStandardResponse({
    status: 200,
    description: 'Privacy policy fetched',
    type: PrivacyPolicyResponseDto,
  })
  @ResponseMessage('Privacy policy fetched successfully')
  async find() {
    return this.privacyPolicyService.get(CmsType.PRIVACY_POLICY);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('privacy-policy')
  @ApiOperation({ summary: 'Admin update privacy policy' })
  @ApiStandardResponse({
    status: 200,
    description: 'Privacy policy updated',
    type: PrivacyPolicyResponseDto,
  })
  @ResponseMessage('Privacy policy updated successfully')
  async upsert(@Body() updatePrivacyPolicyCmsDto: UpdatePrivacyPolicyCmsDto) {
    return this.privacyPolicyService.upsert(CmsType.PRIVACY_POLICY, updatePrivacyPolicyCmsDto);
  }
}

@Controller('admin/cms/terms-and-condition')
@ApiTags('Admin Terms and Condition')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UseInterceptors(CustomCacheInterceptor, CacheInvalidationInterceptor)
@CachePrefix('terms-and-condition')
export class TermsAndConditionAdminController {
  constructor(private readonly termsAndConditionService: TermsAndConditionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Admin Get terms and condition' })
  @ApiStandardResponse({
    status: 200,
    description: 'Terms and condition fetched',
    type: TermsAndConditionResponseDto,
  })
  @ResponseMessage('Terms and condition fetched successfully')
  async find() {
    return this.termsAndConditionService.get(CmsType.TERMS_AND_CONDITIONS);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('terms-and-condition')
  @ApiOperation({ summary: 'Admin update terms and condition' })
  @ApiStandardResponse({
    status: 200,
    description: 'Terms and condition updated',
    type: TermsAndConditionResponseDto,
  })
  @ResponseMessage('Terms and condition updated successfully')
  async upsert(@Body() updateTermsAndConditionCmsDto: UpdateTermsAndConditionCmsDto) {
    return this.termsAndConditionService.upsert(
      CmsType.TERMS_AND_CONDITIONS,
      updateTermsAndConditionCmsDto,
    );
  }
}
