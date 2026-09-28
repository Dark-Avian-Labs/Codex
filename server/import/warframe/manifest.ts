import fs from 'fs';
import path from 'path';

import { log } from '@codex/core';
import { LzmaDecompressor } from '@napi-rs/lzma';

import { MANIFEST_URL, EXPORTS_DIR } from '../../config.js';
import {
  FETCH_BYTE_LIMITS,
  FETCH_TIMEOUT_MS,
  fetchBounded,
  isAbortError,
} from './http/fetchWithTimeout.js';

const MAX_MANIFEST_DECOMPRESSED_BYTES = 64 * 1024 * 1024;
const LZMA_HEADER_SIZE = 13;
const LZMA_UNKNOWN_SIZE = 0xffffffffffffffffn;
const INPUT_CHUNK_SIZE = 256 * 1024;

export interface ManifestEntry {
  category: string;
  fullFilename: string;
  hash: string;
}

export async function downloadAndParseManifest(): Promise<ManifestEntry[]> {
  log('info', 'Downloading manifest', { url: MANIFEST_URL });

  let response: Response;
  let compressedBuffer: Buffer;
  try {
    const result = await fetchBounded(
      MANIFEST_URL,
      {},
      FETCH_TIMEOUT_MS.manifest,
      FETCH_BYTE_LIMITS.manifest,
    );
    response = result.response;
    compressedBuffer = result.body;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new Error(`Manifest fetch timed out after ${FETCH_TIMEOUT_MS.manifest}ms`);
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Failed to download manifest: ${response.status} ${response.statusText}`);
  }

  log('info', 'Downloaded manifest bytes', { bytes: compressedBuffer.length });

  const text = await decompressLzma(compressedBuffer);

  const manifestPath = path.join(EXPORTS_DIR, 'manifest.txt');
  fs.writeFileSync(manifestPath, text, 'utf-8');
  log('info', 'Manifest saved', { path: manifestPath });

  return parseManifestText(text);
}

export async function decompressLzma(compressed: Buffer): Promise<string> {
  if (compressed.length < LZMA_HEADER_SIZE) {
    throw new Error('LZMA payload is too short to contain a valid header');
  }

  const declaredSize = compressed.readBigUInt64LE(5);
  if (
    declaredSize !== LZMA_UNKNOWN_SIZE &&
    declaredSize > BigInt(MAX_MANIFEST_DECOMPRESSED_BYTES)
  ) {
    throw new Error(
      `LZMA header declares ${declaredSize} uncompressed bytes, exceeding the ${MAX_MANIFEST_DECOMPRESSED_BYTES} byte cap`,
    );
  }

  const decompressor = new LzmaDecompressor();
  const parts: Buffer[] = [];
  let total = 0;
  const collect = (chunk: Buffer): void => {
    total += chunk.length;
    if (total > MAX_MANIFEST_DECOMPRESSED_BYTES) {
      throw new Error(
        `LZMA output exceeded the ${MAX_MANIFEST_DECOMPRESSED_BYTES} byte cap during decompression`,
      );
    }
    if (chunk.length > 0) {
      parts.push(Buffer.from(chunk));
    }
  };

  for (let offset = 0; offset < compressed.length; offset += INPUT_CHUNK_SIZE) {
    collect(decompressor.update(compressed.subarray(offset, offset + INPUT_CHUNK_SIZE)));
  }
  collect(await decompressor.finish());

  return Buffer.concat(parts).toString('utf-8');
}

export function parseManifestText(text: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bangIndex = trimmed.indexOf('!');
    if (bangIndex === -1) continue;

    const filename = trimmed.substring(0, bangIndex);
    const hash = trimmed.substring(bangIndex + 1);

    const dotIndex = filename.indexOf('.');
    const category = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;

    entries.push({
      category,
      fullFilename: trimmed,
      hash,
    });
  }

  log('info', 'Parsed manifest entries', { count: entries.length });
  return entries;
}
