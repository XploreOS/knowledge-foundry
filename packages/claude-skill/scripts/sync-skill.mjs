// prepack: sync the repo-root skill/ bundle into this package so npm ships it.
// The root skill/ directory stays the single source of truth; the copy under
// packages/claude-skill/skill is generated and gitignored.

import { cpSync, rmSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(packageRoot, '..', '..', 'skill');
const target = path.join(packageRoot, 'skill');

if (!existsSync(source)) {
  console.error(`sync-skill: source not found: ${source}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`sync-skill: copied ${source} -> ${target}`);
