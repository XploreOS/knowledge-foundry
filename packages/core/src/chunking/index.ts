// Chunking (contract-spec §2 ChunkRecord). Splits a normalized document into
// retrieval units using a strategy chosen from the source type. Every chunk
// inherits the source's license terms and always carries a non-empty citation.

import { ChunkRecord, emptyAllowedUses } from '../schemas/index.js';
import type { ChunkRecord as ChunkRecordType, SourceRecord as SourceRecordType } from '../schemas/index.js';
import { chunkId } from '../ids/index.js';
import {
  resolveRoot,
  normalizedDocFile,
  chunksFile,
  readText,
  writeJsonl,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';
import { parseHeadingLine } from '../internal/text.js';

interface Segment {
  sectionPath: string;
  text: string;
}

type Strategy = 'headings' | 'top_level' | 'paragraph';

function strategyFor(sourceType: string): Strategy {
  switch (sourceType) {
    case 'guideline':
    case 'webpage':
    case 'web_page':
      return 'headings';
    case 'research_article':
      return 'top_level';
    case 'statute':
    case 'regulation':
    case 'dataset':
      return 'paragraph';
    default:
      return 'headings';
  }
}

/** Split at headings whose level is <= splitLevel; non-splitting headings still
 *  update the section-path trail so paragraphs carry their heading context. */
function splitByHeadings(document: string, splitLevel: number): Segment[] {
  const segments: Segment[] = [];
  const trail: { level: number; text: string }[] = [];
  let buffer: string[] = [];
  let currentPath = '';

  const flush = (): void => {
    const text = buffer.join('\n').trim();
    if (text !== '') segments.push({ sectionPath: currentPath, text });
    buffer = [];
  };
  const updateTrail = (level: number, text: string): void => {
    while (trail.length > 0 && (trail[trail.length - 1]?.level ?? 0) >= level) trail.pop();
    trail.push({ level, text });
  };

  for (const line of document.split(/\r?\n/)) {
    const heading = parseHeadingLine(line);
    if (heading && heading.level <= splitLevel) {
      flush();
      updateTrail(heading.level, heading.text);
      currentPath = trail.map((t) => t.text).join(' > ');
      buffer.push(line);
    } else if (heading) {
      // Deeper heading: keep it in the current chunk, track it for context but
      // leave the section path anchored at the splitting level.
      updateTrail(heading.level, heading.text);
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return segments;
}

/** Split into blank-line-separated paragraphs; headings set the section path. */
function splitByParagraph(document: string): Segment[] {
  const segments: Segment[] = [];
  const trail: { level: number; text: string }[] = [];
  let buffer: string[] = [];
  let currentPath = '';

  const flush = (): void => {
    const text = buffer.join('\n').trim();
    if (text !== '') segments.push({ sectionPath: currentPath, text });
    buffer = [];
  };
  const updateTrail = (level: number, text: string): void => {
    while (trail.length > 0 && (trail[trail.length - 1]?.level ?? 0) >= level) trail.pop();
    trail.push({ level, text });
    currentPath = trail.map((t) => t.text).join(' > ');
  };

  for (const line of document.split(/\r?\n/)) {
    const heading = parseHeadingLine(line);
    if (heading) {
      flush();
      updateTrail(heading.level, heading.text);
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return segments;
}

function segment(document: string, strategy: Strategy): Segment[] {
  switch (strategy) {
    case 'top_level':
      return splitByHeadings(document, 1);
    case 'paragraph':
      return splitByParagraph(document);
    case 'headings':
    default:
      return splitByHeadings(document, 6);
  }
}

/** Build the mandatory, never-empty citation for a chunk from its source. */
function citationFor(source: SourceRecordType): string {
  if (source.canonical_url.trim() !== '') return source.canonical_url;
  if (source.title.trim() !== '') return source.title;
  return `${source.source_id} (${source.publisher})`;
}

/**
 * Chunk a source's normalized document into ChunkRecords, writing chunks.jsonl.
 * Falls back to a single whole-document chunk when a strategy yields nothing.
 */
export async function chunkDocument(
  source: SourceRecordType,
  opts?: WorkspaceOpts & { now?: string },
): Promise<ChunkRecordType[]> {
  const root = resolveRoot(opts);
  const now = opts?.now ?? new Date().toISOString();

  const document = await readText(normalizedDocFile(root, source.source_id));
  let segments = segment(document, strategyFor(source.source_type));
  if (segments.length === 0) {
    const whole = document.trim();
    if (whole !== '') segments = [{ sectionPath: '', text: whole }];
  }

  const citation = citationFor(source);
  const licenseClass = source.license_class ?? source.likely_license;
  const allowedUses = source.allowed_uses ?? emptyAllowedUses();

  const chunks: ChunkRecordType[] = segments.map((seg, seq) =>
    ChunkRecord.parse({
      chunk_id: chunkId(source.source_id, seq),
      source_id: source.source_id,
      section_path: seg.sectionPath,
      text: seg.text,
      citation,
      license_class: licenseClass,
      allowed_uses: allowedUses,
      review_state: 'chunked',
      created_at: now,
    }),
  );

  await writeJsonl(chunksFile(root, source.source_id), chunks, 'chunk_id');
  return chunks;
}
