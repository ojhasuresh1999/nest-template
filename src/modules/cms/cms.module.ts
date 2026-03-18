import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrivacyPolicyService, TermsAndConditionService } from './cms.service';
import { CmsRepository } from './repositories/cms.repository';
import { Cms, CmsSchema } from './schemas/cms.schema';
import {
  PrivacyPolicyUserController,
  TermsAndConditionUserController,
} from './cms-user.controller';
import {
  PrivacyPolicyAdminController,
  TermsAndConditionAdminController,
} from './cms-admin.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Cms.name, schema: CmsSchema }])],
  controllers: [
    PrivacyPolicyUserController,
    PrivacyPolicyAdminController,
    TermsAndConditionAdminController,
    TermsAndConditionUserController,
  ],
  providers: [PrivacyPolicyService, TermsAndConditionService, CmsRepository],
  exports: [PrivacyPolicyService, TermsAndConditionService],
})
export class CmsModule {}
