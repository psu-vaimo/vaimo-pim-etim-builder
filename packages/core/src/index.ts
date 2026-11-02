export * from './etim/types.js';
export { parseEtimExport, mergeEtimTranslations } from './etim/parse.js';
export { decodeEtimFile } from './etim/decode.js';
export { matchTableName, type TableMatch } from './etim/tableNames.js';
export * from './project/types.js';
export { createProject, defaultSettings } from './project/defaults.js';
export * from './akeneo/types.js';
export {
  collectProjectFeatures,
  effectiveNumeric,
  effectiveRange,
  featureKey,
  resolvesToMetric,
  unitMapping,
  type ProjectFeature,
} from './akeneo/features.js';
export { attributeCode, generateAttributes } from './akeneo/attributes.js';
export { generateRecords } from './akeneo/records.js';
export { labelFor } from './etim/labels.js';
export * from './project/file.js';
export { generateDependencies } from './akeneo/dependencies.js';
export { generateRules } from './akeneo/rules.js';
export { formatAction, formatCondition, ruleConditions } from './akeneo/ruleText.js';
export {
  classRecordAttribute,
  exceptionClassIds,
  featureClassIds,
  recordValue,
  sourceEntityFor,
  sourceRecordAttribute,
} from './akeneo/sourceRecords.js';
export { buildExport, zipExport, type ExportFile, type ExportIssue, type ExportResult } from './export/bundle.js';
export { toCsv, type Cell, type Table } from './export/table.js';
export { writeXlsx } from './export/xlsx.js';
export {
  AKENEO_CODE_MAX,
  akeneoCodeError,
  addSourceRecords,
  applySourceEntityLinks,
  applySourceMappings,
  normalizeSources,
  withEntityRecords,
  withSources,
  type ApplySourcesResult,
  type FeatureSourceInput,
  type SourceEntityLinkInput,
  type SourceInput,
  type SourceRecordInput,
} from './project/sources.js';
export { validateSettings, type SettingsIssue } from './project/settings.js';
export { parseAkeneoAttributeExport } from './source/attributes.js';
export { readXlsxRows } from './source/xlsx.js';
export { parseAkeneoRecordExport } from './source/records.js';
export {
  applySourceRecordValues,
  collectSourceEntities,
  featureRecordAttributes,
  isRecordValueAllowed,
  withRecordValue,
  sourceRecordsTable,
  type SourceEntityFeature,
  type SourceEntityPlan,
  type SourceRecordValueInput,
} from './akeneo/sourceEntities.js';
