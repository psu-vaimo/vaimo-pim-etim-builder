import { describe, expect, it } from 'vitest';
import { ETIM_LABEL_TABLES } from '@vaimo-pim-etim-builder/core';
import { assignFiles, isOtherEtimTable, matchTableName, missingTables } from './tableFiles.js';

describe('matchTableName', () => {
  it('matches exact names case-insensitively, ignoring the extension', () => {
    expect(matchTableName('ETIMARTCLASS.csv')).toEqual({ kind: 'matched', table: 'ETIMARTCLASS' });
    expect(matchTableName('etimfeature.CSV')).toEqual({ kind: 'matched', table: 'ETIMFEATURE' });
    expect(matchTableName('ETIMUNIT')).toEqual({ kind: 'matched', table: 'ETIMUNIT' });
  });

  it('prefers the longest table name', () => {
    expect(matchTableName('ETIMARTCLASSFEATUREMAP.csv')).toEqual({ kind: 'matched', table: 'ETIMARTCLASSFEATUREMAP' });
    expect(matchTableName('ETIMARTCLASSFEATUREVALUEMAP.csv')).toEqual({
      kind: 'matched',
      table: 'ETIMARTCLASSFEATUREVALUEMAP',
    });
  });

  it('does not match a table name that runs on into a longer ETIM table name', () => {
    expect(matchTableName('ETIMARTCLASSSYNONYMMAP.csv')).toEqual({ kind: 'unknown' });
    expect(matchTableName('ETIMFEATUREGROUP.csv')).toEqual({ kind: 'unknown' });
    expect(isOtherEtimTable('ETIMFEATUREGROUP.csv')).toBe(true);
    expect(isOtherEtimTable('products.csv')).toBe(false);
    expect(isOtherEtimTable('ETIMFEATURE.csv')).toBe(false);
  });

  it('allows text around the table name', () => {
    expect(matchTableName('2024-09_ETIMVALUE_sv_SE (1).csv')).toEqual({ kind: 'matched', table: 'ETIMVALUE' });
    expect(matchTableName('export/ETIM9 ETIMARTCLASSFEATUREMAP.txt')).toEqual({
      kind: 'matched',
      table: 'ETIMARTCLASSFEATUREMAP',
    });
  });

  it('does not look at the extension or folders', () => {
    expect(matchTableName('ETIMUNIT/readme.txt')).toEqual({ kind: 'unknown' });
    expect(matchTableName('readme.ETIMUNIT')).toEqual({ kind: 'unknown' });
  });

  it('reports unknown and ambiguous names', () => {
    expect(matchTableName('products.csv')).toEqual({ kind: 'unknown' });
    expect(matchTableName('ETIMFEATURE_ETIMVALUE.csv')).toEqual({
      kind: 'ambiguous',
      tables: ['ETIMFEATURE', 'ETIMVALUE'],
    });
  });
});

describe('assignFiles', () => {
  it('assigns files, lets later files win and collects unrecognized ones', () => {
    const files = [
      { name: 'ETIMARTCLASS.csv', id: 1 },
      { name: 'notes.txt', id: 2 },
      { name: 'etimartclass_v2.csv', id: 3 },
      { name: 'ETIMUNIT.csv', id: 4 },
    ];
    const result = assignFiles(files);
    expect(result.byTable.ETIMARTCLASS?.id).toBe(3);
    expect(result.byTable.ETIMUNIT?.id).toBe(4);
    expect(result.unrecognized.map((f) => f.id)).toEqual([2]);
    expect(result.replaced.map((f) => f.id)).toEqual([1]);
    expect(missingTables(result.byTable, ETIM_LABEL_TABLES)).toEqual(['ETIMFEATURE', 'ETIMVALUE', 'ETIMARTGROUP']);
  });

  it('assigns a full ETIM 10 export folder, ignoring the tables it does not read', () => {
    const names = [
      'ETIMARTCLASS.csv',
      'ETIMARTCLASSFEATUREMAP.csv',
      'ETIMARTCLASSFEATUREVALUEMAP.csv',
      'ETIMARTCLASSSYNONYMMAP.csv',
      'ETIMARTGROUP.csv',
      'ETIMFEATURE.csv',
      'ETIMFEATUREGROUP.csv',
      'ETIMUNIT.csv',
      'ETIMVALUE.csv',
    ];
    const result = assignFiles(names.map((name) => ({ name })));
    expect(result.byTable.ETIMARTCLASS?.name).toBe('ETIMARTCLASS.csv');
    expect(result.byTable.ETIMFEATURE?.name).toBe('ETIMFEATURE.csv');
    expect(result.notNeeded.map((f) => f.name)).toEqual(['ETIMARTCLASSSYNONYMMAP.csv', 'ETIMFEATUREGROUP.csv']);
    expect(result.unrecognized).toEqual([]);
    expect(result.replaced).toEqual([]);
  });

  it('keeps files for tables that are not needed apart', () => {
    const files = [{ name: 'ETIMARTCLASSFEATUREMAP.csv' }, { name: 'ETIMARTCLASS.csv' }];
    const result = assignFiles(files, ETIM_LABEL_TABLES);
    expect(result.byTable.ETIMARTCLASS?.name).toBe('ETIMARTCLASS.csv');
    expect(result.notNeeded.map((f) => f.name)).toEqual(['ETIMARTCLASSFEATUREMAP.csv']);
  });
});
