import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(scriptDirectory, '../../front/prisma/migrations');
const migrationNamePattern = /^\d{14}_[a-z0-9_]+$/;

const manifest = readdirSync(migrationsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((migrationName) => existsSync(resolve(migrationsDirectory, migrationName, 'migration.sql')))
  .sort()
  .map((migrationName) => {
    if (!migrationNamePattern.test(migrationName)) {
      throw new Error(`Invalid migration directory name: ${migrationName}`);
    }

    const migrationPath = resolve(migrationsDirectory, migrationName, 'migration.sql');
    const canonicalLfBytes = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n');
    return {
      migrationName,
      checksum: createHash('sha256').update(canonicalLfBytes).digest('hex'),
    };
  });

if (manifest.length === 0) {
  throw new Error('No canonical migrations found');
}

process.stdout.write(JSON.stringify(manifest));
