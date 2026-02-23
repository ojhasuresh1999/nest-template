import { ValidationError, ValidationPipeOptions, HttpStatus } from '@nestjs/common';
import { ApiError, ErrorDetail } from '../common/errors/api-error';

function generateErrors(errors: ValidationError[]): ErrorDetail[] {
  return errors.flatMap((error) => {
    const constraints = error.constraints ? Object.values(error.constraints) : [];
    // If there are constraints, map them to error details
    if (constraints.length > 0) {
      return constraints.map((msg) => ({
        field: error.property,
        message: msg,
      }));
    }
    // If there are children (nested validation), recurse
    if (error.children && error.children.length > 0) {
      // Note: This simple recursion loses the parent path context (e.g. 'address.city')
      // For more complex nested objects, we might want to pass the parent path down.
      // But for now, keeping it simple as per previous recursive logic attempt.
      return generateErrors(error.children);
    }
    return [];
  });
}

export const validationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory: (errors: ValidationError[]) => {
    const details = generateErrors(errors);
    return ApiError.unprocessableEntity('Validation failed', details);
  },
};
