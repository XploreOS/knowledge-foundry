// Shared option/validation helpers for every command: workspace-root plumbing,
// domain-config and source lookups with actionable errors, and small display
// formatters. Keeps each command file thin and the error wording consistent.

import type { Command } from 'commander';
import {
  ALLOWED_USE_KEYS,
  domainDir,
  exists,
  getSource,
  loadDomainConfig,
  resolveRoot,
} from '@knowledge-foundry/core';
import type {
  AllowedUseKey,
  AllowedUses,
  DomainConfig,
  SourceRecord,
  StageEvaluation,
  StageSignoff,
  WorkspaceOpts,
} from '@knowledge-foundry/core';
import { fail } from './output.js';

/** Merge in the global --root option and produce the WorkspaceOpts core expects. */
export function ws(command: Command): WorkspaceOpts {
  const root = command.optsWithGlobals().root as string | undefined;
  return root ? { root } : {};
}

/** Fail with an actionable message when a domain has not been initialised. */
export async function ensureDomain(domainId: string, opts: WorkspaceOpts): Promise<void> {
  if (!(await exists(domainDir(resolveRoot(opts), domainId)))) {
    fail(`domain "${domainId}" does not exist`, [
      `initialise it first: kf init-domain ${domainId}`,
    ]);
  }
}

/** Load + validate a domain config, or fail with an actionable message. */
export async function requireConfig(
  domainId: string,
  opts: WorkspaceOpts,
): Promise<DomainConfig> {
  try {
    return await loadDomainConfig(domainId, opts);
  } catch (err) {
    return fail(`domain "${domainId}" is missing or invalid`, [
      (err as Error).message,
      `check it with: kf validate-domain ${domainId}`,
    ]);
  }
}

/** Fetch a source record, or fail with an actionable message. */
export async function requireSource(
  domain: string,
  sourceId: string,
  opts: WorkspaceOpts,
): Promise<SourceRecord> {
  const source = await getSource(domain, sourceId, opts);
  if (!source) {
    return fail(`source "${sourceId}" not found in domain "${domain}"`, [
      `create it: kf create-source --domain ${domain} --source-id ${sourceId} --title <t> --publisher <p>`,
      `or import candidates: kf discover --domain ${domain} --from-file <file.jsonl>`,
    ]);
  }
  return source;
}

/** Render an AllowedUses object as a comma list of granted uses (or "none"). */
export function allowedUsesList(u?: AllowedUses): string {
  if (!u) return 'none';
  const granted = ALLOWED_USE_KEYS.filter((k) => u[k]);
  return granted.length > 0 ? granted.join(', ') : 'none';
}

function signoffs(list: StageSignoff[]): string {
  return list.length > 0 ? list.map((s) => `${s.reviewer}(${s.role})`).join(', ') : 'none';
}

/** One grep-able status line for a review-workflow stage quorum verdict. */
export function formatStageEvaluation(stage: StageEvaluation): string {
  const parts = [
    stage.satisfied ? 'satisfied' : 'NOT satisfied',
    `quorum=${stage.quorum} of [${stage.roles.join(', ')}]`,
    `required=${stage.required}`,
    `approvals: ${signoffs(stage.approvals)}`,
  ];
  if (stage.rejections.length > 0) parts.push(`rejections: ${signoffs(stage.rejections)}`);
  return parts.join(' — ');
}

/** Parse a comma-separated --intended-use value into validated AllowedUseKeys. */
export function parseIntendedUse(value: string): AllowedUseKey[] {
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  const invalid = parts.filter((p) => !(ALLOWED_USE_KEYS as readonly string[]).includes(p));
  if (invalid.length > 0) {
    return fail(`invalid intended use: ${invalid.join(', ')}`, [
      `allowed values: ${ALLOWED_USE_KEYS.join(', ')}`,
    ]);
  }
  return parts as AllowedUseKey[];
}
