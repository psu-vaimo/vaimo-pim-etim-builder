import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildExport, toCsv, writeXlsx, zipExport, type ExportFile } from '../src/index.js';
import { column } from '../src/export/xlsx.js';
import { project, release } from './helpers.js';

const mappedProject = () =>
  project({
    name: 'ESSVE',
    features: {
      EF000139: { sources: [{ attribute: 'att_surface_treatment' }] },
      EF015006_EU570448: { numeric: 'number' },
    },
  });

const file = (files: ExportFile[], path: string) => {
  const f = files.find((x) => x.path === path);
  if (!f) throw new Error(`missing ${path}`);
  return f.content;
};
const text = (files: ExportFile[], path: string) => file(files, path) as string;

describe('toCsv', () => {
  it('uses ; and quotes only when needed', () => {
    expect(toCsv([['a', 'b;c', 'say "hi"', 1, true, null, undefined]])).toBe('a;"b;c";"say ""hi""";1;1;;\n');
    expect(toCsv([['line\nbreak']])).toBe('"line\nbreak"\n');
  });
});

describe('writeXlsx', () => {
  it('names columns like Excel', () => {
    expect([0, 25, 26, 701, 702].map(column)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
  });

  it('writes sheets with inline strings, numbers and escaped text', () => {
    const zip = unzipSync(
      writeXlsx([
        { name: 'a/b', rows: [['code', 'n'], ['x<&>"', 3], ['', null]] },
        { name: 'a/b', rows: [['only header']] },
      ]),
    );
    const workbook = strFromU8(zip['xl/workbook.xml']!);
    expect(workbook).toContain('<sheet name="a b" sheetId="1" r:id="rId1"/>');
    expect(workbook).toContain('<sheet name="a b 2" sheetId="2" r:id="rId2"/>');
    const sheet = strFromU8(zip['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">code</t></is></c>');
    expect(sheet).toContain('<t xml:space="preserve">x&lt;&amp;&gt;&quot;</t>');
    expect(sheet).toContain('<c r="B2"><v>3</v></c>');
    expect(sheet).toContain('<row r="3"></row>');
    expect(sheet).toContain('state="frozen"');
  });

  it('is deterministic', () => {
    const t = [{ name: 's', rows: [['a']] }];
    expect(writeXlsx(t)).toEqual(writeXlsx(t));
  });
});

describe('buildExport', () => {
  const { files, issues, hasErrors, manualSteps } = buildExport(release(), mappedProject());

  it('lists all files', () => {
    expect(files.map((f) => f.path)).toEqual([
      'README.txt',
      'xlsx/01_attribute_groups.xlsx',
      'xlsx/02_attributes.xlsx',
      'xlsx/03_records_etim_class.xlsx',
      'xlsx/04_records_etim_value.xlsx',
      'csv/01_attribute_groups.csv',
      'csv/02_attributes.csv',
      'csv/03_records_etim_class.csv',
      'csv/04_records_etim_value.csv',
      '05_rules.yml',
      '06_attribute_dependencies.yml',
      'mapping_report.xlsx',
      'essve.etim-project.json',
    ]);
    expect(hasErrors).toBe(false);
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('writes attribute groups and attributes in the prototype columns', () => {
    expect(text(files, 'csv/01_attribute_groups.csv')).toBe(
      'code;label-en_US;label-sv_SE\netim;etim;etim\netim_unmapped;etim_unmapped;etim_unmapped\netim_mapped;etim_mapped;etim_mapped\n',
    );
    const lines = text(files, 'csv/02_attributes.csv').trim().split('\n');
    expect(lines[0]).toBe(
      'code;type;label-en_US;label-sv_SE;group;is_read_only;reference_data_name;sort_order;decimals_allowed;negative_allowed;metric_family;default_metric_unit;scopable;unique;useable_as_grid_filter;localizable;is_mandatory',
    );
    expect(lines).toContain(
      'ef000139;pim_catalog_text;EF000139 - Surface protection (from: att_surface_treatment);EF000139 - Ytskydd (från: att_surface_treatment);etim_mapped;1;;4;;;;;0;0;0;0;0',
    );
    expect(lines).toContain('ef015006_eu570448;pim_catalog_number;EF015006 - Max. clamping thickness [mm];;etim_unmapped;0;;8;1;1;;;0;0;0;0;0');
    expect(lines).toContain('ef005644;akeneo_reference_entity;EF005644 - Fastening provision;EF005644 - Fästanordning;etim_unmapped;0;etim_value;6;;;;;0;0;0;0;0');
  });

  it('writes records with the entity identifier', () => {
    expect(text(files, 'csv/03_records_etim_class.csv')).toBe(
      'referenceEntityIdentifier;code;label-en_US;label-sv_SE\netim_class;ec000009;Hammer set anchor;Slagankare\netim_class;ec000028;Threaded rod;Gängad stång\n',
    );
  });

  it('writes rules YAML in the prototype format', () => {
    expect(parse(text(files, '05_rules.yml'))).toEqual({
      rules: {
        etim_att_surface_treatment: {
          type: 'product',
          priority: 99,
          enabled: true,
          conditions: [
            {
              operator: 'AND',
              value: [
                { field: 'etim_class', operator: 'NOT EMPTY' },
                { field: 'att_surface_treatment', operator: 'NOT EMPTY' },
              ],
            },
          ],
          actions: [
            { type: 'copy', from_field: 'att_surface_treatment', to_field: 'ef000139', reference_entity_attribute: 'ref_EF000139' },
            { type: 'copy', from_field: 'att_surface_treatment', to_field: 'ef000139_label', reference_entity_attribute: 'ref_EF000139_label' },
          ],
          labels: { en_US: 'ETIM (from: att_surface_treatment)', sv_SE: 'ETIM (från: att_surface_treatment)' },
          triggers: {},
          execution_type: 'triggered',
        },
      },
    });
  });

  it('quotes YAML 1.1 booleans and writes no aliases', () => {
    const p = mappedProject();
    p.features.EF015003 = { sources: [{ attribute: 'att_preset', yesValues: ['yes', 'on'] }] };
    const yaml = text(buildExport(release(), p).files, '05_rules.yml');
    expect(yaml).not.toMatch(/[&*]a\d/);
    expect(yaml).toContain('- "yes"');
    expect(parse(yaml, { version: '1.1' }).rules.etim_ef015003_true.conditions[0].value[1].value).toEqual(['yes', 'on']);
  });

  it('writes dependencies YAML under the dependencies root in the prototype format', () => {
    const yaml = parse(text(files, '06_attribute_dependencies.yml'));
    expect(Object.keys(yaml)).toEqual(['dependencies']);
    expect(Object.keys(yaml.dependencies)).toEqual(['etim_ec000009', 'etim_ec000028']);
    expect(yaml.dependencies.etim_ec000028).toEqual({
      code: 'etim_ec000028',
      labels: { en_US: 'EC000028 - Threaded rod', sv_SE: 'EC000028 - Gängad stång' },
      is_enabled: true,
      product_selections: [{ property: 'family', operator: 'ALL', values: null }],
      triggering_attributes: [{ attribute_code: 'etim_class', operator: 'IN', values: ['ec000028'] }],
      dependent_attributes: [
        { attribute_code: 'ef000007', action: 'IS_DISPLAYED' },
        { attribute_code: 'ef000007', action: 'RESTRICTED_VALUES', values: ['ev000072'] },
      ],
    });
  });

  it('writes a report and README with the manual steps', () => {
    expect(manualSteps).toContain('Add the ETIM attributes to the families. This is required and not part of the export.');
    expect(manualSteps.every((step) => text(files, 'README.txt').includes(step))).toBe(true);
    const report = unzipSync(file(files, 'mapping_report.xlsx') as Uint8Array);
    expect(strFromU8(report['xl/workbook.xml']!)).toContain('name="Summary"');
    expect(strFromU8(report['xl/worksheets/sheet1.xml']!)).toContain('Add the ETIM attributes to the families');
    expect(text(files, 'README.txt')).toContain('(ref_EF000139) and the value label (ref_EF000139_label)');
    expect(strFromU8(report['xl/workbook.xml']!)).toContain('name="Sources"');
    expect(strFromU8(report['xl/worksheets/sheet3.xml']!)).toContain('ref_EF000139, ref_EF000139_label');
  });

  it('zips deterministically and flags errors', () => {
    expect(zipExport(files)).toEqual(zipExport(buildExport(release(), mappedProject()).files));
    expect(Object.keys(unzipSync(zipExport(files)))).toContain('csv/02_attributes.csv');
    const p = mappedProject();
    p.settings.numeric = 'metric';
    p.features = {};
    expect(buildExport(release(), p).hasErrors).toBe(true);
  });
});
