// Domain lifecycle: scaffold a new domain from a template, and validate an
// existing domain's configuration (contract-spec §3, ADR-013). initDomain
// copies a template's seven YAML files and rewrites the domain identity.

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  resolveRoot,
  domainDir,
  domainConfigFile,
  DOMAIN_CONFIG_FILES,
  exists,
  readText,
  writeText,
  ensureDir,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';
import { tryLoadDomainConfig } from '../storage/index.js';

export interface InitDomainOptions extends WorkspaceOpts {
  /** Template name under the domain-templates directory (default 'generic'). */
  template?: string;
  /** Explicit path to the domain-templates directory. */
  templatesDir?: string;
}

/** Candidate locations for the domain-templates directory, in priority order. */
function templatesDirCandidates(root: string, explicit?: string): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    ...(explicit ? [explicit] : []),
    path.join(root, 'packages', 'domain-templates'),
    // Resolve relative to this compiled module: packages/core/dist/domain -> packages/domain-templates
    path.resolve(here, '..', '..', '..', 'domain-templates'),
  ];
}

async function resolveTemplatesDir(root: string, explicit?: string): Promise<string> {
  for (const candidate of templatesDirCandidates(root, explicit)) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(
    'could not locate the domain-templates directory — pass { templatesDir } explicitly',
  );
}

/**
 * Scaffold domains/<domainId>/ from a template. Copies the six domain config
 * files verbatim (preserving comments) and rewrites domain.yaml so its
 * domain_id (and any display_name reference to the template id) match the new
 * domain. Refuses to overwrite an existing domain unless `force`.
 */
export async function initDomain(domainId: string, opts?: InitDomainOptions): Promise<string> {
  const root = resolveRoot(opts);
  const template = opts?.template ?? 'generic';
  const target = domainDir(root, domainId);

  if (!opts?.force && (await exists(target))) {
    throw new Error(`domain ${domainId} already exists at ${target} — pass { force: true } to overwrite`);
  }

  const templatesDir = await resolveTemplatesDir(root, opts?.templatesDir);
  const templateDir = path.join(templatesDir, template);
  if (!(await exists(templateDir))) {
    throw new Error(`template "${template}" not found under ${templatesDir}`);
  }

  await ensureDir(target);

  for (const fileName of DOMAIN_CONFIG_FILES) {
    const src = path.join(templateDir, fileName);
    if (!(await exists(src))) {
      throw new Error(`template "${template}" is missing ${fileName} (${src})`);
    }
    const raw = await readText(src);
    if (fileName === 'domain.yaml') {
      const parsed = parseYaml(raw) as Record<string, unknown>;
      const oldId = typeof parsed.domain_id === 'string' ? parsed.domain_id : undefined;
      parsed.domain_id = domainId;
      if (typeof parsed.display_name === 'string' && oldId !== undefined && oldId !== domainId) {
        parsed.display_name = parsed.display_name.split(oldId).join(domainId);
      }
      await writeText(domainConfigFile(root, domainId, fileName), stringifyYaml(parsed));
    } else {
      await writeText(domainConfigFile(root, domainId, fileName), raw);
    }
  }

  return target;
}

export interface ValidateDomainResult {
  valid: boolean;
  issues: string[];
}

/** Load + validate a domain configuration, returning a structured verdict. */
export async function validateDomain(
  domainId: string,
  opts?: WorkspaceOpts,
): Promise<ValidateDomainResult> {
  const result = await tryLoadDomainConfig(domainId, opts);
  return result.ok ? { valid: true, issues: [] } : { valid: false, issues: result.issues };
}
