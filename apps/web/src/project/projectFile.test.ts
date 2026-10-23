import { createProject, defaultSettings, type EtimRelease } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import { missingClassIds, missingLocales, parseProjectFile, projectFileName, serializeProject } from './projectFile.js';

describe('project file', () => {
  it('round trips a project', () => {
    const project = { ...createProject('ESSVE', ['en_US', 'sv_SE']), classIds: ['EC000009', 'EC000028'] };
    expect(parseProjectFile(serializeProject(project))).toEqual({ ok: true, project });
  });

  it('rejects invalid JSON and other format versions', () => {
    expect(parseProjectFile('{')).toEqual({ ok: false, error: 'The file is not valid JSON.' });
    expect(parseProjectFile('[]')).toMatchObject({ ok: false });
    const v2 = JSON.stringify({ ...createProject('x'), formatVersion: 2 });
    expect(parseProjectFile(v2)).toEqual({ ok: false, error: 'Unsupported project format version 2, expected 1.' });
    const none = JSON.stringify({ name: 'x', locales: [], classIds: [] });
    expect(parseProjectFile(none)).toEqual({ ok: false, error: 'Unsupported project format version none, expected 1.' });
  });

  it('rejects wrong field types', () => {
    const base = createProject('x');
    expect(parseProjectFile(JSON.stringify({ ...base, classIds: 'EC000009' }))).toMatchObject({ ok: false });
    expect(parseProjectFile(JSON.stringify({ ...base, locales: [1] }))).toMatchObject({ ok: false });
    expect(parseProjectFile(JSON.stringify({ ...base, name: 3 }))).toMatchObject({ ok: false });
    expect(parseProjectFile(JSON.stringify({ ...base, settings: [] }))).toMatchObject({ ok: false });
  });

  it('fills missing settings with defaults and dedupes ids', () => {
    const text = JSON.stringify({
      formatVersion: 1,
      name: 'x',
      locales: ['en_US', 'en_US'],
      classIds: ['EC2', 'EC1', 'EC2'],
      settings: { rulePriority: 50, codes: { attributePrefix: 'etim_' } },
    });
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error);
    expect(result.project.locales).toEqual(['en_US']);
    expect(result.project.classIds).toEqual(['EC1', 'EC2']);
    expect(result.project.features).toEqual({});
    expect(result.project.settings.rulePriority).toBe(50);
    expect(result.project.settings.codes).toEqual({ ...defaultSettings().codes, attributePrefix: 'etim_' });
    expect(result.project.settings.groups).toEqual(defaultSettings().groups);
  });

  it('builds a file name from the project name', () => {
    expect(projectFileName(createProject('ESSVE Sverige AB'))).toBe('essve-sverige-ab.etim-project.json');
    expect(projectFileName(createProject('Bröderna Åkesson'))).toBe('broderna-akesson.etim-project.json');
    expect(projectFileName(createProject(''))).toBe('project.etim-project.json');
  });

  it('finds class ids and locales missing from the release', () => {
    const release: EtimRelease = {
      locales: ['en_US'],
      classes: { EC000009: { id: 'EC000009', groupId: 'EG1', version: '1', labels: {}, features: [] } },
      features: {},
      values: {},
      units: {},
    };
    const project = { ...createProject('x', ['en_US', 'sv_SE']), classIds: ['EC000009', 'EC999999'] };
    expect(missingClassIds(project, release)).toEqual(['EC999999']);
    expect(missingLocales(project, release)).toEqual(['sv_SE']);
  });
});
