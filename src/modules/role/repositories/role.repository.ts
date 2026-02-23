import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Role, RoleDocument } from '../schemas/role.schema';

@Injectable()
export class RoleRepository extends BaseRepository<RoleDocument> {
  constructor(@InjectModel(Role.name) roleModel: Model<RoleDocument>) {
    super(roleModel);
  }
}
