import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseAkeneoAttributeExport, readXlsxRows, writeXlsx } from '../src/index.js';

const CSV = [
  'code;type;label-en_US;label-sv_SE;group;reference_data_name;sort_order',
  'att_surface;akeneo_reference_entity;Surface;Yta;technical;surface_treatment;1',
  'att_preset;pim_catalog_boolean;Pre-set;;technical;;2',
  ';pim_catalog_text;No code;;;;3',
  'att_surface;pim_catalog_text;Again;;;;4',
].join('\n');

describe('parseAkeneoAttributeExport', () => {
  it('reads an Akeneo attribute export CSV', () => {
    const { attributes, issues } = parseAkeneoAttributeExport(strToU8(CSV), 'attributes.csv');
    expect(attributes).toEqual([
      { code: 'att_preset', type: 'pim_catalog_boolean', labels: { en_US: 'Pre-set' }, group: 'technical' },
      {
        code: 'att_surface',
        type: 'akeneo_reference_entity',
        labels: { en_US: 'Surface', sv_SE: 'Yta' },
        group: 'technical',
        referenceDataName: 'surface_treatment',
      },
    ]);
    expect(issues).toEqual([{ severity: 'warning', message: '1 rows repeat an attribute code, the first row is kept' }]);
  });

  it('reads the same export as XLSX, including shared strings', () => {
    const rows = CSV.split('\n').map((l) => l.split(';'));
    const inline = parseAkeneoAttributeExport(writeXlsx([{ name: 'attributes', rows }]), 'attributes.xlsx');
    expect(inline.attributes.map((a) => a.code)).toEqual(['att_preset', 'att_surface']);

    const sheet =
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2" t="inlineStr"><is><t>Fish &amp; chips</t></is></c></row></sheetData></worksheet>';
    const shared = '<sst><si><t>code</t></si><si><r><t>label-</t></r><r><t>en_US</t></r></si><si><t>att_food</t></si></sst>';
    const bytes = zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet), 'xl/sharedStrings.xml': strToU8(shared) });
    expect(readXlsxRows(bytes)).toEqual([
      ['code', '', 'label-en_US'],
      ['att_food', '', 'Fish & chips'],
    ]);
    expect(parseAkeneoAttributeExport(bytes, 'a.xlsx').attributes).toEqual([{ code: 'att_food', labels: { en_US: 'Fish & chips' } }]);
  });

  it('reports files that are not attribute exports', () => {
    expect(parseAkeneoAttributeExport(strToU8('sku;name\n1;x'), 'products.csv')).toEqual({
      attributes: [],
      issues: [{ severity: 'error', message: 'products.csv has no code column, is it an Akeneo attribute export?' }],
    });
    expect(parseAkeneoAttributeExport(new Uint8Array([0x50, 0x4b, 1, 2]), 'broken.xlsx').issues[0]?.message).toMatch(/^broken.xlsx could not be read/);
  });
});
