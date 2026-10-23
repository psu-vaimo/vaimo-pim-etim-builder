/**
 * Key for one Akeneo feature attribute: ETIM feature id, plus unit id when the
 * feature has a unit. `EF000003`, `EF000008_EU570448`.
 */
export type FeatureKey = string;

/** How N features (and min/max of R features) are stored. */
export type NumericSetup = 'number' | 'metric';

/** How R features are stored: two number or metric attributes, or one text `10-20`. */
export type RangeSetup = 'minmax-number' | 'minmax-metric' | 'text';

/** A customer attribute that feeds an ETIM feature through rules. */
export interface SourceMapping {
  attribute: string;
  /**
   * R only, a second source: with `text` the two values are concatenated as
   * `10-20`, with min/max `attribute` fills min and `second` fills max.
   */
  second?: string;
  /**
   * L only, source values meaning yes. Given: `true` when the source is one of
   * them, `false` for any other value. Not given: the source is a boolean and
   * is copied.
   */
  yesValues?: string[];
}

export interface FeatureConfig {
  numeric?: NumericSetup;
  range?: RangeSetup;
  /** In preference order, the first non-empty source wins. Empty or missing means unmapped. */
  sources?: SourceMapping[];
}

/** Locale specific words used in generated labels. */
export interface LabelTexts {
  /** `(from: att_x)` */
  from: string;
  /** `EF000139 - Surface protection - Description` */
  description: string;
  min: string;
  max: string;
  /** Label of the class attribute. */
  classAttribute: string;
}

export interface AkeneoUnit {
  family: string;
  unit: string;
}

export interface ProjectSettings {
  codes: {
    /** Prepended to generated attribute codes, `''` gives `ef000003`. */
    attributePrefix: string;
    /** Prepended to `etim_class` record codes, `''` gives `ec000009`. */
    classRecordPrefix: string;
    /** Prepended to `etim_value` record codes, `''` gives `ev000072`. */
    valueRecordPrefix: string;
    classEntity: string;
    valueEntity: string;
    /** Product attribute linking to the class entity, drives dependencies. */
    classAttribute: string;
    labelSuffix: string;
    /** Prepended to rule codes, `etim_` gives `etim_ef000139`. */
    rulePrefix: string;
    /** Prepended to dependency codes, `etim_` gives `etim_ec000009`. */
    dependencyPrefix: string;
    /** Attributes on the customer's source reference entities holding the ETIM value code and label. */
    sourceValueAttribute: string;
    sourceLabelAttribute: string;
  };
  groups: {
    /** Group for the class attribute. */
    general: string;
    mapped: string;
    unmapped: string;
  };
  numeric: NumericSetup;
  range: RangeSetup;
  rulePriority: number;
  /** ETIM unit id to Akeneo measurement family and unit, needed for metric attributes. */
  unitMap: Record<string, AkeneoUnit>;
  /** Keyed by locale, locales without an entry use `en_US`. */
  labelTexts: Record<string, LabelTexts>;
}

/** The saved project file. */
export interface Project {
  formatVersion: 1;
  name: string;
  /** Akeneo locales to generate labels for, subset of the release locales. */
  locales: string[];
  /** Selected ETIM classes, e.g. `EC000009`. */
  classIds: string[];
  settings: ProjectSettings;
  /** Per feature overrides and mappings. */
  features: Record<FeatureKey, FeatureConfig>;
}
