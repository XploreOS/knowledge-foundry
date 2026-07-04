// Conflict detection (contract-spec §2 ConflictRecord). Deterministic pairwise
// comparison of chunks that share a topic tag: divergent numeric claims, or an
// explicit recommend-vs-avoid contradiction. Simple + deterministic by design.

import { ChunkRecord, ConflictRecord } from '../schemas/index.js';
import type { ChunkRecord as ChunkRecordType, ConflictRecord as ConflictRecordType } from '../schemas/index.js';
import { conflictId } from '../ids/index.js';
import { listSources } from '../sourceRegistry/index.js';
import {
  resolveRoot,
  chunksFile,
  conflictsFile,
  readJsonlIfExists,
  writeJsonl,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';
import { extractNumbers } from '../internal/text.js';

const NEGATION_MARKERS = ['not recommended', 'avoid', 'contraindicated', 'should not'];
const AFFIRMATION_MARKERS = ['recommended', 'should'];

function hasAny(text: string, markers: string[]): boolean {
  return markers.some((m) => text.includes(m));
}

/** Compare an ordered pair; return a conflict "nature" string, or null. */
function conflictNature(a: ChunkRecordType, b: ChunkRecordType): string | null {
  const aNums = new Set(extractNumbers(a.text));
  const bNums = new Set(extractNumbers(b.text));
  if (aNums.size > 0 && bNums.size > 0) {
    const same = aNums.size === bNums.size && [...aNums].every((n) => bNums.has(n));
    if (!same) {
      return `divergent numeric values (${[...aNums].join(', ')} vs ${[...bNums].join(', ')})`;
    }
  }

  const aLower = a.text.toLowerCase();
  const bLower = b.text.toLowerCase();
  const aNeg = hasAny(aLower, NEGATION_MARKERS);
  const bNeg = hasAny(bLower, NEGATION_MARKERS);
  const aAff = hasAny(aLower, AFFIRMATION_MARKERS);
  const bAff = hasAny(bLower, AFFIRMATION_MARKERS);
  if ((aNeg && bAff) || (bNeg && aAff)) {
    return 'recommendation contradiction (one advises against what the other recommends)';
  }
  return null;
}

export interface DetectConflictsOptions extends WorkspaceOpts {
  /** Restrict detection to a single topic; also names the output file. */
  topic?: string;
}

/**
 * Detect conflicts across all chunks of a domain's sources, grouped by shared
 * topic tag, and write them to data/conflicts/<domain>/<topic|all>.jsonl.
 */
export async function detectConflicts(
  domainId: string,
  opts?: DetectConflictsOptions,
): Promise<ConflictRecordType[]> {
  const root = resolveRoot(opts);
  const sources = await listSources(domainId, opts);

  // Collect all chunks belonging to this domain's sources, sorted for determinism.
  const chunks: ChunkRecordType[] = [];
  for (const source of sources) {
    const sourceChunks = await readJsonlIfExists(chunksFile(root, source.source_id), ChunkRecord);
    chunks.push(...sourceChunks);
  }
  chunks.sort((a, b) => (a.chunk_id < b.chunk_id ? -1 : a.chunk_id > b.chunk_id ? 1 : 0));

  // Group chunk indices by topic tag.
  const byTopic = new Map<string, ChunkRecordType[]>();
  for (const chunk of chunks) {
    for (const topic of chunk.topics ?? []) {
      if (opts?.topic !== undefined && topic !== opts.topic) continue;
      const group = byTopic.get(topic) ?? [];
      group.push(chunk);
      byTopic.set(topic, group);
    }
  }

  const conflicts: ConflictRecordType[] = [];
  let seq = 1;
  for (const topic of [...byTopic.keys()].sort()) {
    const group = byTopic.get(topic) ?? [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (!a || !b) continue;
        const nature = conflictNature(a, b);
        if (nature === null) continue;
        const chunkIds = [a.chunk_id, b.chunk_id].sort();
        const references = [...new Set([a.source_id, b.source_id])].sort();
        conflicts.push(
          ConflictRecord.parse({
            conflict_id: conflictId(domainId, seq),
            domain_id: domainId,
            topic,
            chunk_ids: chunkIds,
            nature,
            references,
            resolved: false,
          }),
        );
        seq += 1;
      }
    }
  }

  const fileName = opts?.topic ?? 'all';
  await writeJsonl(conflictsFile(root, domainId, fileName), conflicts, 'conflict_id');
  return conflicts;
}
