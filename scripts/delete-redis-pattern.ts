// npx ts-node scripts/delete-redis-pattern.ts

import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

// Load environment variables manually since dotenv is not installed
const envPath = path.resolve(process.cwd(), '.env');
console.log(envPath);
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

async function main() {
  const pattern = process.argv[2];

  if (!pattern) {
    console.error('❌ Please provide a Redis key pattern to delete.');
    console.error('Usage: ts-node scripts/delete-redis-pattern.ts "your:pattern:*"');
    process.exit(1);
  }

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  });

  console.log(`🔍 Connecting to Redis and searching for pattern: "${pattern}"...`);

  let cursor = '0';
  let totalDeleted = 0;
  const CHUNK_SIZE = 500;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
      cursor = nextCursor;

      if (keys.length > 0) {
        // Delete in chunks to prevent max call stack size exceeded errors
        for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
          const chunk = keys.slice(i, i + CHUNK_SIZE);
          const deletedCount = await redis.del(...chunk);
          totalDeleted += deletedCount;
        }
      }
    } while (cursor !== '0');

    console.log(`✅ Successfully deleted ${totalDeleted} keys matching pattern: "${pattern}"`);
  } catch (error) {
    console.error('❌ Error deleting keys:', error);
  } finally {
    await redis.quit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
