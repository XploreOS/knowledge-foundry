// Publish every public workspace whose current version is not yet on the npm
// registry. Run by .github/workflows/release-please.yml after a release PR
// merges; safe to re-run (already-published versions are skipped, and a
// failure in one package does not silently swallow the others).
//
// Auth is OIDC trusted publishing (no token): each package's npmjs.com
// settings name this repo + workflow as its trusted publisher, and npm
// generates provenance automatically. Requires npm >= 11.5.1 in CI.

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const rootPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

let failed = false;

for (const workspace of rootPkg.workspaces) {
  const pkgPath = path.join(root, workspace, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const spec = `${pkg.name}@${pkg.version}`;

  if (pkg.private) {
    console.log(`skip ${spec} (private)`);
    continue;
  }

  let published = '';
  try {
    published = execSync(`npm view ${spec} version`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // npm view exits non-zero when the version (or package) does not exist yet.
  }
  if (published === pkg.version) {
    console.log(`skip ${spec} (already published)`);
    continue;
  }

  console.log(`publish ${spec}`);
  const result = spawnSync(
    'npm',
    ['publish', '--workspace', pkg.name, '--access', 'public'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (result.status !== 0) {
    console.error(`FAILED to publish ${spec}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
