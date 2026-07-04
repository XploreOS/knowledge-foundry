import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const schemaMod = await import(pathToFileURL(join(ROOT, 'packages/core/dist/schemas/index.js')).href);
const DomainConfig = schemaMod.DomainConfig ?? schemaMod.DomainConfigSchema;
if (!DomainConfig) { console.error('DomainConfig export not found. Exports: ' + Object.keys(schemaMod).join(', ')); process.exit(2); }

const FILES = {
  domain: 'domain.yaml', taxonomy: 'taxonomy.yaml', source_policy: 'source_policy.yaml',
  evidence_model: 'evidence_model.yaml', risk_rules: 'risk_rules.yaml',
  review_workflow: 'review_workflow.yaml', eval_questions: 'eval_questions.yaml',
};
const loadDir = (dir) => Object.fromEntries(Object.entries(FILES).map(([k, f]) => {
  const p = join(dir, f); return [k, existsSync(p) ? parse(readFileSync(p, 'utf8')) : undefined];
}));

const targets = [];
const tmplRoot = join(ROOT, 'packages/domain-templates');
for (const d of readdirSync(tmplRoot, { withFileTypes: true }))
  if (d.isDirectory()) targets.push([`template:${d.name}`, join(tmplRoot, d.name)]);
const domainsRoot = join(ROOT, 'domains');
if (existsSync(domainsRoot))
  for (const d of readdirSync(domainsRoot, { withFileTypes: true }))
    if (d.isDirectory()) targets.push([`domain:${d.name}`, join(domainsRoot, d.name)]);

let failures = 0;
for (const [label, dir] of targets) {
  const r = DomainConfig.safeParse(loadDir(dir));
  if (r.success) console.log(`PASS  ${label}`);
  else { failures++; console.log(`FAIL  ${label}`); for (const i of r.error.issues.slice(0, 12)) console.log(`        ${i.path.join('.')}: ${i.message}`); }
}
console.log(`\n${failures === 0 ? 'ALL_VALID' : failures + '_FAILURES'}`);
process.exit(failures === 0 ? 0 : 1);
