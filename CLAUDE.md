# CLAUDE.md

## Project

Vaimo PIM ETIM Builder (sub title Akeneo): a web app (Node + React) for configuring an Akeneo PIM data model from ETIM: classes, features, values and units become Akeneo attributes, reference entity records, attribute dependencies and enrichment rules. The goal is to replace the manual spreadsheet workflow with a guided UI.

- Users: Vaimo consultants, one project per client.
- Target: Akeneo SaaS (Serenity).
- Hosting: runs locally, no auth. The web app is also deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` on every push to main (static build under `/<repo>/`, `BASE_PATH` sets the Vite base, the pre-loaded ETIM exports are copied into the build with a static `index.json`). Keep the API stateless so hosting and SSO can be added later.

## Scope

### Phase 1
- ETIM input by file upload (ETIM export, same tables as the prototype), or picked from pre-loaded exports in `apps/web/etim-files/<release>/<locale>/` (listed by the dev server, committed to git).
- Select classes, configure locales per project (from what the ETIM export contains).
- Generate attributes, reference entity records, dependencies and rules.
- UI: a workspace with numbered steps in a sidebar (import ETIM, select classes and locales, configure features, map source attributes, map source records and values, review, export), opened in any order.
- Features the consultant decides not to map can be marked skipped (`skipped: true` in the project feature config, `mappingStatus` in core: mapped, skipped or unmapped). Only for features without a source, mapping a feature removes the skip. Skipped changes no generated output, it is a status for the mapping step (4), the workspace sidebar and the mapping report.
- Client source attributes for mapping: upload the client's Akeneo attribute export (XLSX or CSV) to pick from a list and check types, or type codes by hand. The list is saved in the project file (`sourceAttributes`).
- Source records: the records of the client reference entities behind A feature sources, uploaded from an Akeneo record export or added by hand, mapped to ETIM values per feature and exported as record import files.
- Source values of L features: the values (options) of a non Yes/No source attribute, uploaded from an Akeneo attribute option export or added by hand (`sourceOptions` in the project file), each ticked as yes per feature on step 5. The ticked ones are the source's `yesValues`.
- Projects saved and loaded as a JSON project file (no database). The file holds no ETIM data, only `etimSource` (pre-loaded release folder, or none for uploads, and the locales in import order). Loading a project imports a pre-loaded release again, an uploaded one has to be imported by hand.
- Export files only:
  - Akeneo import XLSX/CSV (attributes, attribute options, reference entity records)
  - Rules YAML (Akeneo rules import format)
  - Dependencies YAML (root `dependencies`), using the prototype format in `akn_dependencies` as is
  - Mapping report XLSX for client review

### Roadmap
- ETIM API as input source.
- Akeneo REST API: push config, read existing attributes for mapping.
- Family assignment (see below).
- ETIM version upgrades with a diff of changed classes, features and values. Keep the data model versioned so this is possible.

### Out of scope, manual in Akeneo
- Adding ETIM attributes to families. The export must remind the consultant this is a required manual step. Can be automated once the API is added.

## Prototype

The spreadsheet prototype is the source of truth for logic and naming until this file says otherwise:
https://docs.google.com/spreadsheets/d/1ppf18BzaWwlUJexBm4YG1BkCtT7ZBEws1CgRUAog95I/edit?gid=437467296#gid=437467296
("ESV Stora ETIM-filen 260923", built for the client ESSVE)

Key tabs:

| Tab | Purpose |
|---|---|
| `ETIMARTCLASS`, `ETIMFEATURE`, `ETIMVALUE`, `ETIMUNIT`, `ETIMARTCLASSFEATUREMAP`, `ETIMARTCLASSFEATUREVALUEMAP`, `sv` | Raw ETIM export (input) |
| `esv_etim_classes` | The client's selected ETIM classes (scope) |
| `etim_reshape` | Unique feature+type+unit combinations, type mapping, code and label generation |
| `akn_etim_attributes` | Output: Akeneo attributes |
| `akn_etim_class_records`, `akn_etim_value_records` | Output: reference entity records (`etim_class`, `etim_value`) |
| `akn_dependencies` | Output: per-class dependency config (show attributes, restrict values) |
| `esv_map_akn_rules`, `akn_rules_per_value_2-318` | Mapping from existing client attributes to ETIM attributes, output: Akeneo rules |

## Domain rules (from the prototype)

### Attribute codes and labels
- Code: lower-case feature code, plus unit code when the feature has a unit: `ef000003`, `ef000008_eu570448`.
- Code prefixes are configurable per project (feature, value and class codes, reference entity and `etim_class` attribute codes). Prototype codes are the defaults.
- One attribute per feature+unit combination across all selected classes (not per class).
- Label: `EF000008 - Width [mm]` / `EF000008 - Bredd [mm]` (feature code, description, unit in brackets).
- Mapped attributes (any type) are read only and get the suffix `(from: att_a)`. Swedish: `(från: ...)`.
- Locale specific words (`from`, `Description`, `Min`, `Max`, class attribute label) are project settings per locale.
- Locales: configurable per project (prototype uses `en_US`, `sv_SE`).
- Attribute groups: `etim_mapped` for features mapped from a client source attribute, `etim_unmapped` for the rest. Not scopable, not localizable, not unique.

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
- An A feature gets a companion text attribute `<code>_label` only when it is mapped from a client source attribute. It holds the value label and is filled by rules. Read only, label `EF000139 - Surface protection - Description` (no `from` suffix).

### Dependencies (per class)
Native Akeneo SaaS attribute dependencies:
- `IS_DISPLAYED`: once set for an attribute, it is hidden in all product views and only shown when the dependency conditions match.
- `RESTRICTED_VALUES`: once values are restricted for a simple select or reference entity attribute, only the listed values are shown when the conditions match.

Generated per class:
- Code `etim_ec000009` (dependency prefix + class record code), label `EC000009 - Hammer set anchor`.
- Trigger: `etim_class IN [ec000009]`. Uses the class record code (the prototype used `EC000009`, record codes are lower case).
- Every feature attribute in the class, in ETIM order (both `_min` and `_max` for ranges): `IS_DISPLAYED`.
- A features not mapped from a client attribute: `RESTRICTED_VALUES` right after, to the class's allowed ETIM value record codes, exactly as ETIM lists them (no special handling of generic values like `EV000154`). No restriction when ETIM lists no values.
- Label attributes in the class last: `IS_DISPLAYED`.

### Rules (auto enrichment)
Rules are built around the client's data model attributes (sources), not ETIM features. A feature has at most one source, a source can provide many features. For A features the source is a reference entity attribute: the selected record holds one ETIM value per mapped feature, in record attribute `ref_ef001122` (lower case, prefix is a project setting), and the value label in `ref_ef001122_label` (plus the label suffix).

One rule per source attribute, code `etim_<source>`, label `ETIM (from: <source>)`, with one or more actions per feature the source is mapped to (in attribute code order). Conditions: `etim_class NOT EMPTY` and source `NOT EMPTY`. Execution `triggered`. Priority is a project default (prototype uses 99), editable, the same for every rule.
| ETIM type | Action |
|---|---|
| A | copy `ref_ef...` from the source record to the feature, copy `ref_ef..._label` to `<code>_label` |
| N | copy value |
| R text | copy value |
| R min/max | copy the source to `_min` and `_max` |
| L without `yesValues` | copy (source is a boolean) |

Features needing their own conditions or a second source get their own rule, code `etim_<attribute code>`, label `EF000139 - Surface protection`:
| Case | Rule |
|---|---|
| R text with `second` | concatenate `[field, {text: '-'}, field]` as `10-20`, both sources NOT EMPTY. Akeneo docs: a space is only added between two field blocks, not next to a text block |
| R min/max with `second` | copy `attribute` to `_min`, `second` to `_max`, both NOT EMPTY |
| L with `yesValues` | rule `_true`: source IN yes values, set true. Rule `_false`: source NOT EMPTY and NOT IN, set false. Empty source stays empty |

Class exceptions (not in the prototype, needed for C4 where one source value maps to different ETIM values per class): a source record holds the default ETIM value per feature in `values` and exceptions per class in `classValues[EC][EF]`. Only a feature with an exception gets the extra record attribute pair `ref_ef000012_ec002910` and `_label`, filled for every record (the exception, else the default). One extra rule per source and class, code `etim_<source>_ec002910`, label `ETIM (from: <source>, EC002910)`, conditions `etim_class IN [ec002910]` and source NOT EMPTY, copying the class attributes. It has priority one higher than the default rule: Akeneo runs lower priorities first, so it runs after the default rule and overwrites it. Class values are checked against the values ETIM allows in that class; values for a class that is not selected or does not use the feature are ignored with a warning.

Field names follow the prototype's rules YAML. More than one source on a feature (older project files) is an error, the first is used. Duplicate rule codes are errors. With uploaded Akeneo attributes, unknown sources and wrong source types (A needs `akeneo_reference_entity`, L without yes values `pim_catalog_boolean`) are warnings.

### Source records (client reference entities)
- The reference entity of an A feature source is the project link (`sourceEntityLinks`, set in the mapping editor, shared by all features of that source), else the `reference_data_name` from the uploaded attribute export.
- `collectSourceEntities` groups mapped A features per reference entity. Each entity needs text attributes `ref_ef...` and `ref_ef..._label` per feature (not localizable, not scopable). Akeneo SaaS cannot import reference entity attributes from a file, so they are a manual step in the README.
- Records (`sourceEntities`, per entity: code, labels, `values` feature id to value id) come from an uploaded Akeneo record export (`parseAkeneoRecordExport`, also reads back the `ref_` columns) or are added by hand. A new upload replaces the records, mapped values of matching codes are kept.
- Export `07_records_<entity>` (XLSX and CSV): `referenceEntityIdentifier;code;ref_ef...;ref_ef..._label` per feature, every known record, value id (`EV000072`) and value label in the first project locale, empty when unmapped. No record labels, so the import only updates the ETIM attributes.
- A record value can be skipped on purpose (`skipped` on the record, feature ids, `withRecordSkipped`): no ETIM value, the record attribute stays empty, it counts as done and gets no unmapped warning. Only without a default value, setting one removes the skip. A whole record can be skipped at once on step 5, which skips each of its features without a value.
- Warnings: source without reference entity, entity without records, unmapped record values that are not skipped, values ETIM does not allow for the feature in the selected classes. When ETIM lists no values for a feature, any value id is allowed (`isRecordValueAllowed`, shared by the checks, the API and the mapping report).

## Tech stack
- TypeScript monorepo, pnpm workspaces, Node 22, Vitest.
- `packages/core` (`@vaimo-pim-etim-builder/core`): shared, framework-free ETIM to Akeneo logic (parsing, code/label generation, attributes, dependencies, rules, exporters). Most logic and tests live here. Consumed as TypeScript source (no build step).
- `apps/api` (`@vaimo-pim-etim-builder/api`): Fastify, port 3001. `buildApp()` in `src/app.ts`, tests use `app.inject`. Stateless, the web app does not call it:
  - `POST /etim/parse` `{ locale, tables }`: parses ETIM tables, for scripts.
  - `POST /project/sources` `{ project, mappings: [{ featureId, unitId?, type, attribute, second?, yesValues? }] }`: sets the source attribute of each feature in a project file (`applySourceMappings` in core), empty `attribute` removes it. Returns `{ project }`, or 400 `{ errors }` and nothing applied. Mapping a skipped feature removes the skip.
  - `POST /project/skipped` `{ project, features: [{ featureId, unitId?, skipped }] }`: marks features as skipped (not mapped on purpose) or unskips them (`applySkippedFeatures`). Skipping a mapped feature is an error. Same response.
  - `POST /project/entity-links` `{ project, links: [{ attribute, entity }] }`: links source attributes to their reference entity (`applySourceEntityLinks`, overrides the uploaded `reference_data_name`), empty `entity` removes the link. Same response.
  - `POST /project/records` `{ project, entity, records: [{ code, labels? }] }`: adds records to a source reference entity (`addSourceRecords`), existing records get labels merged and keep their ETIM values. Same response.
  - `POST /project/record-values` `{ project, release?, values: [{ entity, record, featureId, classId?, valueId }] }`: sets the ETIM value of a source record for a feature (`applySourceRecordValues`), with `classId` the exception for that class, empty `valueId` clears it. `release` is the `/etim/parse` output (only the selected classes are needed). Left out, the API parses the pre-loaded export in `project.etimSource.library` (first locale) from `apps/web/etim-files` (`ETIM_FILES_DIR` overrides), about 1 s the first time, then kept in memory until restart. The entity must be behind a mapped A feature, the record must exist and the value must be allowed by ETIM for the feature in the selected classes (any value id like `EV000072` when ETIM lists no values for it, as on the source record mapping step (5)). Same response.
- `apps/web` (`@vaimo-pim-etim-builder/web`): React + Vite + Mantine (Stepper for the wizard). Dev server proxies `/api/*` to the API.
  - Workspace only (the wizard mode was removed): numbered steps in a sidebar, opened in any order, status per step, a Next button under each step. Screens: 1. Setup ETIM versions, 2. Select Classes and Locales, 3. Configure Features, 4. Mapping: Feature to Source attribute, 5. Mapping: Source record to Value, 6. Review ETIM data model, 7. Export ETIM data model (ids `import`, `classes`, `features`, `mapping`, `records`, `review`, `export`). Steps after Import need a release without errors, steps after Classes a selected class. Generated output is never edited directly.
  - Steps 1 to 5 are split into numbered sub steps (`SubStep` in `apps/web/src/components`, numbers and titles in `SUB_STEPS` in `apps/web/src/workspace/sections.ts`): 1.1 ETIM version, 1.2 Add a language, 2.1 Project locales, 2.2 Classes, 3.1 Project defaults, 3.2 Unit mapping, 3.3 Features, 4.1 Add Akeneo attributes, 4.2 Map features, 5.1 Reference entity records of A features, 5.2 Source values of L features. Each has a line above it, the numbered title, a description and its content; 1.2 and 4.1 are collapsed by default, 3.1 is collapsible and open by default. Tasks carry the number of their sub step.
  - Every step has a "Tasks" box at the top right with its manual work (`StepWorkBox`, tasks from `stepWork` in `apps/web/src/workspace/stepTasks.ts`): what the consultant must do by hand on that step, done or open, with an orange "N to do" or green "All done" status and a neutral gray border. Work the app cannot check (creating the record attributes in Akeneo on step 5, the download and Akeneo steps on step 7) is a reminder and does not count as to do. The export step lists the download and the Akeneo manual steps (`akeneoManualSteps` in core, the same as README.txt). It comes after the step heading: on wide screens in a sticky right column, on narrow screens between the heading and the step. A toggle button above the side column collapses it in one go to slim Tasks (with the open count) and Summary boxes, remembered in localStorage. Below it, the step's counts are a light Summary table (`StepSummary` in `apps/web/src/components`, rendered by the step into a slot in the side column), on steps 1, 3, 4 and 6.
  - Style (`apps/web/src/theme.ts`, `theme.css`): square corners everywhere except inputs, drop downs, drop areas and buttons. Pills (badges) are round with lower case text, except locales (`styles={KEEP_CASE}`). Monospaced text is 12/14 of the text around it (12px next to 14px). Boxes that open and close (`CollapsibleBox`, sub steps, step 5 panels, error and warning lists) share the round toggle button (`ToggleIcon`); errors start open, warnings closed. Fonts: Inter Display (body, `inter-ui` package), DINish (headings) and Meslo LG M (monospace), the last two in `apps/web/src/fonts` with their licenses.
  - Wording: a source attribute or reference entity *provides* features, use "provide" for that relation everywhere in the app.
  - Step 5 also lists the source attributes of mapped L features (`collectLogicalSources` in core): a Yes/No attribute (uploaded type `pim_catalog_boolean`, or no type and no values) is copied, for others the consultant ticks the yes values per feature. L features of a non Yes/No source without yes values are open work. Step 4 only sets the L source attribute.
  - Steps 5 and 6 show per reference entity: the client attributes using it, the number of records, the features it provides, and per feature the values filled (default plus class values, so it can be more than the records) and the number of classes with class exceptions (`sourceEntitySummaries` in `apps/web/src/review`).
  - Settings drawer from the project bar: codes, groups, label words per locale, rule priority, validated by `validateSettings` in core.
  - State: `useReducer` + context in `apps/web/src/state`. Heavy work (ETIM import, export) runs in web workers.

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

## Export (`packages/core/src/export`)
- `buildExport(release, project)` returns all files, issues and the manual Akeneo steps (`akeneoManualSteps`), `zipExport(files)` zips them. Runs in a web worker in the browser (about 2 s for 6000 classes), output is deterministic.
- Files: `README.txt` (manual steps), `xlsx/` and `csv/` (attribute groups, attributes, class and value records, Akeneo import columns, `;` CSV), `05_rules.yml`, `06_attribute_dependencies.yml` (root key `dependencies`, imported as a file), `mapping_report.xlsx` (sheets Summary with skipped features, source record counts and rule priorities, Features with mapping status (Mapped, Skipped, Not mapped), reference entity and class values, Sources with the `ref_` record attributes each source entity needs, Source records with one row per record, feature and class value and a status, Rules with conditions and actions, Attributes, Classes, Issues), the project file.
- XLSX via a small writer on `fflate` (`writeXlsx`), no spreadsheet library in the bundle.
- YAML via a small writer (`export/yaml.ts`), the `yaml` package is only used in tests. Block style, no anchors/aliases, anything but simple codes double quoted, YAML 1.1 words like `yes` quoted, so PHP parsers read strings as strings.
- No attribute options file: ETIM values are reference entity records, there are no select attributes.

## Source attributes (`packages/core/src/source`)
- `parseAkeneoAttributeExport(bytes, fileName)` reads an Akeneo attribute export, XLSX (small regex based reader, `readXlsxRows`, works in workers) or CSV. Columns `code` (required), `type`, `group`, `reference_data_name`, `label-<locale>`.
- `parseAkeneoRecordExport(bytes, fileName, prefix)` reads an Akeneo record export: `code` (required), `label-<locale>`, and `<prefix>ef...` value columns.
- `parseAkeneoOptionExport(bytes, fileName)` reads an Akeneo attribute option export: `attribute` and `code` (required), `label-<locale>`. Options per attribute, for L feature sources.

## Open decisions
- None right now. Add new ones here as they come up.

Decided: the rules YAML keeps the prototype format (`operator: AND` condition groups, `execution_type`, `triggers`, `reference_entity_attribute` on copy), it is proven on SaaS, even though Akeneo's public on-prem docs show a flat condition list. Dependencies are imported as a YAML file with root key `dependencies`.

## Conventions
- Keep generated Akeneo codes deterministic, the same ETIM input must always produce the same codes.
- Keep the prototype tab names in mind when naming modules, so logic can be traced back to the sheet.
