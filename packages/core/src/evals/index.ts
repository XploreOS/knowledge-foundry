// RAG evaluation (contract-spec §2 EvaluationResult). Deterministic term-
// overlap retrieval over a release's approved chunks, scored for citation
// coverage, retrieval precision, unsafe output rate and license errors.

import { ChunkRecord, EvaluationResult, RiskRecord, ReleaseManifest } from '../schemas/index.js';
import type {
  ChunkRecord as ChunkRecordType,
  DomainConfig,
  EvaluationResult as EvaluationResultType,
} from '../schemas/index.js';
import { listSources } from '../sourceRegistry/index.js';
import {
  resolveRoot,
  releaseChunksFile,
  releaseManifestFile,
  riskFile,
  evalsResultsFile,
  readJson,
  readJsonl,
  readJsonlIfExists,
  writeJson,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'and', 'or', 'in', 'on', 'for',
  'with', 'at', 'by', 'from', 'as', 'that', 'this', 'it', 'i', 'you', 'what', 'where', 'when',
  'who', 'how', 'do', 'does', 'can', 'my', 'me', 'find', 'current', 'version',
]);

const TOP_K = 5;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

/** Rank chunks by term overlap with the query; return the top-K with score>0. */
function retrieve(queryTokens: string[], chunks: ChunkRecordType[]): ChunkRecordType[] {
  const querySet = new Set(queryTokens);
  const scored = chunks.map((chunk) => {
    const chunkTokens = new Set(tokenize(chunk.text));
    let score = 0;
    for (const token of querySet) if (chunkTokens.has(token)) score += 1;
    return { chunk, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) =>
      b.score - a.score || (a.chunk.chunk_id < b.chunk.chunk_id ? -1 : a.chunk.chunk_id > b.chunk.chunk_id ? 1 : 0),
    )
    .slice(0, TOP_K)
    .map((s) => s.chunk);
}

export interface EvalRagInput extends WorkspaceOpts {
  releaseId: string;
  domainId: string;
  now?: string;
}

/**
 * Evaluate a release's retrieval against the domain's eval questions, write
 * evals/<releaseId>/results.json and fold the result into the release manifest.
 */
export async function evalRag(
  input: EvalRagInput,
  domainConfig: DomainConfig,
): Promise<EvaluationResultType> {
  const root = resolveRoot(input);
  const now = input.now ?? new Date().toISOString();
  const { releaseId, domainId } = input;

  const chunks = await readJsonl(releaseChunksFile(root, domainId, releaseId), ChunkRecord);

  // Chunk ids flagged by an unresolved high-severity risk anywhere in the domain.
  const sources = await listSources(domainId, { root });
  const unsafeChunkIds = new Set<string>();
  for (const source of sources) {
    const risks = await readJsonlIfExists(riskFile(root, source.source_id), RiskRecord);
    for (const risk of risks) {
      if (risk.resolved === false && risk.severity === 'high' && risk.chunk_id) {
        unsafeChunkIds.add(risk.chunk_id);
      }
    }
  }

  const questions = domainConfig.eval_questions.questions;
  const perQuestion: EvaluationResultType['per_question'] = [];

  let totalRetrieved = 0;
  let withCitation = 0;
  let unsafeRetrieved = 0;
  let licenseErrors = 0;
  let precisionHits = 0;

  for (const q of questions) {
    const retrieved = retrieve(tokenize(q.question), chunks);
    const questionTopics = new Set(q.topics);
    const hasTopicMatch = retrieved.some((c) => (c.topics ?? []).some((t) => questionTopics.has(t)));
    const anyUnsafe = retrieved.some((c) => unsafeChunkIds.has(c.chunk_id));
    const allCited = retrieved.length > 0 && retrieved.every((c) => c.citation.trim() !== '');

    for (const chunk of retrieved) {
      totalRetrieved += 1;
      if (chunk.citation.trim() !== '') withCitation += 1;
      if (unsafeChunkIds.has(chunk.chunk_id)) unsafeRetrieved += 1;
      if ((chunk.license_class ?? 'Unknown') === 'Red') licenseErrors += 1;
    }
    if (hasTopicMatch) precisionHits += 1;

    perQuestion.push({
      question: q.question,
      retrieved_chunk_ids: retrieved.map((c) => c.chunk_id),
      has_citation: allCited,
      unsafe: anyUnsafe,
    });
  }

  const result: EvaluationResultType = EvaluationResult.parse({
    release_id: releaseId,
    domain_id: domainId,
    evaluated_at: now,
    question_count: questions.length,
    citation_coverage: totalRetrieved === 0 ? 1 : withCitation / totalRetrieved,
    retrieval_precision: questions.length === 0 ? 0 : precisionHits / questions.length,
    unsafe_output_rate: totalRetrieved === 0 ? 0 : unsafeRetrieved / totalRetrieved,
    license_errors: licenseErrors,
    per_question: perQuestion,
  });

  await writeJson(evalsResultsFile(root, releaseId), result);

  // Fold the evaluation into the release manifest.
  const manifestPath = releaseManifestFile(root, domainId, releaseId);
  const manifest = await readJson(manifestPath, ReleaseManifest);
  const updated = ReleaseManifest.parse({ ...manifest, evaluation: result, updated_at: now });
  await writeJson(manifestPath, updated);

  return result;
}
