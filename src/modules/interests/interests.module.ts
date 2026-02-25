import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InterestsService } from './interests.service';
import { InterestsRepository } from './repositories/interests.repository';
import { Interests, InterestsSchema } from './schemas/interests.schema';
import { InterestsUserController } from './interests-user.controller';
import { InterestsAdminController } from './interests-admin.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Interests.name, schema: InterestsSchema }])],
  controllers: [InterestsUserController, InterestsAdminController],
  providers: [InterestsService, InterestsRepository],
  exports: [InterestsService],
})
export class InterestsModule {}
