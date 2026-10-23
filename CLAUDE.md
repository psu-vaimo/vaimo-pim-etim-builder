# CLAUDE.md

## Project

Web app (Node + React) for configuring an Akeneo PIM data model from ETIM: classes, features, values and units become Akeneo attributes, reference entity records, attribute dependencies and enrichment rules. The goal is to replace the manual spreadsheet workflow with a guided UI.

- Users: Vaimo consultants, one project per customer.
- Target: Akeneo SaaS (Serenity).
- Hosting and auth: undecided, build so it runs locally first.

## Scope

### Phase 1
- ETIM input by file upload (ETIM export, same tables as the prototype).
- Select classes, configure locales per project (from what the ETIM export contains).
- Generate attributes, reference entity records, dependencies and rules.
- Customer source attributes for mapping are entered manually.
- Projects saved and loaded as a JSON project file (no database).
- Export files only:
  - Akeneo import XLSX/CSV (attributes, attribute options, reference entity records)
  - Rules YAML (Akeneo rules import format)
  - Dependencies YAML/JSON (prototype format)
  - Mapping report XLSX for customer review

### Roadmap
- ETIM API as input source.
- Akeneo REST API: push config, read existing attributes for mapping.
- Upload Akeneo attribute export for mapping.
- Family assignment (see below).
- ETIM version upgrades with a diff of changed classes, features and values. Keep the data model versioned so this is possible.

### Out of scope, manual in Akeneo
- Adding ETIM attributes to families. The export must remind the consultant this is a required manual step. Can be automated once the API is added.

## Prototype

The spreadsheet prototype is the source of truth for logic and naming until this file says otherwise:
https://docs.google.com/spreadsheets/d/1ppf18BzaWwlUJexBm4YG1BkCtT7ZBEws1CgRUAog95I/edit?gid=437467296#gid=437467296
("ESV Stora ETIM-filen 260923", built for the customer ESSVE)

Key tabs:

| Tab | Purpose |
|---|---|
| `ETIMARTCLASS`, `ETIMFEATURE`, `ETIMVALUE`, `ETIMUNIT`, `ETIMARTCLASSFEATUREMAP`, `ETIMARTCLASSFEATUREVALUEMAP`, `sv` | Raw ETIM export (input) |
| `esv_etim_classes` | The customer's selected ETIM classes (scope) |
| `etim_reshape` | Unique feature+type+unit combinations, type mapping, code and label generation |
| `akn_etim_attributes` | Output: Akeneo attributes |
| `akn_etim_class_records`, `akn_etim_value_records` | Output: reference entity records (`etim_class`, `etim_value`) |
| `akn_dependencies` | Output: per-class dependency config (show attributes, restrict values) |
| `esv_map_akn_rules`, `akn_rules_per_value_2-318` | Mapping from existing customer attributes to ETIM attributes, output: Akeneo rules |

## Domain rules (from the prototype)

### Attribute codes and labels
- Code: lower-case feature code, plus unit code when the feature has a unit: `ef000003`, `ef000008_eu570448`.
- One attribute per feature+unit combination across all selected classes (not per class).
- Label: `EF000008 - Width [mm]` / `EF000008 - Bredd [mm]` (feature code, description, unit in brackets).
- Locales: configurable per project (prototype uses `en_US`, `sv_SE`).
- New attributes go to group `etim_unmapped`. Not scopable, not localizable, not unique.

### ETIM type to Akeneo type
| ETIM | Akeneo |
|---|---|
| A (alphanumeric) | `akeneo_reference_entity` linked to `etim_value` |
| N (numeric) | `pim_catalog_number` or `pim_catalog_metric`, chosen per feature+unit (decimals and negatives allowed) |
| L (logical) | `pim_catalog_boolean` |
| R (range) | one of: two number attributes (`_min`, `_max`), one text attribute (`10-20`), or measurement. Chosen per feature, setups can be mixed in one project |

Units: an ETIM class defines one unit per feature, so the unit is never a user choice. It is always part of the code and label, also for metric attributes.

### Reference entities
- `etim_class`: one record per selected class (`ec000009`, labels en/sv).
- `etim_value`: one record per ETIM value used by the selected classes (`ev000072`).
- Products carry an `etim_class` attribute that drives dependencies.

### Label attributes
- An A feature gets a companion text attribute `<code>_label` only when it is mapped from a customer source attribute. It holds the value label and is filled by rules.

### Dependencies (per class)
Native Akeneo SaaS attribute dependencies:
- `IS_DISPLAYED`: once set for an attribute, it is hidden in all product views and only shown when the dependency conditions match.
- `RESTRICTED_VALUES`: once values are restricted for a simple select or reference entity attribute, only the listed values are shown when the conditions match.

Generated per class:
- Trigger: `etim_class IN [ECxxxxxx]`.
- Every feature attribute in the class: `IS_DISPLAYED`.
- A features not mapped from a customer attribute: `RESTRICTED_VALUES` to the class's allowed ETIM values.
- Label attributes in the class: `IS_DISPLAYED`.

### Rules (auto enrichment)
Conditions: `etim_class NOT EMPTY` and source attribute `NOT EMPTY`. Execution `triggered`, priority 99.
| ETIM type | Action |
|---|---|
| A | copy `etim_value` from source reference entity to feature, copy `etim_label` to `<code>_label` |
| N, R 1:1 | copy value |
| R 2:1 | concat two source values |
| L | set `true` when source matches a "yes" value, default `false` |

## Tech stack
- TypeScript monorepo.
- `core`: shared, framework-free ETIM to Akeneo logic (parsing, code/label generation, attributes, dependencies, rules, exporters). Most logic and tests live here.
- `api`: Fastify.
- `web`: React + Vite.

## Open decisions
- Hosting and auth.
- Package manager, test runner, UI component library.
- Exact Akeneo SaaS import file formats for dependencies (verify against current Akeneo docs).
- Rule priorities and handling of conflicting mappings.

## Conventions
- Keep generated Akeneo codes deterministic, the same ETIM input must always produce the same codes.
- Keep the prototype tab names in mind when naming modules, so logic can be traced back to the sheet.
