import type { SourceEntityFeatureSummary } from '../review/reviewRows.js';

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export const recordsText = (records: number) => plural(records, 'record');

export const providesText = (features: number) => `provides ${plural(features, 'feature')}`;

/** Class values count as filled too, so `filled` can be more than the records. */

/** `class exceptions in 2 classes`, empty without exceptions. */
export const exceptionsText = (feature: Pick<SourceEntityFeatureSummary, 'exceptionClasses'>) =>
  feature.exceptionClasses.length === 0 ? '' : `class exceptions in ${plural(feature.exceptionClasses.length, 'class', 'classes')}`;

/** `54 of 51 values filled, 3 skipped`. */
export const filledText = (feature: Pick<SourceEntityFeatureSummary, 'filled' | 'skipped'>, records: number) =>
  `${feature.filled.toLocaleString('en-US')} of ${records.toLocaleString('en-US')} values filled` +
  (feature.skipped > 0 ? `, ${feature.skipped.toLocaleString('en-US')} skipped` : '');

/** Every record has a default value for the feature or is skipped. */
export const isComplete = (feature: Pick<SourceEntityFeatureSummary, 'defaults' | 'skipped'>, records: number) =>
  feature.defaults + feature.skipped >= records;
