import { buildExport, zipExport, type EtimRelease, type ExportResult, type Project } from '@vaimo-pim-etim-builder/core';

export interface ExportJobRequest {
  release: EtimRelease;
  project: Project;
}

export interface ExportJobResult extends ExportResult {
  /** All files zipped, built in the same job so the download does not block the UI. */
  zip: Uint8Array;
  /** Time spent in buildExport and zipExport, in ms. */
  buildMs: number;
  zipMs: number;
}

export type ExportJobResponse = { ok: true; result: ExportJobResult } | { ok: false; error: string };

/** Builds and zips the export. Runs in the worker, kept pure for tests. */
export function processExportJob({ release, project }: ExportJobRequest): ExportJobResult {
  let t = performance.now();
  const result = buildExport(release, project);
  const buildMs = performance.now() - t;
  t = performance.now();
  const zip = zipExport(result.files);
  return { ...result, zip, buildMs, zipMs: performance.now() - t };
}

/** Buffers of the binary files and the zip, moved to the main thread without copying. */
export function transferables(result: ExportJobResult): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  for (const f of result.files) if (typeof f.content !== 'string') buffers.add(f.content.buffer as ArrayBuffer);
  buffers.add(result.zip.buffer as ArrayBuffer);
  return [...buffers];
}
