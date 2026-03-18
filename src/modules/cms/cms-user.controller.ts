import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

import { CmsType } from 'src/common/enums';
import { CacheInvalidationInterceptor, CachePrefix } from 'src/common/cache';
import { CustomCacheInterceptor } from 'src/common/interceptors/custom-cache.interceptor';
import { ApiStandardResponse } from 'src/common/decorators/api-standard-response.decorator';
import { PrivacyPolicyResponseDto } from './dto';
import { TermsAndConditionResponseDto } from './dto/terms-and-condition/terms-and-condition-response.dto';
import { PrivacyPolicyService, TermsAndConditionService } from './cms.service';

@Controller('user/cms/privacy-policy')
@ApiTags('User Privacy Policy')
@UseInterceptors(CustomCacheInterceptor, CacheInvalidationInterceptor)
@CachePrefix('privacy-policy')
export class PrivacyPolicyUserController {
  constructor(private readonly privacyPolicyService: PrivacyPolicyService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'User Get privacy policy' })
  @ApiStandardResponse({
    status: 200,
    description: 'Privacy policy fetched',
    type: PrivacyPolicyResponseDto,
  })
  @ResponseMessage('Privacy policy fetched successfully')
  async findOne() {
    return this.privacyPolicyService.get(CmsType.PRIVACY_POLICY);
  }
}

@Controller('user/cms/terms-and-condition')
@ApiTags('User Terms and Condition')
@UseInterceptors(CustomCacheInterceptor, CacheInvalidationInterceptor)
@CachePrefix('terms-and-condition')
export class TermsAndConditionUserController {
  constructor(private readonly termsAndConditionService: TermsAndConditionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @CacheTTL(0)
  @ApiOperation({ summary: 'User Get terms and condition' })
  @ApiStandardResponse({
    status: 200,
    description: 'Terms and condition fetched',
    type: TermsAndConditionResponseDto,
  })
  @ResponseMessage('Terms and condition fetched successfully')
  async findOne() {
    return this.termsAndConditionService.get(CmsType.TERMS_AND_CONDITIONS);
  }
}
