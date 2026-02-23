import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { MongoIdPipe } from '../../common/pipes/mongoid.pipe';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiStandardResponse } from 'src/common/decorators/api-standard-response.decorator';
import { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from './dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { RESPONSE_MESSAGES } from 'src/common/constants/response-messages.constant';

@ApiTags('Roles')
@Controller({ path: 'admin/roles', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new role',
    description: 'Creates a new role with specific permissions.',
  })
  @ApiStandardResponse({
    status: 201,
    description: 'Role successfully created',
    type: RoleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiConflictResponse({ description: 'Role with this name already exists' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.COMMON.CREATED)
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.createRole(createRoleDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Retrieves a list of all active roles.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'List of roles',
    type: RoleResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.COMMON.FETCHED)
  async findAll() {
    return this.roleService.getAllRoles();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get role by ID',
    description: 'Retrieves details of a specific role by its ID.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Role benefits',
    type: RoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.COMMON.FETCHED)
  async findOne(@Param('id', MongoIdPipe) id: string) {
    return this.roleService.getRoleById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update role',
    description: 'Updates an existing role.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Role successfully updated',
    type: RoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiBadRequestResponse({ description: 'Invalid input or cannot update static role' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.COMMON.UPDATED)
  async update(@Param('id', MongoIdPipe) id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.updateRole(id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete role',
    description: 'Soft deletes a role (sets status to INACTIVE). Cannot delete static roles.',
  })
  @ApiStandardResponse({ status: 204, description: 'Role successfully deleted' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiBadRequestResponse({ description: 'Cannot delete static role' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.COMMON.DELETED)
  async remove(@Param('id', MongoIdPipe) id: string) {
    await this.roleService.deleteRole(id);
  }
}
