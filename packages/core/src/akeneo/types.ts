import type { Labels } from '../etim/types.js';
import type { FeatureKey } from '../project/types.js';

export type AkeneoAttributeType =
  | 'pim_catalog_text'
  | 'pim_catalog_number'
  | 'pim_catalog_metric'
  | 'pim_catalog_boolean'
  | 'akeneo_reference_entity';

/** Which part of a feature an attribute holds. */
export type FeaturePart = 'value' | 'label' | 'min' | 'max';

export type AttributeOrigin =
  | { kind: 'class' }
  | { kind: 'feature'; key: FeatureKey; featureId: string; unitId?: string; part: FeaturePart };

/**
 * An Akeneo attribute to create. Scopable, localizable, unique, mandatory and
 * grid filter are always off for ETIM attributes, exporters add them.
 */
export interface AkeneoAttribute {
  code: string;
  type: AkeneoAttributeType;
  labels: Labels;
  group: string;
  sortOrder: number;
  readOnly: boolean;
  /** Reference entity code, for `akeneo_reference_entity`. */
  referenceDataName?: string;
  /** For number and metric. */
  decimalsAllowed?: boolean;
  negativeAllowed?: boolean;
  /** For metric. */
  metricFamily?: string;
  defaultMetricUnit?: string;
  origin: AttributeOrigin;
}

export interface AkeneoRecord {
  entity: string;
  code: string;
  labels: Labels;
}

export interface GenerateIssue {
  severity: 'error' | 'warning';
  message: string;
  featureKey?: FeatureKey;
  classId?: string;
}
