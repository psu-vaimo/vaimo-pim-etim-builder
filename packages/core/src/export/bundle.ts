import { strToU8, zipSync } from 'fflate';
import { generateAttributes } from '../akeneo/attributes.js';
import { generateDependencies } from '../akeneo/dependencies.js';
import { collectProjectFeatures } from '../akeneo/features.js';
import { generateRecords } from '../akeneo/records.js';
import { generateRules } from '../akeneo/rules.js';
import type { GenerateIssue } from '../akeneo/types.js';
import type { EtimRelease } from '../etim/types.js';
import { projectFileName, serializeProject } from '../project/file.js';
import { validateSettings } from '../project/settings.js';
import type { Project } from '../project/types.js';
import { attributeGroupsTable, attributesTable, dependenciesYaml, recordsTable, rulesYaml } from './akeneo.js';
import { reportTables } from './report.js';
import { toCsv, type Table } from './table.js';
import { writeXlsx } from './xlsx.js';

export interface ExportFile {
  path: string;
  content: string | Uint8Array;
}

export type ExportIssue = GenerateIssue & { step: 'settings' | 'attributes' | 'records' | 'rules' };

export interface ExportResult {
  files: ExportFile[];
  issues: ExportIssue[];
  hasErrors: boolean;
  /** What the consultant must do by hand in Akeneo, in order. Same as in README.txt. */
  manualSteps: string[];
}

/**
 * Builds every phase 1 export file for a project. Akeneo import tables come as
 * both XLSX and CSV. Files are generated even with errors, `hasErrors` lets the
 * UI warn before download.
 */
export function buildExport(release: EtimRelease, project: Project): ExportResult {
  const { features } = collectProjectFeatures(release, project);
  const attrs = generateAttributes(release, project);
  const records = generateRecords(release, project);
  const rules = generateRules(release, project, attrs.attributes);
  const dependencies = generateDependencies(release, project, attrs.attributes);
  const { codes } = project.settings;

  const issues: ExportIssue[] = [
    ...validateSettings(project.settings).map(({ field: _field, detail: _detail, ...i }) => ({ ...i, step: 'settings' as const })),
    ...attrs.issues.map((i) => ({ ...i, step: 'attributes' as const })),
    ...records.issues.map((i) => ({ ...i, step: 'records' as const })),
    ...rules.issues.map((i) => ({ ...i, step: 'rules' as const })),
  ];
  const manualSteps = manualStepsFor(project, rules.rules.some((r) => r.actions.some((a) => a.type === 'copy' && a.reference_entity_attribute)));

  const tables: [string, Table][] = [
    ['01_attribute_groups', attributeGroupsTable(project, attrs.attributes)],
    ['02_attributes', attributesTable(project, attrs.attributes)],
    [`03_records_${codes.classEntity}`, recordsTable(project, codes.classEntity, records.classes)],
    [`04_records_${codes.valueEntity}`, recordsTable(project, codes.valueEntity, records.values)],
  ];

  const files: ExportFile[] = [
    { path: 'README.txt', content: readme(project, manualSteps) },
    ...tables.map(([file, t]) => ({ path: `xlsx/${file}.xlsx`, content: writeXlsx([t]) })),
    ...tables.map(([file, t]) => ({ path: `csv/${file}.csv`, content: toCsv(t.rows) })),
    { path: '05_rules.yml', content: rulesYaml(rules.rules) },
    { path: '06_attribute_dependencies.yml', content: dependenciesYaml(dependencies) },
    {
      path: 'mapping_report.xlsx',
      content: writeXlsx(
        reportTables({ release, project, features, attributes: attrs.attributes, rules: rules.rules, dependencies, issues, manualSteps }),
      ),
    },
    { path: projectFileName(project), content: serializeProject(project) },
  ];
  return { files, issues, hasErrors: issues.some((i) => i.severity === 'error'), manualSteps };
}

/** All export files in one zip, deterministic for the same input. */
export function zipExport(files: ExportFile[]): Uint8Array {
  return zipSync(
    Object.fromEntries(files.map((f) => [f.path, typeof f.content === 'string' ? strToU8(f.content) : f.content])),
    { level: 6, mtime: new Date('2000-01-01T00:00:00Z') },
  );
}

function manualStepsFor(project: Project, usesSourceRecords: boolean): string[] {
  const { codes } = project.settings;
  return [
    `Create the reference entities ${codes.classEntity} and ${codes.valueEntity} in Akeneo before importing records and attributes.`,
    'Import 01_attribute_groups, then 02_attributes, then the 03 and 04 record files.',
    'Import 05_rules.yml with the rule import job (YML).',
    'Import 06_attribute_dependencies.yml with the dependency import.',
    'Add the ETIM attributes to the families. This is required and not part of the export.',
    ...(usesSourceRecords
      ? [`Make sure the source reference entities of mapped A features have the record attributes ${codes.sourceValueAttribute} and ${codes.sourceLabelAttribute} filled.`]
      : []),
  ];
}

function readme(project: Project, manualSteps: string[]): string {
  return [
    `ETIM export for ${project.name || 'unnamed project'}`,
    '',
    'Files:',
    '  xlsx/ and csv/   Akeneo import files, same content in both formats',
    '  05_rules.yml     enrichment rules',
    '  06_attribute_dependencies.yml   one dependency per ETIM class',
    '  mapping_report.xlsx   review report for the customer',
    '  *.etim-project.json   the project file, load it in the app to continue',
    '',
    'Steps in Akeneo:',
    ...manualSteps.map((s, i) => `  ${i + 1}. ${s}`),
    '',
      ].join('\n');
}
