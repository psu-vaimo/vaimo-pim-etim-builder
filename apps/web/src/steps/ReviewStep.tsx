import { labelFor, type AkeneoDependency } from '@akeneo-etim/core';
import { Badge, Group, Paper, SegmentedControl, Select, SimpleGrid, Stack, Tabs, Text } from '@mantine/core';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { GenerateIssues } from '../components/features/GenerateIssues.js';
import { PagedTable, type Column } from '../components/review/PagedTable.js';
import { SourceEntityTable } from '../components/review/SourceEntityTable.js';
import { ATTRIBUTE_TYPE_LABELS } from '../features/featureRows.js';
import { useGeneratedModel } from '../review/generated.js';
import {
  attributeReviewRows,
  countAttributeTypes,
  dependencyReviewRows,
  recordReviewRows,
  ruleReviewRows,
  sourceEntitySummaries,
  sourceRecordReviewRows,
  truncateList,
  type AttributeReviewRow,
  type DependencyReviewRow,
  type RecordReviewRow,
  type RuleReviewRow,
  type SourceRecordReviewRow,
} from '../review/reviewRows.js';
import { useAppState } from '../state/AppStateContext.js';
import { displayLocale } from '../state/appState.js';
import { TEXT_COLORS } from '../theme.js';
import { CodeList } from '../components/CodeList.js';

/** Restricted values listed per attribute in the dependency details. */
const MAX_VALUES = 40;

function Stat({ label, value, testId, color, children }: { label: string; value: number; testId: string; color?: string; children?: ReactNode }) {
  return (
    <Paper withBorder p="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} {...(value > 0 && color ? { c: color } : {})} data-testid={testId}>
        {value.toLocaleString('en-US')}
      </Text>
      {children}
    </Paper>
  );
}

const mono = (s: string) => (
  <Text ff="monospace" size="sm">
    {s}
  </Text>
);

function DependencyDetails({ dependency }: { dependency: AkeneoDependency }) {
  return (
    <Stack gap={4} data-testid="dependency-attributes">
      <Text size="xs" fw={600}>
        Dependent attributes, in order
      </Text>
      {dependency.dependentAttributes.map((d, i) => {
        if (d.action === 'IS_DISPLAYED') {
          return (
            <Group key={i} gap="xs">
              {mono(d.attribute_code)}
              <Badge size="xs" variant="light" color="gray">
                Shown
              </Badge>
            </Group>
          );
        }
        const { shown, more } = truncateList(d.values, MAX_VALUES);
        return (
          <Stack key={i} gap={2} pl="md">
            <Group gap="xs">
              {mono(d.attribute_code)}
              <Badge size="xs" variant="light" color="grape">
                Restricted to {d.values.length} values
              </Badge>
            </Group>
            <CodeList items={shown} more={more} size="xs" c="dimmed" columnWidth={12} />
          </Stack>
        );
      })}
    </Stack>
  );
}

export function ReviewStep() {
  const state = useAppState();
  const { release, project } = state;
  const locale = displayLocale(state);
  const model = useGeneratedModel(release, project);
  const [records, setRecords] = useState<'classes' | 'values'>('classes');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [entityCode, setEntityCode] = useState<string | null>(null);

  const attributeRows = useMemo(() => (model ? attributeReviewRows(model.attributes) : []), [model]);
  const ruleRows = useMemo(() => (model ? ruleReviewRows(model.rules, locale) : []), [model, locale]);
  const dependencyRows = useMemo(() => (model ? dependencyReviewRows(model.dependencies, locale) : []), [model, locale]);
  const classRecordRows = useMemo(() => (model ? recordReviewRows(model.classRecords) : []), [model]);
  const valueRecordRows = useMemo(() => (model ? recordReviewRows(model.valueRecords) : []), [model]);
  const entitySummaries = useMemo(() => (model && release ? sourceEntitySummaries(release, project, model.sourceEntities, locale) : []), [model, release, project, locale]);
  const entity = model?.sourceEntities.find((e) => e.code === entityCode) ?? model?.sourceEntities[0];
  const sourceRecordRows = useMemo(
    () => (release && entity ? sourceRecordReviewRows(release, entity, locale) : []),
    [release, entity, locale],
  );
  const toggle = useCallback(
    (row: DependencyReviewRow) =>
      setExpanded((set) => {
        const next = new Set(set);
        if (next.has(row.dependency.code)) next.delete(row.dependency.code);
        else next.add(row.dependency.code);
        return next;
      }),
    [],
  );

  if (!release || !model) return <Text mt="md">Import an ETIM export first.</Text>;

  const errors = model.issues.filter((i) => i.severity === 'error').length;
  const warnings = model.issues.length - errors;
  const locales = project.locales;

  const attributeColumns: Column<AttributeReviewRow>[] = [
    { header: 'Code', render: (r) => mono(r.attribute.code) },
    {
      header: 'Type',
      width: 150,
      render: (r) => (
        <Group gap={4}>
          <Badge variant="light">{ATTRIBUTE_TYPE_LABELS[r.attribute.type]}</Badge>
          {r.attribute.metricFamily && (
            <Text size="xs" c="dimmed">
              {r.attribute.metricFamily}
            </Text>
          )}
        </Group>
      ),
    },
    ...locales.map(
      (l): Column<AttributeReviewRow> => ({
        header: `Label ${l}`,
        render: (r) => r.attribute.labels[l] ?? <Text c="dimmed" size="sm">No label</Text>,
      }),
    ),
    { header: 'Group', width: 130, render: (r) => mono(r.attribute.group) },
    {
      header: 'Read only',
      width: 90,
      render: (r) =>
        r.attribute.readOnly ? (
          <Badge size="sm" variant="light" color="orange">
            Read only
          </Badge>
        ) : null,
    },
    { header: 'Feature', width: 170, render: (r) => (r.feature ? mono(r.feature) : <Text size="sm" c="dimmed">Class attribute</Text>) },
  ];

  const ruleColumns: Column<RuleReviewRow>[] = [
    {
      header: 'Code',
      render: (r) => (
        <Stack gap={0}>
          {mono(r.rule.code)}
          <Text size="xs" c="dimmed">
            {r.label}
          </Text>
        </Stack>
      ),
    },
    { header: 'Priority', width: 80, align: 'right', render: (r) => r.rule.priority },
    { header: 'When', render: (r) => <Stack gap={0}>{r.conditions.map((c, i) => <Text key={i} size="xs" ff="monospace">{c}</Text>)}</Stack> },
    { header: 'Then', render: (r) => <Stack gap={0}>{r.actions.map((a, i) => <Text key={i} size="xs" ff="monospace">{a}</Text>)}</Stack> },
  ];

  const dependencyColumns: Column<DependencyReviewRow>[] = [
    { header: '', width: 30, render: (r) => <Text c="dimmed">{expanded.has(r.dependency.code) ? '▾' : '▸'}</Text> },
    { header: 'Code', width: 170, render: (r) => mono(r.dependency.code) },
    { header: `Label${locale ? ` (${locale})` : ''}`, render: (r) => r.label },
    { header: 'Trigger', render: (r) => <Text size="xs" ff="monospace">{r.trigger}</Text> },
    { header: 'Shown attributes', width: 140, align: 'right', render: (r) => r.shown },
    { header: 'Restricted attributes', width: 160, align: 'right', render: (r) => r.restricted },
  ];

  const recordColumns: Column<RecordReviewRow>[] = [
    { header: 'Code', width: 170, render: (r) => mono(r.record.code) },
    ...locales.map(
      (l): Column<RecordReviewRow> => ({
        header: `Label ${l}`,
        render: (r) => r.record.labels[l] ?? <Text c="dimmed" size="sm">No label</Text>,
      }),
    ),
  ];

  const sourceRecordColumns: Column<SourceRecordReviewRow>[] = [
    {
      header: 'Record',
      width: 200,
      render: (r) => (
        <Stack gap={0}>
          {mono(r.record.code)}
          <Text size="xs" c="dimmed">
            {r.label}
          </Text>
        </Stack>
      ),
    },
    ...(entity?.features ?? []).map(
      (f, i): Column<SourceRecordReviewRow> => ({
        header: (
          <Stack gap={0}>
            <Text size="sm" fw={600} ff="monospace">
              {f.featureId}
            </Text>
            <Text size="xs" c="dimmed" fw={400}>
              {labelFor(release?.features[f.featureId]?.labels ?? {}, locale)}
            </Text>
          </Stack>
        ),
        render: (r) => {
          const cell = r.cells[i];
          return (
            <Stack gap={2}>
              {cell?.value ? (
                <Text size="sm">{cell.value}</Text>
              ) : cell?.skipped ? (
                <Text size="sm" c="dimmed">
                  Skipped
                </Text>
              ) : (
                <Text size="sm" c={TEXT_COLORS.warning}>
                  Not mapped
                </Text>
              )}
              {cell?.classValues.map((v) => (
                <Group key={v.classId} gap={4} wrap="nowrap">
                  <Badge size="xs" variant="light" color="grape" style={{ flexShrink: 0 }}>
                    {v.classId}
                  </Badge>
                  <Text size="xs">{v.value}</Text>
                </Group>
              ))}
            </Stack>
          );
        },
      }),
    ),
  ];
  const sourceRecordCount = entitySummaries.reduce((n, e) => n + e.records, 0);

  return (
    <Stack gap="lg" mt="md">
      <Text size="sm" c="dimmed">
        Everything the export will contain, read only. Go back to a step to change it.
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 8 }} spacing="sm">
        <Stat label="Attributes" value={model.attributes.length} testId="review-stat-attributes">
          <Group gap={4} mt={6} data-testid="review-attribute-types">
            {countAttributeTypes(model.attributes).map(([type, count]) => (
              <Badge key={type} size="xs" variant="light">
                {ATTRIBUTE_TYPE_LABELS[type]} {count.toLocaleString('en-US')}
              </Badge>
            ))}
          </Group>
        </Stat>
        <Stat label="Class records" value={model.classRecords.length} testId="review-stat-class-records" />
        <Stat label="Value records" value={model.valueRecords.length} testId="review-stat-value-records" />
        <Stat label="Source records" value={sourceRecordCount} testId="review-stat-source-records">
          {entitySummaries.length > 0 && (
            <Text size="xs" c="dimmed" mt={6}>
              {entitySummaries.length === 1 ? '1 reference entity' : `${entitySummaries.length} reference entities`}
            </Text>
          )}
        </Stat>
        <Stat label="Rules" value={model.rules.length} testId="review-stat-rules" />
        <Stat label="Dependencies" value={model.dependencies.length} testId="review-stat-dependencies" />
        <Stat label="Errors" value={errors} color={TEXT_COLORS.error} testId="review-stat-errors" />
        <Stat label="Warnings" value={warnings} color={TEXT_COLORS.warning} testId="review-stat-warnings" />
      </SimpleGrid>

      <GenerateIssues issues={model.issues} />

      <Tabs defaultValue="attributes" keepMounted={false} data-testid="review-tabs">
        <Tabs.List>
          <Tabs.Tab value="attributes" data-testid="tab-attributes">
            Attributes ({model.attributes.length.toLocaleString('en-US')})
          </Tabs.Tab>
          <Tabs.Tab value="rules" data-testid="tab-rules">
            Rules ({model.rules.length.toLocaleString('en-US')})
          </Tabs.Tab>
          <Tabs.Tab value="dependencies" data-testid="tab-dependencies">
            Dependencies ({model.dependencies.length.toLocaleString('en-US')})
          </Tabs.Tab>
          <Tabs.Tab value="records" data-testid="tab-records">
            Records ({(model.classRecords.length + model.valueRecords.length).toLocaleString('en-US')})
          </Tabs.Tab>
          <Tabs.Tab value="source-records" data-testid="tab-source-records">
            Source records ({sourceRecordCount.toLocaleString('en-US')})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="attributes" pt="md">
          <PagedTable
            rows={attributeRows}
            columns={attributeColumns}
            rowKey={(r) => r.attribute.code}
            noun="attributes"
            placeholder="Code, label, type, group or feature"
            testId="review-attributes"
          />
        </Tabs.Panel>

        <Tabs.Panel value="rules" pt="md">
          {ruleRows.length === 0 ? (
            <Text size="sm" c="dimmed">
              No rules, map client source attributes in step 4, Mapping: Feature to Source attribute, to generate them.
            </Text>
          ) : (
            <PagedTable
              rows={ruleRows}
              columns={ruleColumns}
              rowKey={(r) => r.rule.code}
              noun="rules"
              placeholder="Rule code, label, feature or source"
              testId="review-rules"
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="dependencies" pt="md">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              One dependency per class. Click a row to list its dependent attributes and restricted values.
            </Text>
            <PagedTable
              rows={dependencyRows}
              columns={dependencyColumns}
              rowKey={(r) => r.dependency.code}
              noun="dependencies"
              placeholder="Code, class, label or attribute code"
              testId="review-dependencies"
              expanded={expanded}
              renderExpanded={(r) => <DependencyDetails dependency={r.dependency} />}
              onRowClick={toggle}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="records" pt="md">
          <Stack gap="sm">
            <SegmentedControl
              w="fit-content"
              value={records}
              onChange={(v) => setRecords(v as 'classes' | 'values')}
              data={[
                { value: 'classes', label: `${project.settings.codes.classEntity} (${model.classRecords.length.toLocaleString('en-US')})` },
                { value: 'values', label: `${project.settings.codes.valueEntity} (${model.valueRecords.length.toLocaleString('en-US')})` },
              ]}
              data-testid="review-records-entity"
            />
            <PagedTable
              key={records}
              rows={records === 'classes' ? classRecordRows : valueRecordRows}
              columns={recordColumns}
              rowKey={(r) => r.record.code}
              noun="records"
              placeholder="Record code or label"
              testId="review-records"
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="source-records" pt="md">
          {entitySummaries.length === 0 ? (
            <Text size="sm" c="dimmed">
              No reference entity provides an A feature, so there are no source records to fill.
            </Text>
          ) : (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Client reference entities that provide A features. Each record provides one ETIM value per feature in the record
                attributes listed, class exceptions replace the default in that class.
              </Text>
              <SourceEntityTable summaries={entitySummaries} testId="review-source-entities" />
              {entitySummaries.length > 1 && (
                <Select
                  label="Records of"
                  data={entitySummaries.map((e) => e.code)}
                  value={entity?.code ?? null}
                  onChange={setEntityCode}
                  allowDeselect={false}
                  w={280}
                  data-testid="review-source-entity"
                />
              )}
              {entity && entity.records.length > 0 && (
                <PagedTable
                  key={entity.code}
                  rows={sourceRecordRows}
                  columns={sourceRecordColumns}
                  rowKey={(r) => r.record.code}
                  noun="records"
                  placeholder="Record code, label or value"
                  testId="review-source-records"
                />
              )}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
