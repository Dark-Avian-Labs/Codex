import fs from 'fs';
import path from 'path';

import { log } from '@codex/core';

import type { ImportPipelineStats } from '../../../shared/warframeImport/pipelineSummaryTypes.js';
import { CONTENT_BASE_URL, EXPORTS_DIR, REQUIRED_EXPORTS } from '../../config.js';
import {
  FETCH_BYTE_LIMITS,
  FETCH_TIMEOUT_MS,
  fetchBounded,
  isAbortError,
} from './http/fetchWithTimeout.js';
import { downloadAndParseManifest, type ManifestEntry } from './manifest.js';
import { sanitizePathSegment } from './safeImagePath.js';

export type { ImportPipelineStats };

function assertUnderExportsRoot(candidatePath: string): string {
  const root = path.resolve(EXPORTS_DIR);
  const resolved = path.resolve(candidatePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes exports directory: ${candidatePath}`);
  }
  return resolved;
}

function safeExportCategory(category: string): string {
  const trimmed = category.trim();
  if (
    !trimmed ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('..') ||
    trimmed.includes('\0') ||
    path.isAbsolute(trimmed)
  ) {
    throw new Error(`Invalid export category: ${category}`);
  }
  const sanitized = sanitizePathSegment(trimmed);
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new Error(`Invalid export category: ${category}`);
  }
  return sanitized;
}

export interface ImportStatus {
  step: string;
  message: string;
  progress?: number;
  total?: number;
  error?: string;
}

export interface ExportFileInfo {
  category: string;
  filename: string;
  hash: string;
  localPath: string;
  size: number;
  itemCount?: number;
}

export interface ImportPipelineResult {
  files: ExportFileInfo[];
  stats: ImportPipelineStats;
}

export async function runImportPipeline(
  onStatus?: (status: ImportStatus) => void,
): Promise<ImportPipelineResult> {
  const report = onStatus ?? ((s: ImportStatus) => log('info', s.message, { importStep: s.step }));
  const results: ExportFileInfo[] = [];
  const pipeStats: ImportPipelineStats = {
    requiredCount: 0,
    downloaded: [],
    skippedUnchanged: [],
    failed: [],
  };

  report({ step: 'manifest', message: 'Downloading and parsing manifest...' });
  let entries: ManifestEntry[];
  try {
    entries = await downloadAndParseManifest();
    report({
      step: 'manifest',
      message: `Parsed ${entries.length} entries from manifest`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report({ step: 'manifest', message: `Failed: ${msg}`, error: msg });
    throw err;
  }

  const needed = entries.filter((e) => {
    return REQUIRED_EXPORTS.some((req) => e.category.startsWith(req));
  });
  pipeStats.requiredCount = needed.length;

  report({
    step: 'download',
    message: `Found ${needed.length} required exports to download`,
    total: needed.length,
    progress: 0,
  });

  for (let i = 0; i < needed.length; i++) {
    const entry = needed[i];
    let safeCategory: string;
    try {
      safeCategory = safeExportCategory(entry.category);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pipeStats.failed.push({ category: entry.category, error: msg });
      report({
        step: 'download',
        message: `Rejected ${entry.category}: ${msg}`,
        progress: i + 1,
        total: needed.length,
        error: msg,
      });
      continue;
    }
    const url = `${CONTENT_BASE_URL}${entry.fullFilename}`;
    const localFilename = `${safeCategory}.json`;
    const localPath = assertUnderExportsRoot(path.join(EXPORTS_DIR, localFilename));
    const hashPath = assertUnderExportsRoot(path.join(EXPORTS_DIR, `${safeCategory}.hash`));

    if (fs.existsSync(localPath) && fs.existsSync(hashPath)) {
      const existingHash = fs.readFileSync(hashPath, 'utf-8').trim();
      if (existingHash === entry.hash) {
        pipeStats.skippedUnchanged.push(entry.category);
        const fileStat = fs.statSync(localPath);
        report({
          step: 'download',
          message: `Skipping ${entry.category} (hash unchanged)`,
          progress: i + 1,
          total: needed.length,
        });

        let itemCount: number | undefined;
        try {
          const content = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
          itemCount = getItemCount(content);
        } catch {
          // ignore
        }

        results.push({
          category: entry.category,
          filename: localFilename,
          hash: entry.hash,
          localPath,
          size: fileStat.size,
          itemCount,
        });
        continue;
      }
    }

    report({
      step: 'download',
      message: `Downloading ${entry.category}...`,
      progress: i,
      total: needed.length,
    });

    try {
      let response: Response;
      let text: string;
      try {
        const result = await fetchBounded(
          url,
          {},
          FETCH_TIMEOUT_MS.exportDownload,
          FETCH_BYTE_LIMITS.manifest,
        );
        response = result.response;
        text = result.body.toString('utf-8');
      } catch (error: unknown) {
        if (isAbortError(error)) {
          throw new Error(
            `Export download timed out after ${FETCH_TIMEOUT_MS.exportDownload}ms (${entry.category})`,
          );
        }
        throw error;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let itemCount: number | undefined;
      try {
        const content = JSON.parse(text);
        itemCount = getItemCount(content);
      } catch {
        throw new Error(`Downloaded ${entry.category} is not valid JSON; keeping existing file`);
      }

      const tmpPath = `${localPath}.tmp`;
      fs.writeFileSync(tmpPath, text, 'utf-8');
      fs.renameSync(tmpPath, localPath);
      fs.writeFileSync(hashPath, entry.hash, 'utf-8');

      const fileStat = fs.statSync(localPath);

      pipeStats.downloaded.push(entry.category);
      results.push({
        category: entry.category,
        filename: localFilename,
        hash: entry.hash,
        localPath,
        size: fileStat.size,
        itemCount,
      });

      report({
        step: 'download',
        message: `Downloaded ${entry.category} (${formatSize(fileStat.size)})`,
        progress: i + 1,
        total: needed.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pipeStats.failed.push({ category: entry.category, error: msg });
      report({
        step: 'download',
        message: `Failed to download ${entry.category}: ${msg}`,
        error: msg,
        progress: i + 1,
        total: needed.length,
      });
    }
  }

  if (pipeStats.failed.length > 0) {
    for (const failure of pipeStats.failed) {
      report({
        step: 'download',
        message: `Failed file ${failure.category}: ${failure.error}`,
        error: failure.error,
        progress: needed.length,
        total: needed.length,
      });
    }
  }

  const summaryMsg =
    pipeStats.failed.length > 0
      ? `Finished with ${pipeStats.failed.length} download error(s). ` +
        `${pipeStats.downloaded.length} updated, ${pipeStats.skippedUnchanged.length} unchanged on disk.`
      : `Complete: ${pipeStats.downloaded.length} export file(s) updated on disk, ` +
        `${pipeStats.skippedUnchanged.length} unchanged (hash match).`;

  report({
    step: 'complete',
    message: summaryMsg,
    progress: needed.length,
    total: needed.length,
  });

  return { files: results, stats: pipeStats };
}

export function listExportFiles(): ExportFileInfo[] {
  if (!fs.existsSync(EXPORTS_DIR)) return [];

  const files = fs.readdirSync(EXPORTS_DIR).filter((f) => f.endsWith('.json'));
  const results: ExportFileInfo[] = [];

  for (const file of files) {
    const localPath = path.join(EXPORTS_DIR, file);
    const category = file.replace('.json', '');
    const hashPath = path.join(EXPORTS_DIR, `${category}.hash`);
    const hash = fs.existsSync(hashPath) ? fs.readFileSync(hashPath, 'utf-8').trim() : '';
    const stats = fs.statSync(localPath);

    let itemCount: number | undefined;
    try {
      const content = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
      itemCount = getItemCount(content);
    } catch {
      // ignore
    }

    results.push({
      category,
      filename: file,
      hash,
      localPath,
      size: stats.size,
      itemCount,
    });
  }

  return results;
}

function getItemCount(content: unknown): number | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const obj = content as Record<string, unknown>;
  let total = 0;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      total += value.length;
    }
  }
  return total || undefined;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
