import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const packages = new Map();
for (const parent of ['apps', 'packages']) {
  for (const dir of await readdir(parent, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const root = path.join(parent, dir.name);
    const manifest = JSON.parse(
      await readFile(path.join(root, 'package.json'), 'utf8'),
    );
    packages.set(manifest.name, { root, parent, manifest });
  }
}
const allowed = {
  '@exhibition/web': ['@exhibition/api-client', '@exhibition/contracts'],
  '@exhibition/api-client': ['@exhibition/contracts'],
  '@exhibition/contracts': [],
  '@exhibition/db': [],
  '@exhibition/backend': ['@exhibition/db', '@exhibition/contracts'],
  '@exhibition/ai': ['@exhibition/backend', '@exhibition/contracts'],
  '@exhibition/api': ['@exhibition/backend', '@exhibition/contracts'],
  '@exhibition/worker': ['@exhibition/backend', '@exhibition/ai'],
};
const errors = [];
async function scan(root, visit) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'generated'].includes(entry.name)) continue;
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) await scan(file, visit);
    else if (/\.(ts|vue|mjs)$/.test(file)) await visit(file);
  }
}
for (const [name, pkg] of packages) {
  const deps = {
    ...pkg.manifest.dependencies,
    ...pkg.manifest.devDependencies,
  };
  for (const dep of Object.keys(deps).filter((dep) =>
    dep.startsWith('@exhibition/'),
  )) {
    if (!allowed[name]?.includes(dep))
      errors.push(`${name} cannot depend on ${dep}`);
  }
  await scan(pkg.root, async (file) => {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"]+)\1/g,
    );
    for (const [, , specifier] of imports) {
      if (specifier.startsWith('@exhibition/')) {
        if (
          !packages.has(specifier) ||
          !allowed[name]?.includes(specifier) ||
          !deps[specifier]
        )
          errors.push(`${file}: forbidden or undeclared import ${specifier}`);
      }
      if (specifier.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), specifier);
        if (!resolved.startsWith(path.resolve(pkg.root) + path.sep))
          errors.push(`${file}: relative import escapes package`);
      }
    }
  });
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Workspace boundaries verified (${packages.size} packages).`);
