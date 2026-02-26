import { SetMetadata } from '@nestjs/common';
import { CACHE_INVALIDATE_PREFIX } from './cache.constants';

export const CacheInvalidate = (...prefixes: string[]) =>
  SetMetadata(CACHE_INVALIDATE_PREFIX, prefixes);
