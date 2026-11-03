# Vaimo PIM ETIM Builder

**Build an ETIM data model in Akeneo without the spreadsheet.**

Open the app: [https://psu-vaimo.github.io/vaimo-pim-etim-builder/](https://vaimo.github.io/pim-etim-builder/)

## What is it

ETIM is the classification standard for technical products: classes (for example *Hammer set anchor*) with features (*Width*, *Material*, *Surface protection*), values and units. Clients selling to installers and wholesalers need their products in ETIM. In Akeneo that means hundreds or thousands of attributes, value records, attribute dependencies and enrichment rules, all of which must follow one naming scheme and stay consistent.

The ETIM Builder aims to support building that data model, with a guided app. It runs in the browser, keeps all work in one project file per client, and produces Akeneo import files that are the same every time for the same input.

## For who

- **Manufacturers that provide ETIM data.** The app is tested with a manufacturer that provides ETIM data in a limited number of classes. A reseller that consumes ETIM data may have many more classes and features, and very different requirements.
- **One ETIM class per product, families kept apart.** The app assumes an ETIM class can be assigned to each product, and that Akeneo families should stay independent of ETIM classes.
- **A static data model.** The app produces a static data model: nothing dynamic, and no migration when a new ETIM version is released. This stays true even if API connections to ETIM or Akeneo are added.

## What you get

- **Attributes**, one per ETIM feature and unit, with the right Akeneo type (reference entity, number, metric, boolean, text or min/max).
- **Reference entity records** for the `etim_class` and `etim_value` entities.
- **Attribute dependencies**, per class: show only the features of the product's ETIM class, and only the values ETIM allows.
- **Enrichment rules** that fill the ETIM attributes from the client's own attributes, so products are classified once and kept in sync.
- **Record import files** for the client's reference entities, with the ETIM value behind each record.
- **A mapping report** (XLSX) for the client to review what is mapped, skipped and still open.

## How to use it

Work through the numbered steps in the sidebar. You can open them in any order. The **Tasks** box on the right shows what is still open on each step.

1. **Setup ETIM versions.** Pick a pre-loaded ETIM release or upload an ETIM export, and add a second language if needed.
2. **Select Classes and Locales.** Choose the project locales and the ETIM classes the client uses.
3. **Configure Features.** Set the project defaults: number or metric, and how ranges are stored. Map ETIM units to Akeneo measurement units, and override single features where needed.
4. **Map features to source attributes.** Upload the client's Akeneo attribute export, then pick the client attribute that provides each ETIM feature. Features you decide not to map can be marked as skipped.
5. **Map source records and values.** For alphanumeric features, map each record of the client's reference entity to an ETIM value, with exceptions per class where needed. For logical features, tick the source values that mean *yes*.
6. **Review the ETIM data model.** Check the generated attributes, dependencies and rules, and fix any errors or warnings.
7. **Export the ETIM data model.** Download the zip and follow the steps in the README inside it to import into Akeneo.

Save the project file from the project bar whenever you stop, and load it again to continue.

## Still manual in Akeneo

- Create the `ref_` text attributes on the client's reference entities. Step 7 lists them, because Akeneo SaaS cannot import them from a file.
- **Add the ETIM attributes to the families.** This step is required.

For development and domain rules, see [CLAUDE.md](CLAUDE.md).
