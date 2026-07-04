// Web ingestion adapter: fetch an http(s) URL into bytes using the global
// fetch (Node >= 20). Rejects non-http(s) schemes and non-2xx responses.

export interface WebContent {
  buffer: Uint8Array;
  contentType: string;
}

/** Fetch a URL over http(s) and return its bytes + content type. */
export async function fetchUrl(url: string): Promise<WebContent> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`unsupported URL scheme "${parsed.protocol}" — only http(s) is allowed`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: new Uint8Array(arrayBuffer),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}
