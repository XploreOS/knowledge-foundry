// Deterministic guardrail gates (contract-spec §4, ADR-011). SAFETY-CRITICAL:
// these are PURE functions with no IO and no hidden state — the CLI, tests and
// skill hooks all call these exact functions so the rules live once, in code.
// A gate result comes only from here; agents may prepare data but never decide.

import type {
  AllowedUseKey,
  ChunkRecord,
  LicenseClass,
  RiskRecord,
  SourceRecord,
} from '../schemas/index.js';

/** Structured result of a single-artefact gate. */
export interface GateResult {
  allowed: boolean;
  reasons: string[];
}

/** Structured result of the aggregate pre-release gate. */
export interface ReleaseGateResult {
  allowed: boolean;
  blockers: string[];
}

/** Effective license class of a source: the classified value, else the guess. */
function effectiveLicenseClass(source: SourceRecord): LicenseClass | undefined {
  return source.license_class ?? source.likely_license;
}

/**
 * Pre-ingest gate — may this source be fetched and stored at all?
 *   - unclassified (no license_class) / Unknown  -> blocked ("classify first")
 *   - Red                                         -> blocked
 *   - Yellow | Orange without approval            -> blocked
 *   - Green (or approved Yellow/Orange)           -> allowed
 */
export function preIngestGate(source: SourceRecord): GateResult {
  const reasons: string[] = [];
  const lc = source.license_class;

  if (lc === undefined || lc === 'Unknown') {
    reasons.push(
      `source ${source.source_id} has no license classification — classify first`,
    );
    return { allowed: false, reasons };
  }
  if (lc === 'Red') {
    reasons.push(`source ${source.source_id} is license class Red — ingestion prohibited`);
    return { allowed: false, reasons };
  }
  if (lc === 'Yellow' || lc === 'Orange') {
    if (source.approval_status !== 'approved_for_ingestion') {
      reasons.push(
        `source ${source.source_id} is license class ${lc} and lacks approval_status=approved_for_ingestion`,
      );
      return { allowed: false, reasons };
    }
  }
  // Green, or an approved Yellow/Orange source.
  return { allowed: true, reasons };
}

/** Citation gate — a chunk with a missing/empty/whitespace citation is blocked. */
export function citationGate(chunk: ChunkRecord): GateResult {
  if (chunk.citation.trim() === '') {
    return {
      allowed: false,
      reasons: [`chunk ${chunk.chunk_id} has no citation`],
    };
  }
  return { allowed: true, reasons: [] };
}

/**
 * License-consistency gate — the intended use of a chunk must be permitted by
 * its originating source's allowed_uses. Blocked when the source does not
 * explicitly grant `intendedUse`.
 */
export function licenseConsistencyGate(
  chunk: ChunkRecord,
  source: SourceRecord,
  intendedUse: AllowedUseKey,
): GateResult {
  if (source.allowed_uses?.[intendedUse] !== true) {
    return {
      allowed: false,
      reasons: [
        `chunk ${chunk.chunk_id}: source ${source.source_id} does not permit intended use '${intendedUse}'`,
      ],
    };
  }
  return { allowed: true, reasons: [] };
}

/** Inputs to the aggregate pre-release evaluation. */
export interface ReleaseGateInput {
  sources: readonly SourceRecord[];
  chunks: readonly ChunkRecord[];
  risks: readonly RiskRecord[];
  intendedUse: AllowedUseKey | readonly AllowedUseKey[];
}

/** A named sub-check result, surfaced in the release manifest's gate_results. */
export interface ReleaseCheck {
  gate: string;
  passed: boolean;
  details: string;
}

/** Full evaluation of a release: overall verdict + per-gate breakdown. */
export interface ReleaseEvaluation {
  allowed: boolean;
  blockers: string[];
  checks: ReleaseCheck[];
}

/**
 * Evaluate every pre-release blocker (contract-spec §4). Returns the overall
 * verdict, the human-readable blocker list, and a per-gate breakdown for the
 * release manifest. preReleaseGate wraps this to expose the minimal contract.
 */
export function evaluateRelease(input: ReleaseGateInput): ReleaseEvaluation {
  const uses: AllowedUseKey[] = Array.isArray(input.intendedUse)
    ? [...input.intendedUse]
    : [input.intendedUse as AllowedUseKey];

  const blockers: string[] = [];

  // 1. Any Red member source.
  const redBlockers: string[] = [];
  for (const source of input.sources) {
    if (effectiveLicenseClass(source) === 'Red') {
      redBlockers.push(`source ${source.source_id} is license class Red`);
    }
  }

  // 2. Yellow/Orange member source lacking approval.
  const approvalBlockers: string[] = [];
  for (const source of input.sources) {
    const lc = effectiveLicenseClass(source);
    if ((lc === 'Yellow' || lc === 'Orange') && source.approval_status !== 'approved_for_ingestion') {
      approvalBlockers.push(
        `source ${source.source_id} (${lc}) lacks approval_status=approved_for_ingestion`,
      );
    }
  }

  // 3. Unresolved high-severity risk.
  const riskBlockers: string[] = [];
  for (const risk of input.risks) {
    if (risk.resolved === false && risk.severity === 'high') {
      const on = risk.chunk_id ? ` on chunk ${risk.chunk_id}` : '';
      riskBlockers.push(`unresolved high-severity risk ${risk.risk_id}${on}`);
    }
  }

  // 4. Any chunk failing the citation gate.
  const citationBlockers: string[] = [];
  for (const chunk of input.chunks) {
    if (!citationGate(chunk).allowed) {
      citationBlockers.push(`chunk ${chunk.chunk_id} has no citation`);
    }
  }

  // 5. Intended use(s) not permitted by EVERY member source.
  const useBlockers: string[] = [];
  for (const use of uses) {
    for (const source of input.sources) {
      if (source.allowed_uses?.[use] !== true) {
        useBlockers.push(`source ${source.source_id} does not permit intended use '${use}'`);
      }
    }
  }

  // 6. fine_tuning intended but a member source lacks explicit training rights.
  const fineTuningBlockers: string[] = [];
  if (uses.includes('fine_tuning')) {
    for (const source of input.sources) {
      if (source.allowed_uses?.fine_tuning !== true) {
        fineTuningBlockers.push(
          `fine_tuning requested but source ${source.source_id} lacks fine_tuning rights`,
        );
      }
    }
  }

  // Preserve blocker order (1..6), then dedupe exact duplicates deterministically.
  for (const group of [
    redBlockers,
    approvalBlockers,
    riskBlockers,
    citationBlockers,
    useBlockers,
    fineTuningBlockers,
  ]) {
    for (const blocker of group) {
      if (!blockers.includes(blocker)) blockers.push(blocker);
    }
  }

  const checks: ReleaseCheck[] = [
    check('red_source', redBlockers, 'no Red-class member sources'),
    check('source_approval', approvalBlockers, 'all Yellow/Orange sources approved'),
    check('unresolved_high_risk', riskBlockers, 'no unresolved high-severity risks'),
    check('chunk_citation', citationBlockers, 'all chunks carry a citation'),
    check('intended_use_license', useBlockers, `intended use(s) [${uses.join(', ')}] permitted by all sources`),
    check('fine_tuning_rights', fineTuningBlockers, 'fine_tuning rights satisfied'),
  ];

  return { allowed: blockers.length === 0, blockers, checks };
}

function check(gate: string, failures: string[], passDetail: string): ReleaseCheck {
  return {
    gate,
    passed: failures.length === 0,
    details: failures.length === 0 ? passDetail : failures.join('; '),
  };
}

/**
 * Pre-release gate (contract-spec §4). Blocks a release when ANY of the six
 * blocker conditions hold; every blocker string names the offending id.
 */
export function preReleaseGate(input: ReleaseGateInput): ReleaseGateResult {
  const { allowed, blockers } = evaluateRelease(input);
  return { allowed, blockers };
}
