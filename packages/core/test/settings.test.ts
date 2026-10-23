import { describe, expect, it } from 'vitest';
import { buildExport, defaultSettings, validateSettings } from '../src/index.js';
import { project, release } from './helpers.js';

describe('validateSettings', () => {
  it('accepts the defaults and empty prefixes', () => {
    expect(validateSettings(defaultSettings())).toEqual([]);
  });

  it('reports invalid codes, empty required codes and a bad priority', () => {
    const s = defaultSettings();
    s.codes.attributePrefix = 'etim-';
    s.codes.classEntity = '';
    s.groups.mapped = 'etim mapped';
    s.rulePriority = 1.5;
    expect(validateSettings(s).map((i) => i.field)).toEqual(['codes.attributePrefix', 'codes.classEntity', 'groups.mapped', 'rulePriority']);
    expect(validateSettings(s)[1]).toEqual({ severity: 'error', field: 'codes.classEntity', detail: 'Code is empty', message: 'Setting codes.classEntity "": Code is empty' });
  });

  it('makes the export report settings errors', () => {
    const p = project();
    p.settings.groups.general = 'bad group';
    const { issues, hasErrors } = buildExport(release(), p);
    expect(hasErrors).toBe(true);
    expect(issues[0]).toEqual({ severity: 'error', step: 'settings', message: 'Setting groups.general "bad group": Use only letters, digits and underscores' });
  });
});
