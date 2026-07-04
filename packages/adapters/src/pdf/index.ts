// PDF adapter: PDF text extraction is out of scope for v0.1. This throws a
// clear, actionable error directing callers to supply pre-extracted content.

/** Always throws: PDF ingestion is unsupported in v0.1. */
export function extractPdf(): never {
  throw new Error(
    'PDF ingestion is not supported in v0.1; supply pre-extracted markdown or text alongside the source.',
  );
}
