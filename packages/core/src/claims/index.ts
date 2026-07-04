// Claim extraction (contract-spec §2 ClaimRecord). A deterministic scaffold:
// one claim per chunk that contains a recommendation/claim marker, with the
// analytical fields left blank for a human SME / agent to complete.

import { ChunkRecord, ClaimRecord } from '../schemas/index.js';
import type { ClaimRecord as ClaimRecordType, SourceRecord as SourceRecordType } from '../schemas/index.js';
import { claimId } from '../ids/index.js';
import { resolveRoot, chunksFile, claimsFile, readJsonl, writeJsonl } from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';
import { splitSentences } from '../internal/text.js';

/** Case-insensitive markers that signal a recommendation or empirical claim. */
const CLAIM_MARKERS = [
  'should',
  'must',
  'recommended',
  'associated with',
  'increases',
  'decreases',
  'improves',
  'reduces',
];

function firstClaimSentence(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (!CLAIM_MARKERS.some((m) => lower.includes(m))) return undefined;
  for (const sentence of splitSentences(text)) {
    const s = sentence.toLowerCase();
    if (CLAIM_MARKERS.some((m) => s.includes(m))) return sentence;
  }
  // Marker present but no clean sentence split — fall back to the whole text.
  return text.trim();
}

/**
 * Extract scaffold claims from a source's tagged chunks, writing claims.jsonl.
 * Population/intervention/outcome/limitations are intentionally empty for
 * downstream human structuring; evidence level is inherited from the chunk.
 */
export async function extractClaims(
  source: SourceRecordType,
  opts?: WorkspaceOpts,
): Promise<ClaimRecordType[]> {
  const root = resolveRoot(opts);
  const chunks = await readJsonl(chunksFile(root, source.source_id), ChunkRecord);

  const claims: ClaimRecordType[] = [];
  let seq = 1;
  for (const chunk of chunks) {
    const claimText = firstClaimSentence(chunk.text);
    if (claimText === undefined) continue;
    claims.push(
      ClaimRecord.parse({
        claim_id: claimId(source.source_id, seq),
        source_id: source.source_id,
        chunk_id: chunk.chunk_id,
        claim_text: claimText,
        population_or_scope: '',
        intervention: '',
        outcome: '',
        evidence_level: chunk.evidence_level ?? 'D',
        limitations: '',
        review_state: 'needs_review',
      }),
    );
    seq += 1;
  }

  await writeJsonl(claimsFile(root, source.source_id), claims, 'claim_id');
  return claims;
}
