// Storage path construction — the SINGLE owner of the Knowledge Foundry
// artefact layout (contract-spec.md §5, ADR-004). No other module builds a
// path by hand; every artefact directory/file is derived from a workspace
// root here so the layout can change in exactly one place.

import * as path from 'node:path';

/** Options accepted by every storage-backed operation. */
export interface WorkspaceOpts {
  /** Workspace root; overrides KF_ROOT / cwd when set. */
  root?: string;
  /** Permit overwrite of write-once (raw) artefacts. */
  force?: boolean;
}

/**
 * Resolve the workspace root: explicit `opts.root`, else the `KF_ROOT`
 * environment variable, else the current working directory (contract-spec §5).
 */
export function resolveRoot(opts?: Pick<WorkspaceOpts, 'root'>): string {
  return opts?.root ?? process.env.KF_ROOT ?? process.cwd();
}

// --- source registry -------------------------------------------------------

export function sourceRegistryDir(root: string, domain: string): string {
  return path.join(root, 'data', 'source_registry', domain);
}
export function sourceRegistryFile(root: string, domain: string): string {
  return path.join(sourceRegistryDir(root, domain), 'sources.jsonl');
}

// --- raw (write-once) ------------------------------------------------------

export function rawDir(root: string, sourceId: string): string {
  return path.join(root, 'data', 'raw', sourceId);
}
export function rawManifestFile(root: string, sourceId: string): string {
  return path.join(rawDir(root, sourceId), 'manifest.json');
}
export function rawFilePath(root: string, sourceId: string, fileName: string): string {
  return path.join(rawDir(root, sourceId), fileName);
}

// --- normalized ------------------------------------------------------------

export function normalizedDir(root: string, sourceId: string): string {
  return path.join(root, 'data', 'normalized', sourceId);
}
export function normalizedDocFile(root: string, sourceId: string): string {
  return path.join(normalizedDir(root, sourceId), 'document.md');
}
export function normalizedMetaFile(root: string, sourceId: string): string {
  return path.join(normalizedDir(root, sourceId), 'metadata.json');
}

// --- chunks ----------------------------------------------------------------

export function chunksDir(root: string, sourceId: string): string {
  return path.join(root, 'data', 'chunks', sourceId);
}
export function chunksFile(root: string, sourceId: string): string {
  return path.join(chunksDir(root, sourceId), 'chunks.jsonl');
}

// --- claims ----------------------------------------------------------------

export function claimsDir(root: string, sourceId: string): string {
  return path.join(root, 'data', 'claims', sourceId);
}
export function claimsFile(root: string, sourceId: string): string {
  return path.join(claimsDir(root, sourceId), 'claims.jsonl');
}

// --- risk ------------------------------------------------------------------

export function riskDir(root: string, sourceId: string): string {
  return path.join(root, 'data', 'risk', sourceId);
}
export function riskFile(root: string, sourceId: string): string {
  return path.join(riskDir(root, sourceId), 'risk.jsonl');
}

// --- conflicts (per domain) ------------------------------------------------

export function conflictsDir(root: string, domainId: string): string {
  return path.join(root, 'data', 'conflicts', domainId);
}
export function conflictsFile(root: string, domainId: string, topic: string): string {
  return path.join(conflictsDir(root, domainId), `${topic}.jsonl`);
}

// --- reviews (per domain) --------------------------------------------------

export function reviewsDir(root: string, domainId: string): string {
  return path.join(root, 'data', 'reviews', domainId);
}
export function reviewsFile(root: string, domainId: string): string {
  return path.join(reviewsDir(root, domainId), 'reviews.jsonl');
}

// --- releases (per domain / release) ---------------------------------------

export function releasesDir(root: string, domainId: string): string {
  return path.join(root, 'releases', domainId);
}
export function releaseDir(root: string, domainId: string, releaseId: string): string {
  return path.join(releasesDir(root, domainId), releaseId);
}
export function releaseManifestFile(root: string, domainId: string, releaseId: string): string {
  return path.join(releaseDir(root, domainId, releaseId), 'manifest.json');
}
export function releaseChunksFile(root: string, domainId: string, releaseId: string): string {
  return path.join(releaseDir(root, domainId, releaseId), 'approved_chunks.jsonl');
}

// --- evals (per release) ---------------------------------------------------

export function evalsDir(root: string, releaseId: string): string {
  return path.join(root, 'evals', releaseId);
}
export function evalsResultsFile(root: string, releaseId: string): string {
  return path.join(evalsDir(root, releaseId), 'results.json');
}

// --- domain configuration --------------------------------------------------

export function domainDir(root: string, domainId: string): string {
  return path.join(root, 'domains', domainId);
}
export function domainConfigFile(root: string, domainId: string, fileName: string): string {
  return path.join(domainDir(root, domainId), fileName);
}

/** The seven YAML files that make up a domain configuration, in load order. */
export const DOMAIN_CONFIG_FILES = [
  'domain.yaml',
  'taxonomy.yaml',
  'source_policy.yaml',
  'evidence_model.yaml',
  'risk_rules.yaml',
  'review_workflow.yaml',
  'eval_questions.yaml',
] as const;
