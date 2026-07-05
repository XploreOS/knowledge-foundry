// Pure, deterministic identifier builders (ADR-014). Every artefact id in the
// system is produced here so id formats live in exactly one place. No IO.

/**
 * Lowercase-slug a string: collapse any run of non-alphanumeric characters to
 * a single hyphen and trim leading/trailing hyphens. Guarantees a value that
 * satisfies the `Id` schema (starts with an alphanumeric); returns "x" for
 * input that contains no alphanumeric characters.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'x' : slug;
}

/** Chunk id: `<source_id>#<zero-padded-seq>`, e.g. `nih-ods-vitamin-d#0007`. */
export function chunkId(sourceId: string, seq: number): string {
  return `${sourceId}#${String(seq).padStart(4, '0')}`;
}

/** Claim id: `<source_id>-claim-<seq>`. */
export function claimId(sourceId: string, seq: number): string {
  return `${sourceId}-claim-${seq}`;
}

/** Risk id: `<source_id>-risk-<seq>`. */
export function riskId(sourceId: string, seq: number): string {
  return `${sourceId}-risk-${seq}`;
}

/** Conflict id: `<domain>-conflict-<seq>`. */
export function conflictId(domain: string, seq: number): string {
  return `${slugify(domain)}-conflict-${seq}`;
}

/**
 * Review id: `<domain>-review-<zero-padded-seq>`, e.g. `demo-review-0007`.
 * Zero-padded so reviews.jsonl (sorted by id, ADR-006) stays in recording order.
 */
export function reviewId(domain: string, seq: number): string {
  return `${slugify(domain)}-review-${String(seq).padStart(4, '0')}`;
}

/** The on-disk directory name for a release is simply its release id. */
export function releaseDirName(releaseId: string): string {
  return releaseId;
}
