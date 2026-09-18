import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.join('packages', 'db', 'migrations');
const journalPath = path.join(migrationsDir, 'meta', '_journal.json');

const journal = JSON.parse(await readFile(journalPath, 'utf8'));
const journalTags = new Set(journal.entries.map((e) => e.tag));

const sqlFiles = (await readdir(migrationsDir))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => path.basename(f, '.sql'));

const errors = [];

for (const tag of sqlFiles) {
  if (!journalTags.has(tag)) {
    errors.push(`Migration file "${tag}.sql" is not registered in _journal.json`);
  }
}

for (const tag of journalTags) {
  if (!sqlFiles.includes(tag)) {
    errors.push(`Journal entry "${tag}" has no corresponding .sql file in migrations/`);
  }
}

const indices = journal.entries.map((e) => e.idx);
for (let i = 0; i < indices.length; i++) {
  if (indices[i] !== i) {
    errors.push(
      `Journal entry at position ${i} has idx=${indices[i]}, expected ${i} (entries must be contiguous and zero-indexed)`,
    );
  }
}

if (errors.length) {
  throw new Error(
    `Migration integrity check failed:\n${errors.map((e) => `  • ${e}`).join('\n')}`,
  );
}

console.log(
  `Migration integrity verified: ${sqlFiles.length} SQL file(s) match ${journal.entries.length} journal entry/entries.`,
);
