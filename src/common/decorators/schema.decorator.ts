import { applyDecorators } from '@nestjs/common';
import { Prop, PropOptions, Schema, SchemaOptions } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose from 'mongoose';

export type PropDataOptions = PropOptions & {
  trim?: boolean;
  enum?: any;
  type?: any;
  required?: boolean | [boolean, string];
  default?: any;
  unique?: boolean;
  index?: boolean;
  versionKey?: boolean;
  [key: string]: any;
};

export const SchemaWith = (options?: SchemaOptions) => {
  return applyDecorators(Schema({ timestamps: true, versionKey: false, ...options }));
};

export function PropData(options: PropDataOptions = {}) {
  return (target: any, key: string) => {
    const { trim = true, type, ...rest } = options;

    const propOptions: PropOptions & Record<string, any> = {
      ...rest,
    };

    if (trim && (type === String || Reflect.getMetadata('design:type', target, key) === String)) {
      propOptions.trim = true;
    }

    if (options.enum) {
      propOptions.enum = options.enum as unknown[];
      propOptions.type = String;
    }

    if (type) {
      propOptions.type = type;
    }

    Prop(propOptions)(target, key);

    if (
      type &&
      typeof type === 'function' &&
      !Object.values(mongoose.Schema.Types).includes(type)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      Type(() => type as Function)(target, key);
    }
  };
}
