import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  collectLogicalSources,
  featuresWithoutYesValues,
  parseAkeneoOptionExport,
  parseProjectFile,
  serializeProject,
  withSourceOptions,
  withYesValue,
  withoutSourceOption,
  type Project,
} from '../src/index.js';
import { project, release } from './helpers.js';

function mapped(patch: Partial<Project> = {}): Project {
  return project({ features: { EF015003: { sources: [{ attribute: 'att_finish' }] } }, ...patch });
}

const OPTIONS = [
  { code: 'zinc', labels: { en_US: 'Zinc' } },
  { code: 'none', labels: {} },
  { code: 'hot_dip', labels: {} },
];

describe('collectLogicalSources', () => {
  it('groups mapped L features per source with the listed options and unlisted yes values', () => {
    const p = mapped({
      features: { EF015003: { sources: [{ attribute: 'att_finish', yesValues: ['old', 'zinc'] }] } },
      sourceOptions: { att_finish: OPTIONS },
    });
    const [plan, ...rest] = collectLogicalSources(release(), p);
    expect(rest).toEqual([]);
    expect(plan).toEqual({
      attribute: 'att_finish',
      boolean: false,
      features: [{ key: 'EF015003', featureId: 'EF015003', yesValues: ['old', 'zinc'] }],
      options: [...OPTIONS.map((o) => ({ ...o, listed: true })), { code: 'old', labels: {}, listed: false }],
    });
    expect(featuresWithoutYesValues([plan!])).toEqual([]);
  });

  it('treats a source as Yes/No by its uploaded type, else when nothing is listed', () => {
    expect(collectLogicalSources(release(), mapped())[0]!.boolean).toBe(true);
    expect(collectLogicalSources(release(), mapped({ sourceOptions: { att_finish: OPTIONS } }))[0]!.boolean).toBe(false);
    const typed = (type: string) => mapped({ sourceAttributes: [{ code: 'att_finish', type, labels: {} }] });
    expect(collectLogicalSources(release(), typed('pim_catalog_boolean'))[0]).toMatchObject({ boolean: true, type: 'pim_catalog_boolean' });
    const select = collectLogicalSources(release(), typed('pim_catalog_simpleselect'));
    expect(select[0]!.boolean).toBe(false);
    expect(featuresWithoutYesValues(select).map((f) => f.key)).toEqual(['EF015003']);
  });
});

describe('withYesValue and withoutSourceOption', () => {
  it('adds yes values in option order and removes them again', () => {
    let p = mapped({ sourceOptions: { att_finish: OPTIONS } });
    p = withYesValue(p, 'EF015003', 'hot_dip', true);
    p = withYesValue(p, 'EF015003', 'zinc', true);
    expect(p.features.EF015003!.sources).toEqual([{ attribute: 'att_finish', yesValues: ['zinc', 'hot_dip'] }]);
    p = withYesValue(p, 'EF015003', 'zinc', false);
    expect(p.features.EF015003!.sources).toEqual([{ attribute: 'att_finish', yesValues: ['hot_dip'] }]);
    p = withoutSourceOption(p, 'att_finish', 'hot_dip');
    expect(p.features.EF015003!.sources).toEqual([{ attribute: 'att_finish' }]);
    expect(p.sourceOptions?.att_finish?.map((o) => o.code)).toEqual(['zinc', 'none']);
  });

  it('leaves features without a source alone', () => {
    const p = project();
    expect(withYesValue(p, 'EF015003', 'zinc', true)).toBe(p);
  });

  it('drops sourceOptions when the last list is emptied', () => {
    const p = withSourceOptions(mapped({ sourceOptions: { att_finish: OPTIONS } }), 'att_finish', []);
    expect(p.sourceOptions).toBeUndefined();
  });

  it('round trips through the project file', () => {
    const p = mapped({ sourceOptions: { att_finish: OPTIONS } });
    const parsed = parseProjectFile(serializeProject(p));
    expect(parsed.ok && parsed.project.sourceOptions).toEqual(p.sourceOptions);
    expect(parseProjectFile(JSON.stringify({ ...p, sourceOptions: { att_finish: [{ code: 1 }] } })).ok).toBe(false);
  });
});

describe('parseAkeneoOptionExport', () => {
  it('reads options per attribute with labels, first row of a duplicate kept', () => {
    const csv = 'code;attribute;sort_order;label-en_US;label-sv_SE\nzinc;att_finish;1;Zinc;Zink\nnone;att_finish;2;None;\nzinc;att_finish;3;Again;\nred;att_color;1;Red;Röd\n;att_color;2;x;\n';
    const { options, issues } = parseAkeneoOptionExport(strToU8(csv), 'options.csv');
    expect(options).toEqual({
      att_finish: [
        { code: 'zinc', labels: { en_US: 'Zinc', sv_SE: 'Zink' } },
        { code: 'none', labels: { en_US: 'None' } },
      ],
      att_color: [{ code: 'red', labels: { en_US: 'Red', sv_SE: 'Röd' } }],
    });
    expect(issues.map((i) => i.severity)).toEqual(['warning']);
  });

  it('needs the attribute and code columns', () => {
    const { options, issues } = parseAkeneoOptionExport(strToU8('code;label-en_US\nzinc;Zinc\n'), 'records.csv');
    expect(options).toEqual({});
    expect(issues[0]!.severity).toBe('error');
  });
});
