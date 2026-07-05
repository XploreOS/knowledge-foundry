// Release assembly (contract-spec §2 ReleaseManifest, ADR-010). Gathers a
// domain's advanced sources + their chunks/risks, runs the pre-release gate,
// and writes either a blocked manifest (no chunks) or a draft release.
// approveRelease then promotes a clean, evaluated, fully signed-off draft.

import {
  ChunkRecord,
  RiskRecord,
  ReleaseManifest,
  LICENSE_CLASSES,
} from '../schemas/index.js';
import type {
  AllowedUseKey,
  ChunkRecord as ChunkRecordType,
  DomainConfig,
  LicenseClass,
  ReleaseManifest as ReleaseManifestType,
  RiskRecord as RiskRecordType,
  SourceRecord as SourceRecordType,
} from '../schemas/index.js';
import { REVIEW_STATES } from '../schemas/index.js';
import { evaluateRelease, evaluateReviewWorkflow } from '../gates/index.js';
import type { StageEvaluation } from '../gates/index.js';
import { listSources } from '../sourceRegistry/index.js';
import { reviewsForTarget } from '../reviews/index.js';
import {
  resolveRoot,
  chunksFile,
  riskFile,
  releaseManifestFile,
  releaseChunksFile,
  readJson,
  readJsonlIfExists,
  writeJson,
  writeJsonl,
  readText,
  sha256,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';

const CANDIDATE_INDEX = REVIEW_STATES.indexOf('candidate');

/** A source is release-eligible when it has advanced past candidate and is
 *  neither rejected nor deprecated. */
function isAdvanced(source: SourceRecordType): boolean {
  const index = REVIEW_STATES.indexOf(source.review_state);
  return index > CANDIDATE_INDEX && source.review_state !== 'rejected' && source.review_state !== 'deprecated';
}

function effectiveClass(source: SourceRecordType): LicenseClass {
  return source.license_class ?? source.likely_license;
}

interface ReleaseData {
  sources: SourceRecordType[];
  chunks: ChunkRecordType[];
  risks: RiskRecordType[];
}

/** Load the sources/chunks/risks that make up a candidate release, sorted. */
async function loadReleaseData(root: string, domainId: string): Promise<ReleaseData> {
  const all = await listSources(domainId, { root });
  const sources = all.filter(isAdvanced).sort((a, b) => (a.source_id < b.source_id ? -1 : 1));
  const chunks: ChunkRecordType[] = [];
  const risks: RiskRecordType[] = [];
  for (const source of sources) {
    chunks.push(...(await readJsonlIfExists(chunksFile(root, source.source_id), ChunkRecord)));
    risks.push(...(await readJsonlIfExists(riskFile(root, source.source_id), RiskRecord)));
  }
  chunks.sort((a, b) => (a.chunk_id < b.chunk_id ? -1 : a.chunk_id > b.chunk_id ? 1 : 0));
  risks.sort((a, b) => (a.risk_id < b.risk_id ? -1 : a.risk_id > b.risk_id ? 1 : 0));
  return { sources, chunks, risks };
}

function licenseClassCounts(sources: SourceRecordType[]): Record<LicenseClass, number> {
  const counts = Object.fromEntries(LICENSE_CLASSES.map((c) => [c, 0])) as Record<LicenseClass, number>;
  for (const source of sources) counts[effectiveClass(source)] += 1;
  return counts;
}

function evidenceSummary(chunks: ChunkRecordType[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    const key = chunk.evidence_level ?? 'unspecified';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const summary: Record<string, number> = {};
  for (const key of [...counts.keys()].sort()) summary[key] = counts.get(key) ?? 0;
  return summary;
}

export interface BuildReleaseInput extends WorkspaceOpts {
  domainId: string;
  releaseId: string;
  intendedUse: AllowedUseKey | AllowedUseKey[];
  now?: string;
}

export interface BuildReleaseResult {
  blocked: boolean;
  manifest: ReleaseManifestType;
}

/**
 * Build a release. When the pre-release gate blocks, writes a `blocked`
 * manifest and NO approved_chunks.jsonl. Otherwise writes approved_chunks.jsonl
 * and a `draft` manifest with member-file checksums.
 */
export async function buildRelease(input: BuildReleaseInput): Promise<BuildReleaseResult> {
  const root = resolveRoot(input);
  const now = input.now ?? new Date().toISOString();
  const { domainId, releaseId, intendedUse } = input;

  const { sources, chunks, risks } = await loadReleaseData(root, domainId);
  const evaluation = evaluateRelease({ sources, chunks, risks, intendedUse });

  const base = {
    release_id: releaseId,
    domain_id: domainId,
    created_at: now,
    updated_at: now,
    intended_use: intendedUse,
    source_count: sources.length,
    sources: sources.map((s) => ({ source_id: s.source_id, license_class: effectiveClass(s) })),
    license_class_counts: licenseClassCounts(sources),
    evidence_summary: evidenceSummary(chunks),
    chunk_count: chunks.length,
    gate_results: evaluation.checks,
  };

  if (!evaluation.allowed) {
    const manifest = ReleaseManifest.parse({
      ...base,
      state: 'blocked',
      blockers: evaluation.blockers,
      member_files: [],
    });
    await writeJson(releaseManifestFile(root, domainId, releaseId), manifest);
    return { blocked: true, manifest };
  }

  // Write approved chunks first so we can checksum the member file.
  const chunksFilePath = releaseChunksFile(root, domainId, releaseId);
  await writeJsonl(chunksFilePath, chunks, 'chunk_id');
  const chunksChecksum = sha256(await readText(chunksFilePath));

  const manifest = ReleaseManifest.parse({
    ...base,
    state: 'draft',
    blockers: [],
    member_files: [{ path: 'approved_chunks.jsonl', checksum_sha256: chunksChecksum }],
  });
  await writeJson(releaseManifestFile(root, domainId, releaseId), manifest);
  return { blocked: false, manifest };
}

export interface ValidateReleaseInput extends WorkspaceOpts {
  domainId: string;
  releaseId: string;
}

export interface ValidateReleaseResult {
  valid: boolean;
  blockers: string[];
  manifest: ReleaseManifestType;
}

/**
 * Re-read an existing release manifest and the current domain data, then
 * re-run the pre-release gate. Confirms the release still holds against the
 * live corpus.
 */
export async function validateRelease(input: ValidateReleaseInput): Promise<ValidateReleaseResult> {
  const root = resolveRoot(input);
  const manifest = await readJson(
    releaseManifestFile(root, input.domainId, input.releaseId),
    ReleaseManifest,
  );
  const { sources, chunks, risks } = await loadReleaseData(root, input.domainId);
  const { allowed, blockers } = evaluateRelease({
    sources,
    chunks,
    risks,
    intendedUse: manifest.intended_use,
  });
  return { valid: allowed, blockers, manifest };
}

export interface ApproveReleaseInput extends WorkspaceOpts {
  domainId: string;
  releaseId: string;
  now?: string;
}

export interface ApproveReleaseResult {
  approved: boolean;
  blockers: string[];
  /** Per-stage quorum breakdown from the review-workflow gate. */
  stages: StageEvaluation[];
  manifest: ReleaseManifestType;
}

/**
 * Promote a draft release to `approved` (release-model.md). Approval requires
 * ALL of:
 *   1. the manifest is in state `draft` (immutability: approved/indexed/
 *      deprecated manifests are never re-edited; blocked ones are rebuilt),
 *   2. the pre-release gate still passes against the live corpus,
 *   3. an EvaluationResult is attached (kf eval-rag has run),
 *   4. every required review_workflow.yaml stage has its recorded sign-off
 *      quorum on THIS release (ReviewRecords with target_type=release).
 * On any blocker the manifest is left untouched and the reasons are returned.
 */
export async function approveRelease(
  config: DomainConfig,
  input: ApproveReleaseInput,
): Promise<ApproveReleaseResult> {
  const root = resolveRoot(input);
  const now = input.now ?? new Date().toISOString();
  const manifestPath = releaseManifestFile(root, input.domainId, input.releaseId);
  const manifest = await readJson(manifestPath, ReleaseManifest);

  const blockers: string[] = [];

  if (manifest.state !== 'draft') {
    blockers.push(
      manifest.state === 'blocked'
        ? `release is blocked — fix the underlying issues and re-run build-release`
        : `release is already ${manifest.state} — releases are immutable after draft; build a new release_id instead`,
    );
  }

  const { sources, chunks, risks } = await loadReleaseData(root, input.domainId);
  const gate = evaluateRelease({ sources, chunks, risks, intendedUse: manifest.intended_use });
  blockers.push(...gate.blockers);

  if (manifest.evaluation === undefined) {
    blockers.push('no EvaluationResult attached — run eval-rag before approval');
  }

  const reviews = await reviewsForTarget(input.domainId, 'release', input.releaseId, input);
  const workflow = evaluateReviewWorkflow(config.review_workflow, reviews);
  blockers.push(...workflow.blockers);

  if (blockers.length > 0) {
    return { approved: false, blockers, stages: workflow.stages, manifest };
  }

  const approved = ReleaseManifest.parse({ ...manifest, state: 'approved', updated_at: now });
  await writeJson(manifestPath, approved);
  return { approved: true, blockers: [], stages: workflow.stages, manifest: approved };
}
