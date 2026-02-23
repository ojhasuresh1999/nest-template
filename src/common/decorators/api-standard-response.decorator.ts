import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto } from '../dto/api-response.dto';

interface ApiStandardResponseOptions<TModel extends Type<any>> {
  type?: TModel;
  status?: number;
  description?: string;
  isArray?: boolean;
}

export const ApiStandardResponse = <TModel extends Type<any>>(
  options: ApiStandardResponseOptions<TModel> = {},
) => {
  const { type, status = 200, description, isArray = false } = options;

  const dataSchema = type
    ? isArray
      ? { type: 'array', items: { $ref: getSchemaPath(type) } }
      : { $ref: getSchemaPath(type) }
    : {};

  const decorators = [
    ApiExtraModels(ApiResponseDto),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              data: dataSchema,
            },
          },
        ],
      },
    }),
  ];

  if (type) {
    decorators.push(ApiExtraModels(type));
  }

  return applyDecorators(...decorators);
};
