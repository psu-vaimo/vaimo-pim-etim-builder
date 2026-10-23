import { projectFileName, type ExportFile, type ExportIssue, type Project } from '@akeneo-etim/core';

export type FileGroupId = 'readme' | 'xlsx' | 'csv' | 'rules' | 'dependencies' | 'report' | 'project' | 'other';

export const FILE_GROUP_LABELS: Record<FileGroupId, string> = {
  readme: 'README, manual steps',
  xlsx: 'Akeneo import files, XLSX',
  csv: 'Akeneo import files, CSV',
  rules: 'Rules',
  dependencies: 'Attribute dependencies',
  report: 'Mapping report for the customer',
  project: 'Project file',
  other: 'Other files',
};

const GROUP_ORDER: readonly FileGroupId[] = ['readme', 'xlsx', 'csv', 'rules', 'dependencies', 'report', 'project', 'other'];

export function fileGroup(path: string): FileGroupId {
  const name = path.toLowerCase();
  if (name === 'readme.txt') return 'readme';
  if (name.startsWith('xlsx/')) return 'xlsx';
  if (name.startsWith('csv/')) return 'csv';
  if (name.endsWith('.etim-project.json')) return 'project';
  if (name.includes('rules') && (name.endsWith('.yml') || name.endsWith('.yaml'))) return 'rules';
  if (name.includes('dependencies')) return 'dependencies';
  if (name.includes('report')) return 'report';
  return 'other';
}

export function fileSize(file: ExportFile): number {
  return typeof file.content === 'string' ? new TextEncoder().encode(file.content).byteLength : file.content.byteLength;
}

export interface FileRow {
  file: ExportFile;
  size: number;
}

export interface FileGroup {
  id: FileGroupId;
  label: string;
  files: FileRow[];
}

/** Files grouped for the export list, groups in a fixed order, files in export order. Empty groups are left out. */
export function groupExportFiles(files: readonly ExportFile[]): FileGroup[] {
  const byGroup = new Map<FileGroupId, FileRow[]>();
  for (const file of files) {
    const id = fileGroup(file.path);
    const list = byGroup.get(id) ?? [];
    list.push({ file, size: fileSize(file) });
    byGroup.set(id, list);
  }
  return GROUP_ORDER.flatMap((id) => {
    const list = byGroup.get(id);
    return list ? [{ id, label: FILE_GROUP_LABELS[id], files: list }] : [];
  });
}

/** `1.2 MB`, `340 KB`, `12 B`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString('en-US')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Zip name from the project file name, `essve.etim-project.json` gives `essve-etim-export.zip`. */
export function zipFileName(project: Project): string {
  return `${projectFileName(project).replace(/\.etim-project\.json$/, '')}-etim-export.zip`;
}

/** Last part of a path, the name a single file is downloaded as. */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function mimeType(path: string): string {
  const name = path.toLowerCase();
  if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (name.endsWith('.csv')) return 'text/csv;charset=utf-8';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'application/yaml';
  if (name.endsWith('.zip')) return 'application/zip';
  return 'text/plain;charset=utf-8';
}

/**
 * The numbered manual steps from the README (`Steps in Akeneo:` and the
 * `  1. ...` lines after it). Core does not export the steps list itself, so
 * reading the README keeps the UI in line with the file the consultant gets.
 */
export function readmeSteps(files: readonly ExportFile[]): string[] {
  const readme = files.find((f) => fileGroup(f.path) === 'readme');
  if (!readme || typeof readme.content !== 'string') return [];
  const lines = readme.content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === 'steps in akeneo:');
  if (start === -1) return [];
  const steps: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (!match) break;
    steps.push((match[1] ?? '').trim());
  }
  return steps;
}

/** True for the manual step about adding attributes to families, highlighted in the UI. */
export function isFamilyStep(step: string): boolean {
  return /famil/i.test(step);
}

export interface IssueSummary {
  errors: number;
  warnings: number;
  firstErrors: ExportIssue[];
}

export function summarizeIssues(issues: readonly ExportIssue[], max = 5): IssueSummary {
  const errors = issues.filter((i) => i.severity === 'error');
  return { errors: errors.length, warnings: issues.length - errors.length, firstErrors: errors.slice(0, max) };
}
