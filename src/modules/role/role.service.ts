import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { RoleRepository } from './repositories/role.repository';
import { RoleDocument } from './schemas/role.schema';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { StatusEnum } from '../../common/enums';

@Injectable()
export class RoleService {
  constructor(private readonly roleRepository: RoleRepository) {}

  async createRole(data: CreateRoleDto): Promise<RoleDocument> {
    const existing = await this.roleRepository.findOne({ name: data.name });
    if (existing) {
      throw ApiError.conflict(`Role with name "${data.name}" already exists`);
    }

    return this.roleRepository.create({
      ...data,
      status: StatusEnum.ACTIVE,
    });
  }

  async getAllRoles(): Promise<RoleDocument[]> {
    return this.roleRepository.findAll({ status: StatusEnum.ACTIVE });
  }

  async getRoleById(id: string): Promise<RoleDocument> {
    const role = await this.roleRepository.findById(id);
    if (!role || role.status !== StatusEnum.ACTIVE) {
      throw ApiError.notFound('Role not found');
    }
    return role;
  }

  async getRoleByName(name: string): Promise<RoleDocument | null> {
    return this.roleRepository.findOne({ name, status: StatusEnum.ACTIVE });
  }

  async updateRole(id: string, updateData: UpdateRoleDto): Promise<RoleDocument> {
    const role = await this.getRoleById(id);

    if (role.isStatic && updateData.name && updateData.name !== role.name) {
      throw ApiError.badRequest('Cannot change name of a static system role');
    }

    const updated = await this.roleRepository.updateById(id, updateData);
    if (!updated) {
      throw ApiError.notFound('Role not found');
    }
    return updated;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRoleById(id);

    if (role.isStatic) {
      throw ApiError.badRequest('Cannot delete a static system role');
    }

    await this.roleRepository.updateById(id, { status: StatusEnum.INACTIVE } as any);
  }
}
