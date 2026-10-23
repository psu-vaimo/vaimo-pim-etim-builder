import type { Project, ProjectSettings } from './types.js';

/** Defaults follow the prototype sheet. */
export function defaultSettings(): ProjectSettings {
  return {
    codes: {
      attributePrefix: '',
      classRecordPrefix: '',
      valueRecordPrefix: '',
      classEntity: 'etim_class',
      valueEntity: 'etim_value',
      classAttribute: 'etim_class',
      labelSuffix: '_label',
    },
    groups: {
      general: 'etim',
      mapped: 'etim_mapped',
      unmapped: 'etim_unmapped',
    },
    numeric: 'number',
    range: 'text',
    rulePriority: 99,
    unitMap: {},
    labelTexts: {
      en_US: { from: 'from', description: 'Description', min: 'Min', max: 'Max' },
      sv_SE: { from: 'från', description: 'Beskrivning', min: 'Min', max: 'Max' },
    },
  };
}

export function createProject(name: string, locales: string[] = []): Project {
  return { formatVersion: 1, name, locales, classIds: [], settings: defaultSettings(), features: {} };
}
