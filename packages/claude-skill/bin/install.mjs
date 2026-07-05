#!/usr/bin/env node
// Install the Knowledge Foundry skill bundle into Claude Code.
//
//   npx @knowledge-foundry/skill            -> ./.claude/skills/knowledge-foundry (project)
//   npx @knowledge-foundry/skill --user     -> ~/.claude/skills/knowledge-foundry (all projects)
//   npx @knowledge-foundry/skill --dir <d>  -> <d>/knowledge-foundry (explicit)
//   add --force to overwrite an existing install
//
// The richer distribution channel is the Claude Code plugin marketplace:
//   /plugin marketplace add XploreOS/knowledge-foundry
//   /plugin install knowledge-foundry@knowledge-foundry
// This installer exists for the simple copy-a-skill path.

import { cpSync, existsSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_NAME = 'knowledge-foundry';

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: npx @knowledge-foundry/skill [--user | --dir <path>] [--force]

Installs the Knowledge Foundry skill for Claude Code.

  (default)     install into ./.claude/skills/${SKILL_NAME} (this project)
  --user        install into ~/.claude/skills/${SKILL_NAME} (every project)
  --dir <path>  install into <path>/${SKILL_NAME}
  --force       overwrite an existing installation
`);
  process.exit(0);
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Published package ships skill/ inside the package (synced at pack time);
// a repo checkout falls back to the root skill/ directory.
const sourceCandidates = [
  path.join(packageRoot, 'skill'),
  path.resolve(packageRoot, '..', '..', 'skill'),
];
const source = sourceCandidates.find((candidate) => existsSync(path.join(candidate, 'SKILL.md')));
if (!source) fail(`could not locate the bundled skill directory (looked in: ${sourceCandidates.join(', ')})`);

let baseDir;
const dirFlag = args.indexOf('--dir');
if (dirFlag !== -1) {
  const value = args[dirFlag + 1];
  if (!value || value.startsWith('--')) fail('--dir requires a path argument');
  baseDir = path.resolve(value);
} else if (args.includes('--user')) {
  baseDir = path.join(os.homedir(), '.claude', 'skills');
} else {
  baseDir = path.join(process.cwd(), '.claude', 'skills');
}

const target = path.join(baseDir, SKILL_NAME);
if (existsSync(target)) {
  if (!args.includes('--force')) {
    fail(`${target} already exists — pass --force to overwrite`);
  }
  rmSync(target, { recursive: true, force: true });
}

cpSync(source, target, { recursive: true });

console.log(`Installed the Knowledge Foundry skill to:\n  ${target}\n`);
console.log('Next steps:');
console.log('  1. Install the CLI the skill drives:  npm install -g @knowledge-foundry/cli');
console.log('  2. Open Claude Code and ask it to build a governed corpus, or start with:');
console.log('       kf init-domain <domain-id> && kf validate-domain <domain-id>');
console.log('\nPrefer the plugin system? Instead of this installer run, inside Claude Code:');
console.log('  /plugin marketplace add XploreOS/knowledge-foundry');
console.log(`  /plugin install ${SKILL_NAME}@knowledge-foundry`);
