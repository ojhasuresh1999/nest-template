import { Injectable, NotFoundException } from '@nestjs/common';
import { CmsRepository } from './repositories/cms.repository';
import { CmsType } from 'src/common/enums';
import { PrivacyPolicyResponseDto, UpdatePrivacyPolicyCmsDto } from './dto';
import { UpdateTermsAndConditionCmsDto } from './dto/terms-and-condition/update-terms-and-condition.dto';
import { TermsAndConditionResponseDto } from './dto/terms-and-condition/terms-and-condition-response.dto';

@Injectable()
export class PrivacyPolicyService {
  constructor(private readonly cmsRepository: CmsRepository) {}

  async get(type: CmsType): Promise<PrivacyPolicyResponseDto> {
    const doc = await this.cmsRepository.findCmsByType(type);
    if (!doc) throw new NotFoundException('Privacy policy not found');
    const response: PrivacyPolicyResponseDto = {
      content: (doc.data as { content: string }).content,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    return response;
  }

  async upsert(type: CmsType, data: UpdatePrivacyPolicyCmsDto): Promise<PrivacyPolicyResponseDto> {
    this.get(type);
    const doc = await this.cmsRepository.upsertCmsByType(type, data);

    if (!doc) throw new NotFoundException('Privacy policy not found');
    const response: PrivacyPolicyResponseDto = {
      content: (doc.data as { content: string }).content,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    return response;
  }
}

@Injectable()
export class TermsAndConditionService {
  constructor(private readonly cmsRepository: CmsRepository) {}

  async get(type: CmsType): Promise<TermsAndConditionResponseDto> {
    const doc = await this.cmsRepository.findCmsByType(type);
    if (!doc) throw new NotFoundException('Terms and condition not found');

    const response: TermsAndConditionResponseDto = {
      content: (doc.data as { content: string }).content,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    return response;
  }

  async upsert(
    type: CmsType,
    data: UpdateTermsAndConditionCmsDto,
  ): Promise<TermsAndConditionResponseDto> {
    this.get(type);
    const doc = await this.cmsRepository.upsertCmsByType(type, data);

    if (!doc) throw new NotFoundException('Terms and condition not found');
    const response: TermsAndConditionResponseDto = {
      content: (doc.data as { content: string }).content,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    return response;
  }
}
