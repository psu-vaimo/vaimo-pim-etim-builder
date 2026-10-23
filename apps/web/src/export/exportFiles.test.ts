import { buildExport, type ExportFile, type ExportIssue } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import { project, release } from '../test/release.js';
import { processExportJob, transferables } from './exportJob.js';
import {
  baseName,
  fileGroup,
  fileSize,
  formatBytes,
  groupExportFiles,
  isFamilyStep,
  mimeType,
  readmeSteps,
  summarizeIssues,
  zipFileName,
} from './exportFiles.js';

describe('export files', () => {
  const { files } = buildExport(release, project());

  it('groups every file in a fixed order', () => {
    const groups = groupExportFiles(files);
    expect(groups.map((g) => g.id)).toEqual(['readme', 'xlsx', 'csv', 'rules', 'dependencies', 'report', 'project']);
    expect(groups.flatMap((g) => g.files.map((f) => f.file.path)).sort()).toEqual(files.map((f) => f.path).sort());
    expect(groups.find((g) => g.id === 'dependencies')?.files.map((f) => f.file.path)).toEqual(['06_attribute_dependencies.yml']);
    expect(groups.find((g) => g.id === 'project')?.files.map((f) => f.file.path)).toEqual(['essve.etim-project.json']);
  });

  it('classifies paths', () => {
    expect(fileGroup('README.txt')).toBe('readme');
    expect(fileGroup('xlsx/02_attributes.xlsx')).toBe('xlsx');
    expect(fileGroup('csv/02_attributes.csv')).toBe('csv');
    expect(fileGroup('05_rules.yml')).toBe('rules');
    expect(fileGroup('mapping_report.xlsx')).toBe('report');
    expect(fileGroup('notes.md')).toBe('other');
  });

  it('measures sizes in bytes', () => {
    expect(fileSize({ path: 'a', content: 'åäö' })).toBe(6);
    expect(fileSize({ path: 'a', content: new Uint8Array(10) })).toBe(10);
    expect(formatBytes(12)).toBe('12 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });

  it('names the zip after the project file', () => {
    expect(zipFileName(project())).toBe('essve-etim-export.zip');
    expect(zipFileName(project({ name: '' }))).toBe('project-etim-export.zip');
    expect(zipFileName(project({ name: 'Bygg & Järn AB' }))).toBe('bygg-jarn-ab-etim-export.zip');
  });

  it('reads the manual steps from the README', () => {
    const steps = readmeSteps(files);
    expect(steps.length).toBeGreaterThanOrEqual(5);
    expect(steps.filter(isFamilyStep)).toHaveLength(1);
    expect(readmeSteps([{ path: 'README.txt', content: 'Hello\nSteps in Akeneo:\n  1. One\n  2. Two\n\nLater' }])).toEqual(['One', 'Two']);
    expect(readmeSteps([])).toEqual([]);
  });

  it('gives download names and types', () => {
    expect(baseName('xlsx/02_attributes.xlsx')).toBe('02_attributes.xlsx');
    expect(baseName('README.txt')).toBe('README.txt');
    expect(mimeType('a.zip')).toBe('application/zip');
    expect(mimeType('a.yml')).toBe('application/yaml');
  });

  it('summarizes issues', () => {
    const issue = (severity: 'error' | 'warning', n: number): ExportIssue => ({ severity, message: `m${n}`, step: 'attributes' });
    const s = summarizeIssues([issue('warning', 0), ...Array.from({ length: 7 }, (_, i) => issue('error', i + 1))], 3);
    expect(s).toMatchObject({ errors: 7, warnings: 1 });
    expect(s.firstErrors.map((e) => e.message)).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('export job', () => {
  it('builds the files and a zip', () => {
    const result = processExportJob({ release, project: project({ settings: { ...project().settings, numeric: 'metric' } }) });
    expect(result.files.map((f: ExportFile) => f.path)).toContain('05_rules.yml');
    expect(result.hasErrors).toBe(true);
    expect([...result.zip.slice(0, 2)]).toEqual([0x50, 0x4b]);
    const buffers = transferables(result);
    expect(new Set(buffers).size).toBe(buffers.length);
    expect(buffers).toContain(result.zip.buffer);
  });
});
