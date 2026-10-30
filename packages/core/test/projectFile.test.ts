import { describe, expect, it } from 'vitest';
import {
  createProject,
  defaultSettings,
  missingClassIds,
  missingLocales,
  parseProjectFile,
  projectFileName,
  serializeProject,
  type EtimRelease,
} from '../src/index.js';

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
      settings: { rulePriority: 50, codes: { attributePrefix: 'etim_', sourceValueAttribute: 'etim_value' } },
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

  it('keeps uploaded source attributes and rejects malformed ones', () => {
    const project = { ...createProject('x'), sourceAttributes: [{ code: 'att_a', type: 'pim_catalog_text', labels: { en_US: 'A' } }] };
    expect(parseProjectFile(serializeProject(project))).toEqual({ ok: true, project });
    expect(parseProjectFile(JSON.stringify({ ...project, sourceAttributes: [{ code: 'att_a' }] }))).toMatchObject({ ok: false });
  });

  it('keeps source entity links and records, rejects malformed ones', () => {
    const project = {
      ...createProject('x'),
      sourceEntityLinks: { att_a: 'surface' },
      sourceEntities: [{ code: 'surface', records: [{ code: 'zinc', labels: { en_US: 'Zinc' }, values: { EF000139: 'EV000072' } }] }],
    };
    expect(parseProjectFile(serializeProject(project))).toEqual({ ok: true, project });
    expect(parseProjectFile(JSON.stringify({ ...project, sourceEntityLinks: { att_a: 1 } }))).toMatchObject({ ok: false });
    expect(parseProjectFile(JSON.stringify({ ...project, sourceEntities: [{ code: 'surface', records: [{ code: 'zinc' }] }] }))).toMatchObject({ ok: false });
  });

  it('keeps the ETIM source, rejects malformed ones', () => {
    const project = { ...createProject('x'), etimSource: { library: 'ETIM-10.0', locales: ['en_US', 'sv_SE'] } };
    expect(parseProjectFile(serializeProject(project))).toEqual({ ok: true, project });
    const uploaded = { ...createProject('x'), etimSource: { locales: ['en_US'] } };
    expect(parseProjectFile(serializeProject(uploaded))).toEqual({ ok: true, project: uploaded });
    expect(parseProjectFile(JSON.stringify({ ...project, etimSource: { library: 'ETIM-10.0', locales: [] } }))).toMatchObject({ ok: false });
    expect(parseProjectFile(JSON.stringify({ ...project, etimSource: { library: 10, locales: ['en_US'] } }))).toMatchObject({ ok: false });
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
      groups: {},
    };
    const project = { ...createProject('x', ['en_US', 'sv_SE']), classIds: ['EC000009', 'EC999999'] };
    expect(missingClassIds(project, release)).toEqual(['EC999999']);
    expect(missingLocales(project, release)).toEqual(['sv_SE']);
  });
});
