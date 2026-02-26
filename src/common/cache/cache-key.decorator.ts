import { SetMetadata } from '@nestjs/common';
import { CACHE_KEY_PREFIX } from './cache.constants';

export const CachePrefix = (prefix: string) => SetMetadata(CACHE_KEY_PREFIX, prefix);
