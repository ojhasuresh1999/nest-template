import { Request } from 'express';

export interface IS3Request extends Request {
  uploadedFiles?: Record<string, string[]>;
}
