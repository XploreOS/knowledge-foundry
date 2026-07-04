// Local filesystem ingestion adapter: read a file into bytes with a content
// type guessed from its extension.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface LocalFileContent {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
};

/** Guess a content type from a file extension, defaulting to text/plain. */
export function contentTypeForPath(filePath: string): string {
  return EXTENSION_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'text/plain';
}

/** Read a local file into bytes with a guessed content type and its base name. */
export async function readLocalFile(filePath: string): Promise<LocalFileContent> {
  const buffer = await fs.readFile(filePath);
  return {
    buffer,
    contentType: contentTypeForPath(filePath),
    fileName: path.basename(filePath),
  };
}
