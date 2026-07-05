// Shared helpers for the Knowledge Foundry test suite. Test files live under
// tests/unit/ and tests/integration/; this module is support code only (it is
// not matched by the vitest include globs).

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AllowedUses,
  DomainConfig,
  emptyAllowedUses,
} from '@knowledge-foundry/core';
import type {
  ChunkRecord,
  RiskRecord,
  SourceRecord,
} from '@knowledge-foundry/core';

/** Absolute repo root (tests/ sits directly under it). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The built CLI binary the integration tests spawn. */
export const CLI_PATH = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');

/** Directory holding committed test fixtures. */
export const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures');

export const NOW = '2026-07-04T12:00:00Z';

/** Create a fresh temp workspace root. */
export async function makeTempRoot(prefix = 'kf-test-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Recursively remove a temp workspace (best-effort, Windows-safe). */
export async function removeTempRoot(root: string | undefined): Promise<void> {
  if (!root) return;
  await fs.rm(root, { recursive: true, force: true, maxRetries: 3 });
}

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  /** stdout + stderr combined, for convenience assertions. */
  output: string;
}

/**
 * Run `node packages/cli/dist/index.js --root <root> <args...>` from the repo
 * root (so init-domain resolves packages/domain-templates). Never throws on a
 * non-zero exit — the exit code is part of what the tests assert.
 */
export function runKf(root: string, args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_PATH, '--root', root, ...args],
      { cwd: REPO_ROOT, windowsHide: true },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
            ? ((error as unknown as { code: number }).code)
            : error
              ? 1
              : 0;
        resolve({ code, stdout, stderr, output: `${stdout}\n${stderr}` });
      },
    );
  });
}

/** A valid SourceRecord with overridable fields. */
export function makeSource(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    source_id: 'test-source',
    title: 'Test Source',
    publisher: 'Test Publisher',
    canonical_url: 'https://example.com/test-source',
    source_type: 'guideline',
    domain: 'demo',
    topics: ['policies'],
    likely_license: 'Green',
    ingestion_priority: 'P1',
    review_state: 'candidate',
    approval_status: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

/** A valid ChunkRecord with overridable fields. */
export function makeChunk(overrides: Partial<ChunkRecord> = {}): ChunkRecord {
  return {
    chunk_id: 'test-source#0000',
    source_id: 'test-source',
    section_path: 'Handbook > Policies',
    text: 'Employees should read the travel policy.',
    citation: 'https://example.com/test-source',
    license_class: 'Green',
    allowed_uses: { ...emptyAllowedUses(), internal_search: true, rag: true },
    review_state: 'chunked',
    created_at: NOW,
    ...overrides,
  };
}

/** A valid RiskRecord with overridable fields. */
export function makeRisk(overrides: Partial<RiskRecord> = {}): RiskRecord {
  return {
    risk_id: 'test-source-risk-1',
    source_id: 'test-source',
    chunk_id: 'test-source#0000',
    risk_type: 'unsupported_claim',
    severity: 'high',
    action: 'block',
    description: 'Unsupported superlative claim.',
    resolved: false,
    ...overrides,
  };
}

function uses(granted: Partial<AllowedUses>): AllowedUses {
  return { ...emptyAllowedUses(), ...granted };
}

export interface MakeDomainConfigOptions {
  /** Overrides Green's default_allowed_uses (e.g. to grant fine_tuning). */
  greenAllowedUses?: Partial<AllowedUses>;
  uncertainDefaultsTo?: 'Green' | 'Yellow' | 'Orange' | 'Red';
}

/**
 * Build a fully valid in-memory DomainConfig mirroring the generic template's
 * policy semantics, parsed through the real zod schema so tests exercise the
 * same shapes the YAML loader produces.
 */
export function makeDomainConfig(opts: MakeDomainConfigOptions = {}): DomainConfig {
  return DomainConfig.parse({
    domain: {
      domain_id: 'demo',
      display_name: 'Demo Domain',
      description: 'In-memory domain config for unit tests.',
      version: '0.1.0',
      primary_use_cases: ['internal knowledge base search'],
      prohibited_use_cases: ['autonomous decision-making without human review'],
      review_roles: ['legal', 'domain_sme', 'product_owner'],
      default_release_use: 'rag',
    },
    taxonomy: {
      entity_types: [{ id: 'topic', name: 'Topic' }],
      chunk_types: [{ id: 'section', name: 'Section' }],
      audiences: ['internal_staff'],
      metadata_fields: [{ id: 'source_url', required: false }],
      topics: ['onboarding', 'policies'],
    },
    source_policy: {
      license_classes: {
        Green: {
          description: 'Safe to ingest and use broadly.',
          requires_review: false,
          default_allowed_uses: uses({
            internal_search: true,
            rag: true,
            extraction: true,
            summarization: true,
            ...(opts.greenAllowedUses ?? {}),
          }),
        },
        Yellow: {
          description: 'Unclear terms; legal review required.',
          requires_review: true,
          default_allowed_uses: uses({ internal_search: true }),
        },
        Orange: {
          description: 'Proprietary; contract approval required.',
          requires_review: true,
          default_allowed_uses: uses({}),
        },
        Red: {
          description: 'Prohibited from ingestion under any circumstance.',
          requires_review: false,
          default_allowed_uses: uses({}),
        },
      },
      blockers: ['No-redistribution license (block).'],
      uncertain_defaults_to: opts.uncertainDefaultsTo ?? 'Yellow',
    },
    evidence_model: {
      evidence_levels: {
        A: { name: 'authoritative', description: 'Major guideline or audited primary source.' },
        C: { name: 'primary_observational', description: 'Single primary source.' },
        X: { name: 'restricted', description: 'Prohibited for use as evidence.' },
      },
      default_level: 'C',
    },
    risk_rules: {
      categories: ['unsupported_claim'],
      rules: [
        {
          id: 'block-unverified-superlative-claims',
          category: 'unsupported_claim',
          description: 'Block absolute claims without a cited source.',
          match: { keywords: ['guaranteed'] },
          action: 'block',
          severity: 'medium',
        },
      ],
    },
    review_workflow: {
      stages: {
        license_review: { roles: ['legal'], required: true, quorum: 1 },
        safety_review: { roles: ['domain_sme'], required: true, quorum: 1 },
        evidence_review: { roles: ['domain_sme'], required: true, quorum: 1 },
        release_review: { roles: ['legal', 'product_owner'], required: true, quorum: 1 },
      },
    },
    eval_questions: {
      questions: [
        {
          id: 'eval-001',
          question: 'What is the process for onboarding a new employee?',
          topics: ['onboarding'],
          expects_citation: true,
        },
      ],
    },
  });
}

/** Write a JSONL file (creating parent directories) from plain records. */
export async function writeJsonlFile(file: string, records: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body = records.map((r) => JSON.stringify(r)).join('\n');
  await fs.writeFile(file, body === '' ? '' : `${body}\n`, 'utf8');
}

/** Read and parse every line of a JSONL file. */
export async function readJsonlFile<T = unknown>(file: string): Promise<T[]> {
  const raw = await fs.readFile(file, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T);
}

/** True when a path exists. */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
