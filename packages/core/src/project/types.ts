/**
 * Key for one Akeneo feature attribute: ETIM feature id, plus unit id when the
 * feature has a unit. `EF000003`, `EF000008_EU570448`.
 */
export type FeatureKey = string;

/** How N features (and min/max of R features) are stored. */
export type NumericSetup = 'number' | 'metric';

/** How R features are stored: two number or metric attributes, or one text `10-20`. */
export type RangeSetup = 'minmax-number' | 'minmax-metric' | 'text';

/** A client attribute that provides an ETIM feature through rules. */
export interface SourceMapping {
  attribute: string;
  /**
   * R only, a second source: with `text` the two values are concatenated as
   * `10-20`, with min/max `attribute` fills min and `second` fills max.
   */
  second?: string;
  /**
   * L only, source values meaning yes, picked per source value on the source
   * record step (5). Given: `true` when the source is one of them, `false` for
   * any other value. Not given: the source is a boolean and is copied.
   */
  yesValues?: string[];
}

export interface FeatureConfig {
  numeric?: NumericSetup;
  range?: RangeSetup;
  /**
   * The data model attribute providing the feature. At most one, kept as a list
   * so older project files load, more than one is an error. Empty or missing
   * means unmapped.
   */
  sources?: SourceMapping[];
  /**
   * Set by the consultant: the feature is not mapped on purpose and is
   * enriched by hand. Only kept on features without sources, mapping a
   * feature removes it.
   */
  skipped?: true;
}

/** A client (data model) attribute from an uploaded Akeneo attribute export. */
export interface SourceAttribute {
  code: string;
  /** Akeneo attribute type, `pim_catalog_text`, `akeneo_reference_entity`... */
  type?: string;
  labels: Record<string, string>;
  group?: string;
  /** Reference entity code, for reference entity attributes. */
  referenceDataName?: string;
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
    /**
     * Prepended to the lower-case feature id for the record attribute on the
     * client's source reference entities holding the ETIM value code, `ref_`
     * gives `ref_ef000139`. The value label is in that code plus the label suffix.
     */
    sourceRecordAttributePrefix: string;
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

/** A record of a client reference entity, mapped to ETIM values. */
export interface SourceRecord {
  code: string;
  labels: Record<string, string>;
  /** ETIM feature id to ETIM value id, `{ EF000139: 'EV000072' }`. Unmapped features are left out. */
  values: Record<string, string>;
  /**
   * Exceptions to `values` for one ETIM class, class id to feature id to value
   * id, `{ EC002910: { EF000012: 'EV000154' } }`. Left out when there are none.
   */
  classValues?: Record<string, Record<string, string>>;
  /**
   * Feature ids the record provides no ETIM value for on purpose, sorted. Only
   * for features without a default value, setting one removes the skip. Left
   * out when empty.
   */
  skipped?: string[];
}

/** A value of a client source attribute providing L features, e.g. an option of a simple select. */
export interface SourceOption {
  code: string;
  labels: Record<string, string>;
}

/** A client reference entity that provides A features, with its records. */
export interface SourceEntity {
  /** Reference entity code in Akeneo, e.g. `surface_treatment`. */
  code: string;
  records: SourceRecord[];
}

/**
 * The ETIM export the project was built on. The project file holds no ETIM
 * data, so this is what the app imports again when the project is loaded.
 */
export interface EtimSource {
  /** Folder of a pre-loaded export in `apps/web/etim-files`, e.g. `ETIM-10.0`. Left out for uploaded files. */
  library?: string;
  /** Locale of the base import first, then the added languages in import order. */
  locales: string[];
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
  /** Client attributes from an uploaded Akeneo attribute export, offered as sources. */
  sourceAttributes?: SourceAttribute[];
  /**
   * Source attribute code to the reference entity it links to, for A feature
   * sources. Overrides the `referenceDataName` of an uploaded attribute.
   */
  sourceEntityLinks?: Record<string, string>;
  /** Client reference entities with their records and ETIM value mapping, sorted by code. */
  sourceEntities?: SourceEntity[];
  /**
   * Source attribute code to its values (options), for sources of L features,
   * from an uploaded Akeneo attribute option export or added by hand. Which
   * of them mean yes is `yesValues` on each feature's source.
   */
  sourceOptions?: Record<string, SourceOption[]>;
  /** Set by the ETIM import, left out until an export is imported. */
  etimSource?: EtimSource;
}
