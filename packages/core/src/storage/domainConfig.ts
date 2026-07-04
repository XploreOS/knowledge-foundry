// Loading + validation of a domain's seven YAML config files into a single
// typed DomainConfig (contract-spec §3, ADR-005). Missing files and schema
// violations produce actionable errors listing every problem.

import { parse as parseYaml } from 'yaml';
import { DomainConfig } from '../schemas/index.js';
import type { DomainConfig as DomainConfigType } from '../schemas/index.js';
import { resolveRoot, domainConfigFile } from './paths.js';
import type { WorkspaceOpts } from './paths.js';
import { exists, readText } from './io.js';

/** Result of attempting to load a domain config without throwing. */
export type LoadDomainConfigResult =
  | { ok: true; config: DomainConfigType }
  | { ok: false; issues: string[] };

const FILE_KEYS = [
  ['domain.yaml', 'domain'],
  ['taxonomy.yaml', 'taxonomy'],
  ['source_policy.yaml', 'source_policy'],
  ['evidence_model.yaml', 'evidence_model'],
  ['risk_rules.yaml', 'risk_rules'],
  ['review_workflow.yaml', 'review_workflow'],
  ['eval_questions.yaml', 'eval_questions'],
] as const;

/**
 * Read + validate the seven config files for a domain, returning a result
 * object rather than throwing. Used by validateDomain; loadDomainConfig wraps
 * this and throws on failure.
 */
export async function tryLoadDomainConfig(
  domainId: string,
  opts?: WorkspaceOpts,
): Promise<LoadDomainConfigResult> {
  const root = resolveRoot(opts);
  const assembled: Record<string, unknown> = {};
  const issues: string[] = [];

  for (const [fileName, key] of FILE_KEYS) {
    const file = domainConfigFile(root, domainId, fileName);
    if (!(await exists(file))) {
      issues.push(`missing ${fileName} for domain ${domainId}`);
      continue;
    }
    try {
      assembled[key] = parseYaml(await readText(file));
    } catch (err) {
      issues.push(`${fileName}: YAML parse error — ${(err as Error).message}`);
    }
  }

  // A missing/unparseable file makes structural validation meaningless.
  if (issues.length > 0) return { ok: false, issues };

  const result = DomainConfig.safeParse(assembled);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    };
  }
  return { ok: true, config: result.data };
}

/**
 * Load + validate a domain configuration. Throws an Error listing every
 * missing file / zod issue on failure (contract-spec §5).
 */
export async function loadDomainConfig(
  domainId: string,
  opts?: WorkspaceOpts,
): Promise<DomainConfigType> {
  const result = await tryLoadDomainConfig(domainId, opts);
  if (!result.ok) {
    throw new Error(
      `invalid domain configuration for "${domainId}":\n  - ${result.issues.join('\n  - ')}`,
    );
  }
  return result.config;
}
