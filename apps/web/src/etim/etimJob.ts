import {
  decodeEtimFile,
  mergeEtimTranslations,
  parseEtimExport,
  type EtimRelease,
  type EtimTableName,
  type EtimTables,
  type ParseResult,
} from '@vaimo-pim-etim-builder/core';

export interface EtimJobFile {
  table: EtimTableName;
  bytes: ArrayBuffer;
}

/** Work sent to the ETIM worker. */
export type EtimJobRequest =
  | { kind: 'import'; locale: string; files: EtimJobFile[] }
  | { kind: 'translate'; locale: string; release: EtimRelease; files: EtimJobFile[] };

export type EtimJobResponse = { ok: true; result: ParseResult } | { ok: false; error: string };

/** Decodes the uploaded files and parses or merges them. Runs in the worker, kept pure for tests. */
export function processEtimJob(request: EtimJobRequest): ParseResult {
  const tables: EtimTables = {};
  for (const file of request.files) tables[file.table] = decodeEtimFile(new Uint8Array(file.bytes));
  return request.kind === 'import'
    ? parseEtimExport(tables, request.locale)
    : mergeEtimTranslations(request.release, tables, request.locale);
}
