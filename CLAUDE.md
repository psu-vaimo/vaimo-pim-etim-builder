# CLAUDE.md

## Project

Web app (Node + React) for configuring an Akeneo PIM data model from ETIM: classes, features, values and units become Akeneo attributes, reference entity records, attribute dependencies and enrichment rules. The goal is to replace the manual spreadsheet workflow with a guided UI.

- Users: Vaimo consultants, one project per customer.
- Target: Akeneo SaaS (Serenity).
- Hosting: runs locally, no auth. Keep the API stateless so hosting and SSO can be added later.

## Scope

### Phase 1
- ETIM input by file upload (ETIM export, same tables as the prototype).
- Select classes, configure locales per project (from what the ETIM export contains).
- Generate attributes, reference entity records, dependencies and rules.
- UI: a wizard for setup (import ETIM, select classes and locales, configure features, map source attributes, review, export), then a workspace for free editing of classes, attributes, rules and dependencies.
- Customer source attributes for mapping are entered manually.
- Projects saved and loaded as a JSON project file (no database).
- Export files only:
  - Akeneo import XLSX/CSV (attributes, attribute options, reference entity records)
  - Rules YAML (Akeneo rules import format)
  - Dependencies YAML/JSON, using the prototype format in `akn_dependencies` as is
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
- Code prefixes are configurable per project (feature, value and class codes, reference entity and `etim_class` attribute codes). Prototype codes are the defaults.
- One attribute per feature+unit combination across all selected classes (not per class).
- Label: `EF000008 - Width [mm]` / `EF000008 - Bredd [mm]` (feature code, description, unit in brackets).
- Mapped attributes (any type) are read only and get the suffix `(from: att_a, att_b)`, listing all sources in preference order. Swedish: `(från: ...)`.
- Locale specific words (`from`, `Description`, `Min`, `Max`, class attribute label) are project settings per locale.
- Locales: configurable per project (prototype uses `en_US`, `sv_SE`).
- Attribute groups: `etim_mapped` for features mapped from a customer source attribute, `etim_unmapped` for the rest. Not scopable, not localizable, not unique.

### ETIM type to Akeneo type
| ETIM | Akeneo |
|---|---|
| A (alphanumeric) | unmapped: `akeneo_reference_entity` linked to `etim_value`. Mapped: read only `pim_catalog_text` holding the ETIM value code, plus a `_label` text attribute |
| N (numeric) | `pim_catalog_number` or `pim_catalog_metric`, chosen per feature+unit (decimals and negatives allowed) |
| L (logical) | `pim_catalog_boolean` |
| R (range) | `text` (one text attribute, `10-20`), `minmax-number` or `minmax-metric` (two attributes `<code>_min`, `<code>_max`). Setups can be mixed in one project |

Number vs metric and the range setup have a project default, overridable per feature.

Units: an ETIM class defines one unit per feature, so the unit is never a user choice. It is always part of the code and label, also for metric attributes. Metric needs an ETIM unit to Akeneo measurement family+unit mapping (project `unitMap`), without it the attribute falls back to number with an error. A feature without a unit always uses number (quietly under a metric project default, an error for an explicit metric override). Unit mappings are kept in the project file even when no longer used.

The class attribute (`etim_class`, reference entity link) is generated first, in group `etim` (assumed, not in the prototype).

### Reference entities
- `etim_class`: one record per selected class (`ec000009`, labels en/sv).
- `etim_value`: one record per ETIM value used by the selected classes (`ev000072`).
- Products carry an `etim_class` attribute that drives dependencies.

### Label attributes
- An A feature gets a companion text attribute `<code>_label` only when it is mapped from a customer source attribute. It holds the value label and is filled by rules. Read only, label `EF000139 - Surface protection - Description` (no `from` suffix).

### Dependencies (per class)
Native Akeneo SaaS attribute dependencies:
- `IS_DISPLAYED`: once set for an attribute, it is hidden in all product views and only shown when the dependency conditions match.
- `RESTRICTED_VALUES`: once values are restricted for a simple select or reference entity attribute, only the listed values are shown when the conditions match.

Generated per class:
- Code `etim_ec000009` (dependency prefix + class record code), label `EC000009 - Hammer set anchor`.
- Trigger: `etim_class IN [ec000009]`. Uses the class record code (the prototype used `EC000009`, record codes are lower case).
- Every feature attribute in the class, in ETIM order (both `_min` and `_max` for ranges): `IS_DISPLAYED`.
- A features not mapped from a customer attribute: `RESTRICTED_VALUES` right after, to the class's allowed ETIM value record codes, exactly as ETIM lists them (no special handling of generic values like `EV000154`). No restriction when ETIM lists no values.
- Label attributes in the class last: `IS_DISPLAYED`.

### Rules (auto enrichment)
Conditions: `etim_class NOT EMPTY` and source attribute `NOT EMPTY`. Execution `triggered`. Priority is a project default (prototype uses 99), editable.
| ETIM type | Action |
|---|---|
| A | copy `etim_value` from source reference entity to feature, copy `etim_label` to `<code>_label` (record attribute names are project settings) |
| N | copy value |
| R text, 1 source | copy value |
| R text, 2 sources (`second`) | concatenate as `10-20` (no spaces, no unit). The `{text: '-'}` item must be verified against Akeneo SaaS |
| R min/max | copy `attribute` to `_min`, `second` (or the same source) to `_max` |
| L with `yesValues` | rule `_true`: source IN yes values, set true. Rule `_false`: source NOT EMPTY and NOT IN, set false. Empty source stays empty |
| L without `yesValues` | copy (source is a boolean) |

Rule code `etim_<attribute code>`, with `_1`, `_2` per source when there are several (1 = preferred), label `EF000139 - Surface protection` (plus `(from: source)` when several). Field names follow the prototype's rules YAML.

Several source attributes can map to one feature. The consultant orders them by preference. Akeneo runs higher priority rules first and later rules overwrite, so the preferred source gets the lowest priority (runs last) and wins when not empty. Verify this ordering against current Akeneo docs when implementing.

## Tech stack
- TypeScript monorepo, pnpm workspaces, Node 22, Vitest.
- `packages/core` (`@akeneo-etim/core`): shared, framework-free ETIM to Akeneo logic (parsing, code/label generation, attributes, dependencies, rules, exporters). Most logic and tests live here. Consumed as TypeScript source (no build step).
- `apps/api` (`@akeneo-etim/api`): Fastify, port 3001. `buildApp()` in `src/app.ts`, tests use `app.inject`.
- `apps/web` (`@akeneo-etim/web`): React + Vite + Mantine (Stepper for the wizard). Dev server proxies `/api/*` to the API.

## Commands
```sh
pnpm install
pnpm dev:api      # API on http://127.0.0.1:3001
pnpm dev:web      # web on http://127.0.0.1:5173
pnpm test         # all packages
pnpm typecheck    # all packages
```
Run `pnpm test` and `pnpm typecheck` before committing.

## ETIM parser (`packages/core/src/etim`)
- Parsing runs in the browser (web worker), the API endpoint is kept for scripts.
- `decodeEtimFile(bytes)` decodes uploads. ETIM CSV exports are UTF-16, one file per table, UTF-8 also works.
- Input: the six ETIM CSV tables (`ETIMARTCLASS`, `ETIMFEATURE`, `ETIMVALUE`, `ETIMUNIT`, `ETIMARTCLASSFEATUREMAP`, `ETIMARTCLASSFEATUREVALUEMAP`) as raw text. Delimiter detected, headers case-insensitive, extra columns ignored.
- `parseEtimExport(tables, locale)` builds an `EtimRelease` (JSON serializable). Descriptions become labels for `locale`.
- `mergeEtimTranslations(release, tables, locale)` adds labels from an export in another language.
- Problems are returned as `issues`, never thrown. Missing table or column is an error, rows with broken references are skipped with a warning.
- Excel (XLSX) input in different forms is on the roadmap.

## Generators (`packages/core/src/akeneo`)
- `collectProjectFeatures` finds unique feature+unit combinations over the selected classes.
- `generateAttributes(release, project)` and `generateRecords(release, project)` return output plus `issues`, same pattern as the parser.
- `generateDependencies` and `generateRules` take the generated attributes as input, so codes stay consistent and attribute issues are reported once.
- Generated objects carry an `origin` (feature key, ETIM type, class) for the UI and reports.
- Project file type and defaults: `packages/core/src/project`.

## Open decisions
- None right now. Add new ones here as they come up.

## Conventions
- Keep generated Akeneo codes deterministic, the same ETIM input must always produce the same codes.
- Keep the prototype tab names in mind when naming modules, so logic can be traced back to the sheet.
