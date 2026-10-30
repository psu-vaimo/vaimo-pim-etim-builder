import { defaultSettings, validateSettings } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import { CODE_FIELDS, GROUP_FIELDS, codeExamples, errorsByField, labelTextsFor } from './settingsFields.js';

describe('settings fields', () => {
  it('cover every code and group setting', () => {
    const s = defaultSettings();
    expect(CODE_FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(s.codes).sort());
    expect(GROUP_FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(s.groups).sort());
  });

  it('shows example codes for the prototype defaults and with prefixes', () => {
    const s = defaultSettings();
    expect(codeExamples(s).map((e) => e.code)).toEqual([
      'ef000008_eu570448',
      'ef000139_label',
      'ec000009',
      'ev000072',
      'etim_att_surface_treatment',
      'ref_ef000139',
      'etim_ec000009',
    ]);
    s.codes.attributePrefix = 'x_';
    s.codes.classRecordPrefix = 'c_';
    expect(codeExamples(s).map((e) => e.code)).toContain('x_ef000139_label');
    expect(codeExamples(s).map((e) => e.code)).toContain('etim_c_ec000009');
  });

  it('maps validation details to fields and falls back to en_US label words', () => {
    const s = defaultSettings();
    s.codes.classEntity = 'bad entity';
    expect(errorsByField(validateSettings(s))).toEqual({ 'codes.classEntity': 'Use only letters, digits and underscores' });
    expect(labelTextsFor(s, 'de_DE')?.from).toBe('from');
    expect(labelTextsFor(s, 'sv_SE')?.from).toBe('från');
  });
});
