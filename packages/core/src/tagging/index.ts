// Domain tagging (contract-spec §2 ChunkRecord tagging fields). Deterministic,
// rule-free string matching against the domain taxonomy/evidence model — no
// LLM, no randomness. Rewrites chunks.jsonl with review_state 'tagged'.

import { ChunkRecord } from '../schemas/index.js';
import type {
  ChunkRecord as ChunkRecordType,
  DomainConfig,
  SourceRecord as SourceRecordType,
} from '../schemas/index.js';
import { resolveRoot, chunksFile, readJsonl, writeJsonl } from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';

/** Candidate topic vocabulary: taxonomy.topics, else eval-question topics. */
function topicVocabulary(config: DomainConfig): string[] {
  if (config.taxonomy.topics && config.taxonomy.topics.length > 0) {
    return config.taxonomy.topics;
  }
  const fromQuestions = new Set<string>();
  for (const q of config.eval_questions.questions) {
    for (const t of q.topics) fromQuestions.add(t);
  }
  return [...fromQuestions];
}

function includesCI(haystack: string, needle: string): boolean {
  if (needle.trim() === '') return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Tag each chunk of a source deterministically from the domain config:
 * topics/entities by name match, chunk_type by first taxonomy match, a default
 * evidence level and the primary audience.
 */
export async function tagChunks(
  source: SourceRecordType,
  domainConfig: DomainConfig,
  opts?: WorkspaceOpts,
): Promise<ChunkRecordType[]> {
  const root = resolveRoot(opts);
  const file = chunksFile(root, source.source_id);
  const chunks = await readJsonl(file, ChunkRecord);

  const topics = topicVocabulary(domainConfig);
  const entityTypes = domainConfig.taxonomy.entity_types;
  const chunkTypes = domainConfig.taxonomy.chunk_types;
  const audiences = domainConfig.taxonomy.audiences;

  const evidenceKeys = Object.keys(domainConfig.evidence_model.evidence_levels);
  const defaultEvidence =
    domainConfig.evidence_model.default_level ?? evidenceKeys[evidenceKeys.length - 1];

  const sectionChunkType = chunkTypes.find((c) => c.id === 'section');
  const fallbackChunkType = sectionChunkType?.id ?? chunkTypes[0]?.id;

  const tagged = chunks.map((chunk) => {
    const text = chunk.text;
    const haystack = `${chunk.section_path}\n${text}`;

    const chunkTopics = topics.filter((topic) => includesCI(text, topic));

    const entities: { type: string; value: string }[] = [];
    for (const et of entityTypes) {
      if (includesCI(text, et.name)) {
        entities.push({ type: et.id, value: et.name });
      } else if (includesCI(text, et.id)) {
        entities.push({ type: et.id, value: et.id });
      }
    }

    const matchedChunkType = chunkTypes.find(
      (ct) => includesCI(haystack, ct.id) || includesCI(haystack, ct.name),
    );
    const chunkType = matchedChunkType?.id ?? fallbackChunkType;

    const next: Record<string, unknown> = {
      ...chunk,
      topics: chunkTopics,
      entities,
      review_state: 'tagged',
    };
    if (chunkType !== undefined) next.chunk_type = chunkType;
    if (defaultEvidence !== undefined) next.evidence_level = defaultEvidence;
    if (audiences.length > 0) next.audience = [audiences[0]];

    return ChunkRecord.parse(next);
  });

  await writeJsonl(file, tagged, 'chunk_id');
  return tagged;
}
