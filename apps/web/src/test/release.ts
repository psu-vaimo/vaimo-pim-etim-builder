import { createProject, type EtimRelease, type Project } from '@vaimo-pim-etim-builder/core';

/** Small release for web tests: one class with an A, an N with unit and an L feature. */
export const release: EtimRelease = {
  locales: ['en_US', 'sv_SE'],
  classes: {
    EC000009: {
      id: 'EC000009',
      groupId: 'EG1',
      version: '1',
      labels: { en_US: 'Hammer set anchor', sv_SE: 'Slagankare' },
      features: [
        { nr: '1', featureId: 'EF000139', type: 'A', sortNr: 1, valueIds: ['EV000072', 'EV000154'] },
        { nr: '2', featureId: 'EF000008', type: 'N', unitId: 'EU570448', sortNr: 2, valueIds: [] },
        { nr: '3', featureId: 'EF015003', type: 'L', sortNr: 3, valueIds: [] },
      ],
    },
  },
  features: {
    EF000139: { id: 'EF000139', labels: { en_US: 'Surface protection', sv_SE: 'Ytbehandling' } },
    EF000008: { id: 'EF000008', labels: { en_US: 'Width', sv_SE: 'Bredd' } },
    EF015003: { id: 'EF015003', labels: { en_US: 'Preset', sv_SE: 'Förinställd' } },
  },
  values: {
    EV000072: { id: 'EV000072', labels: { en_US: 'Zinc plated', sv_SE: 'Förzinkad' } },
    EV000154: { id: 'EV000154', labels: { en_US: 'Other', sv_SE: 'Annan' } },
  },
  units: { EU570448: { id: 'EU570448', labels: { en_US: 'mm' } } },
  groups: {},
};

export function project(patch: Partial<Project> = {}): Project {
  return { ...createProject('ESSVE', ['en_US', 'sv_SE']), classIds: ['EC000009'], ...patch };
}
