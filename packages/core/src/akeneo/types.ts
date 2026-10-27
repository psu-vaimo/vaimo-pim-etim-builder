import type { EtimFeatureType, Labels } from '../etim/types.js';
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
  | { kind: 'feature'; key: FeatureKey; featureId: string; unitId?: string; etimType: EtimFeatureType; part: FeaturePart };

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

/** One condition, in the prototype's rule format. */
export interface RuleFieldCondition {
  field: string;
  operator: 'NOT EMPTY' | 'IN' | 'NOT IN';
  value?: string[];
}

export interface RuleConditionGroup {
  operator: 'AND';
  value: RuleFieldCondition[];
}

export interface CopyAction {
  type: 'copy';
  from_field: string;
  to_field: string;
  reference_entity_attribute?: string;
}

export type RuleAction =
  | CopyAction
  | { type: 'set'; field: string; value: boolean }
  | { type: 'concatenate'; from: ({ field: string } | { text: string })[]; to: { field: string } };

/** An Akeneo product rule. Field names follow the prototype's rules YAML. */
export interface AkeneoRule {
  code: string;
  priority: number;
  enabled: boolean;
  conditions: RuleConditionGroup[];
  actions: RuleAction[];
  labels: Labels;
  executionType: 'triggered';
  /** The source attribute and the features the rule fills. */
  origin: { source: string; keys: FeatureKey[] };
}

export type DependentAttribute =
  | { attribute_code: string; action: 'IS_DISPLAYED' }
  | { attribute_code: string; action: 'RESTRICTED_VALUES'; values: string[] };

/** A native Akeneo attribute dependency, one per ETIM class. Field names follow the prototype. */
export interface AkeneoDependency {
  code: string;
  labels: Labels;
  isEnabled: boolean;
  /** Always `etim_class IN [<class record code>]`. */
  triggeringAttributes: { attribute_code: string; operator: 'IN'; values: string[] }[];
  dependentAttributes: DependentAttribute[];
  origin: { classId: string };
}
