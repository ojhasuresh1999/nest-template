import * as fs from 'fs';
import * as path from 'path';

const moduleNameInput = process.argv[2];

if (!moduleNameInput) {
  console.error('Please provide a module name. Usage: pnpm run generate:module <module-name>');
  process.exit(1);
}

// Convert input like "test_entity" or "test entity" to kebab-case "test-entity"
const kebabCase = moduleNameInput
  .replace(/([a-z])([A-Z])/g, '$1-$2')
  .replace(/[\s_]+/g, '-')
  .toLowerCase();

// CamelCase: "testEntity"
const camelCase = kebabCase.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

// PascalCase: "TestEntity"
const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);

const srcDir = path.join(__dirname, '..', 'src');
const moduleDir = path.join(srcDir, 'modules', kebabCase);

if (fs.existsSync(moduleDir)) {
  console.error(`Module ${kebabCase} already exists at ${moduleDir}`);
  process.exit(1);
}

// Create directories
const dirs = [
  moduleDir,
  path.join(moduleDir, 'schemas'),
  path.join(moduleDir, 'repositories'),
  path.join(moduleDir, 'dto'),
];

dirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// Templates
const templates = {
  [`${kebabCase}.module.ts`]: `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${pascalCase}Service } from './${kebabCase}.service';
import { ${pascalCase}Repository } from './repositories/${kebabCase}.repository';
import { ${pascalCase}, ${pascalCase}Schema } from './schemas/${kebabCase}.schema';
import { ${pascalCase}UserController } from './${kebabCase}-user.controller';
import { ${pascalCase}AdminController } from './${kebabCase}-admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ${pascalCase}.name, schema: ${pascalCase}Schema }]),
  ],
  controllers: [${pascalCase}UserController, ${pascalCase}AdminController],
  providers: [${pascalCase}Service, ${pascalCase}Repository],
  exports: [${pascalCase}Service],
})
export class ${pascalCase}Module {}
`,

  [`${kebabCase}.service.ts`]: `import { Injectable, NotFoundException } from '@nestjs/common';
import { ${pascalCase}Repository } from './repositories/${kebabCase}.repository';
import { PaginationResponse } from '../../common/types/api-response.type';
import { ${pascalCase}Document } from './schemas/${kebabCase}.schema';

@Injectable()
export class ${pascalCase}Service {
  constructor(private readonly ${camelCase}Repository: ${pascalCase}Repository) {}

  async findAll(page: number = 1, limit: number = 10): Promise<PaginationResponse<${pascalCase}Document>> {
    return this.${camelCase}Repository.findPaginated(page, limit);
  }
  
  async findOne(id: string): Promise<${pascalCase}Document> {
    const doc = await this.${camelCase}Repository.findById(id);
    if (!doc) throw new NotFoundException('${pascalCase} not found');
    return doc;
  }
}
`,

  [`${kebabCase}-user.controller.ts`]: `import { Controller, Get, HttpCode, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ${pascalCase}Service } from './${kebabCase}.service';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ${pascalCase}ResponseDto } from './dto';

@ApiTags('${pascalCase}s')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: '${kebabCase}s', version: '1' })
export class ${pascalCase}UserController {
  constructor(private readonly ${camelCase}Service: ${pascalCase}Service) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all ${kebabCase}s for user' })
  @ApiStandardResponse({ status: 200, description: 'List of ${kebabCase}s', type: ${pascalCase}ResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('Fetched successfully')
  async findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.${camelCase}Service.findAll(page, limit);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a ${kebabCase} by id' })
  @ApiStandardResponse({ status: 200, description: '${pascalCase} details', type: ${pascalCase}ResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ResponseMessage('Fetched successfully')
  async findOne(@Param('id') id: string) {
    return this.${camelCase}Service.findOne(id);
  }
}
`,

  [`${kebabCase}-admin.controller.ts`]: `import { Controller, Get, HttpCode, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ${pascalCase}Service } from './${kebabCase}.service';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { ${pascalCase}ResponseDto } from './dto';

@ApiTags('Admin ${pascalCase}s')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller({ path: 'admin/${kebabCase}s', version: '1' })
export class ${pascalCase}AdminController {
  constructor(private readonly ${camelCase}Service: ${pascalCase}Service) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Get all ${kebabCase}s' })
  @ApiStandardResponse({ status: 200, description: 'List of ${kebabCase}s', type: ${pascalCase}ResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('Fetched successfully')
  async findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.${camelCase}Service.findAll(page, limit);
  }
  
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Get ${kebabCase} by id' })
  @ApiStandardResponse({ status: 200, description: '${pascalCase} details', type: ${pascalCase}ResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ResponseMessage('Fetched successfully')
  async findOne(@Param('id') id: string) {
    return this.${camelCase}Service.findOne(id);
  }
}
`,

  [`schemas/${kebabCase}.schema.ts`]: `import { SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';

@SchemaWith({ collection: '${kebabCase}s' })
export class ${pascalCase} {
  @PropData({ required: true, index: true })
  name: string;

  @PropData({ default: true })
  isActive: boolean;
}

export const ${pascalCase}Schema = SchemaFactory.createForClass(${pascalCase});

export type ${pascalCase}Document = HydratedDocument<${pascalCase}>;
`,

  [`repositories/${kebabCase}.repository.ts`]: `import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { ${pascalCase}, ${pascalCase}Document } from '../schemas/${kebabCase}.schema';
import { buildPaginationMeta, PaginationResponse } from '../../../common/types/api-response.type';

@Injectable()
export class ${pascalCase}Repository extends BaseRepository<${pascalCase}Document> {
  constructor(
    @InjectModel(${pascalCase}.name)
    private readonly ${camelCase}Model: Model<${pascalCase}Document>,
  ) {
    super(${camelCase}Model);
  }

  async findPaginated(page: number = 1, limit: number = 10): Promise<PaginationResponse<${pascalCase}Document>> {
    const filter = {};
    const skip = (page - 1) * limit;

    const [docs, totalDocs] = await Promise.all([
      this.${camelCase}Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.${camelCase}Model.countDocuments(filter),
    ]);

    return {
      meta: buildPaginationMeta(totalDocs, page, limit),
      docs: docs as ${pascalCase}Document[],
    };
  }
}
`,

  [`dto/index.ts`]: `export * from './create-${kebabCase}.dto';
export * from './update-${kebabCase}.dto';
export * from './${kebabCase}-response.dto';
`,

  [`dto/create-${kebabCase}.dto.ts`]: `import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class Create${pascalCase}Dto {
  @ApiProperty({ description: '${pascalCase} name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Is active status', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
`,

  [`dto/update-${kebabCase}.dto.ts`]: `import { PartialType } from '@nestjs/swagger';
import { Create${pascalCase}Dto } from './create-${kebabCase}.dto';

export class Update${pascalCase}Dto extends PartialType(Create${pascalCase}Dto) {}
`,

  [`dto/${kebabCase}-response.dto.ts`]: `import { ApiProperty } from '@nestjs/swagger';

export class ${pascalCase}ResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
`,
};

for (const [relativePath, content] of Object.entries(templates)) {
  const filePath = path.join(moduleDir, relativePath);
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`✅ Module ${pascalCase} created successfully at ${moduleDir}`);

// Attempt to update app.module.ts
const appModulePath = path.join(srcDir, 'app.module.ts');
if (fs.existsSync(appModulePath)) {
  let appModuleContent = fs.readFileSync(appModulePath, 'utf8');

  const importStatement = `import { ${pascalCase}Module } from './modules/${kebabCase}/${kebabCase}.module';\n`;

  // Find last import
  const lastImportMatch = [...appModuleContent.matchAll(/^import .+;$/gm)].pop();

  if (lastImportMatch && !appModuleContent.includes(`${pascalCase}Module`)) {
    const insertPos = lastImportMatch.index! + lastImportMatch[0].length;
    appModuleContent =
      appModuleContent.slice(0, insertPos) +
      '\n' +
      importStatement +
      appModuleContent.slice(insertPos);

    // Add to imports array of AppModule
    const appModuleMatch = appModuleContent.match(
      /@Module\(\{(?:[^}]|\n)*?imports:\s*\[([\s\S]*?)\]\s*,\s*controllers/,
    );
    if (appModuleMatch) {
      let importsContent = appModuleMatch[1];
      if (!importsContent.includes(`${pascalCase}Module`)) {
        const trimmed = importsContent.trimEnd();
        const replacement =
          trimmed.endsWith(',') || trimmed === ''
            ? `${trimmed}\n    ${pascalCase}Module,\n  `
            : `${trimmed},\n    ${pascalCase}Module,\n  `;

        appModuleContent = appModuleContent.replace(appModuleMatch[1], replacement);
        fs.writeFileSync(appModulePath, appModuleContent, 'utf8');
        console.log(`✅ Automatically imported ${pascalCase}Module into app.module.ts`);
      }
    }
  }
}
