import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const template = await readFile(resolve(root, '.env.example'), 'utf8');
const secrets = {
  PGPASSWORD: randomBytes(24).toString('hex'),
  REDIS_PASSWORD: randomBytes(24).toString('hex'),
  S3_ACCESS_KEY: randomBytes(12).toString('hex'),
  S3_SECRET_KEY: randomBytes(24).toString('hex'),
};
let contents = template;
for (const [key, value] of Object.entries(secrets)) {
  contents = contents.replace(new RegExp(`^${key}=$`, 'm'), `${key}=${value}`);
}
try {
  await writeFile(resolve(root, '.env'), contents, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with random local credentials.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
for (const directory of ['.local/logs', '.local/tmp']) {
  await mkdir(resolve(root, directory), { recursive: true });
}
console.log('Local directories are ready.');
