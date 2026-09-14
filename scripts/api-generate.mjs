import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { format, resolveConfig } from 'prettier';
import { buildApp } from '../apps/api/src/app.ts';

const app = await buildApp();
try {
  const document = app.swagger();
  const config = await resolveConfig(
    fileURLToPath(new URL('../package.json', import.meta.url)),
  );
  const schema = await format(JSON.stringify(document), {
    ...config,
    parser: 'json',
  });
  const types = await format(astToString(await openapiTS(document)), {
    ...config,
    parser: 'typescript',
  });
  const outputs = [
    [new URL('../docs/api/openapi.json', import.meta.url), schema],
    [
      new URL('../packages/api-client/src/generated.ts', import.meta.url),
      types,
    ],
  ];
  for (const [url, content] of outputs) {
    if (process.argv.includes('--check')) {
      const current = await readFile(url, 'utf8').catch(() => '');
      if (current !== content)
        throw new Error(
          `Generated API artifact is stale: ${fileURLToPath(url)}. Run pnpm api:generate.`,
        );
    } else {
      await mkdir(new URL('.', url), { recursive: true });
      await writeFile(url, content);
    }
  }
  console.log(
    process.argv.includes('--check')
      ? 'API artifacts are current.'
      : 'API artifacts generated.',
  );
} finally {
  await app.close();
}
