import {
  collectSourceEntities,
  featureRecordAttributes,
  labelFor,
  parseAkeneoRecordExport,
  sourceRecordAttribute,
  type EtimRelease,
  type GenerateIssue,
  type Project,
  type SourceEntityFeature,
  type SourceEntityPlan,
  type SourceRecord,
} from '@akeneo-etim/core';
import { ActionIcon, Alert, Badge, Button, Group, Pagination, Paper, ScrollArea, Select, Stack, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { memo, useDeferredValue, useMemo, useState } from 'react';
import { codeError } from '../mapping/sourceMappings.js';
import type { Dispatch } from 'react';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { displayLocale, type AppAction } from '../state/appState.js';

type AppDispatch = Dispatch<AppAction>;

const PAGE_SIZE = 25;
const VALUE_ID = /^EV\d{6}$/;

/** Maps the records of the customer reference entities behind A feature sources to ETIM values. */
export function RecordsStep() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { release, project } = state;
  const locale = displayLocale(state);
  const collected = useMemo(() => (release ? collectSourceEntities(release, project) : undefined), [release, project]);

  if (!release || !collected) return <Text mt="md">Import an ETIM export first.</Text>;

  return (
    <Stack gap="lg" mt="md">
      <Text size="sm" c="dimmed">
        A features mapped from a reference entity attribute get their ETIM value from the selected record. Map each record to an ETIM
        value per feature. The export writes one record import file per reference entity, filling the record attributes{' '}
        {sourceRecordAttribute(project, 'EF000139')} (value code) and {sourceRecordAttribute(project, 'EF000139')}
        {project.settings.codes.labelSuffix} (value label). When a record needs another value in one class, add a class value: the
        feature then gets the record attributes {sourceRecordAttribute(project, 'EF000139')}_ec000009 and its label, and a rule that only
        runs for that class.
      </Text>
      {collected.entities.length === 0 && (
        <Alert color="gray" data-testid="records-empty">
          No A feature is mapped to a reference entity yet. Map A features on the Mapping step and set the reference entity of their
          source attribute (or upload the Akeneo attribute export, which has it).
        </Alert>
      )}
      {collected.issues
        .filter((i) => i.featureKey !== undefined)
        .map((issue, i) => (
          <Alert key={i} color="yellow" p="xs">
            <Text size="sm">{issue.message}</Text>
          </Alert>
        ))}
      {collected.entities.map((plan) => (
        <EntityPanel key={plan.code} plan={plan} release={release} project={project} locale={locale} dispatch={dispatch} />
      ))}
    </Stack>
  );
}

interface PanelProps {
  plan: SourceEntityPlan;
  release: EtimRelease;
  project: Project;
  locale: string | undefined;
  dispatch: AppDispatch;
}

const EntityPanel = memo(function EntityPanel({ plan, release, project, locale, dispatch }: PanelProps) {
  const [uploadIssues, setUploadIssues] = useState<GenerateIssue[]>([]);
  const [newCode, setNewCode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const { codes } = project.settings;

  const options = useMemo(() => {
    const option = (id: string) => ({ value: id, label: `${id} - ${labelFor(release.values[id]?.labels ?? {}, locale)}` });
    return plan.features.map((f) => ({
      all: f.valueIds.map(option),
      byClass: Object.fromEntries(Object.entries(f.classValueIds).map(([classId, ids]) => [classId, ids.map(option)])),
    }));
  }, [plan.features, release, locale]);
  const classLabels = useMemo(
    () => Object.fromEntries(project.classIds.map((id) => [id, labelFor(release.classes[id]?.labels ?? {}, locale)])),
    [project.classIds, release, locale],
  );
  const filtered = useMemo(() => {
    const words = deferredSearch.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return plan.records;
    return plan.records.filter((r) => {
      const classText = Object.entries(r.classValues ?? {}).flatMap(([classId, values]) => [classId, ...Object.values(values)]);
      const text = [r.code, ...Object.values(r.labels), ...Object.values(r.values), ...classText].join('\n').toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [plan.records, deferredSearch]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const mapped = plan.records.reduce((n, r) => n + plan.features.filter((f) => r.values[f.featureId]).length, 0);
  const total = plan.records.length * plan.features.length;
  const newCodeTrimmed = newCode.trim();
  const newCodeError =
    codeError(newCodeTrimmed) ?? (plan.records.some((r) => r.code === newCodeTrimmed) ? `${newCodeTrimmed} already exists` : undefined);
  const recordAttributes = plan.features.flatMap((f) => featureRecordAttributes(project, f));
  const exceptions = plan.records.reduce((n, r) => n + Object.values(r.classValues ?? {}).reduce((m, v) => m + Object.keys(v).length, 0), 0);

  async function upload(file: File) {
    const parsed = parseAkeneoRecordExport(new Uint8Array(await file.arrayBuffer()), file.name, codes.sourceRecordAttributePrefix);
    setUploadIssues(parsed.issues);
    if (parsed.records.length > 0) dispatch({ type: 'replaceSourceRecords', entity: plan.code, records: parsed.records });
  }

  function addRecord() {
    if (newCodeTrimmed === '' || newCodeError) return;
    dispatch({ type: 'addSourceRecord', entity: plan.code, record: { code: newCodeTrimmed, labels: {}, values: {} } });
    setNewCode('');
  }

  return (
    <Paper withBorder p="md" radius="md" data-testid={`entity-${plan.code}`}>
      <Stack gap="sm">
        <Group gap="xs">
          <Title order={4} ff="monospace">
            {plan.code}
          </Title>
          <Badge variant="light" color="gray">
            from {plan.attributes.join(', ')}
          </Badge>
          <Badge variant="light">{plan.records.length === 1 ? '1 record' : `${plan.records.length} records`}</Badge>
          {total > 0 && (
            <Badge variant="light" color={mapped === total ? 'teal' : 'orange'} data-testid="entity-mapped">
              {mapped} of {total} values mapped
            </Badge>
          )}
          {exceptions > 0 && (
            <Badge variant="light" color="grape" data-testid="entity-class-values">
              {exceptions === 1 ? '1 class value' : `${exceptions} class values`}
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          Needs the text attributes (not localizable, not scopable) <Text span ff="monospace" size="sm">{recordAttributes.join(', ')}</Text>
        </Text>

        <Group align="flex-end" gap="sm">
          <Dropzone
            onDrop={(files) => files[0] && void upload(files[0])}
            multiple={false}
            accept={['.xlsx', '.csv', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']}
            style={{ flex: 1 }}
            p="xs"
            data-testid="records-dropzone"
          >
            <Text ta="center" size="sm" fw={600} style={{ pointerEvents: 'none' }}>
              {plan.records.length > 0
                ? 'Drop a record export to replace the records (mapped values of matching codes are kept)'
                : 'Drop the Akeneo record export of this reference entity (XLSX or CSV), or click to choose'}
            </Text>
          </Dropzone>
          <TextInput
            label="Add record"
            placeholder="record_code"
            value={newCode}
            error={newCodeTrimmed !== '' ? newCodeError : undefined}
            onChange={(e) => setNewCode(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRecord()}
            w={200}
            data-testid="record-new-code"
          />
          <Button variant="light" onClick={addRecord} disabled={newCodeTrimmed === '' || newCodeError !== undefined} data-testid="record-add">
            Add
          </Button>
        </Group>
        {uploadIssues.map((issue, i) => (
          <Alert key={i} color={issue.severity === 'error' ? 'red' : 'yellow'} p="xs">
            <Text size="sm">{issue.message}</Text>
          </Alert>
        ))}

        {plan.records.length > 0 && (
          <>
            <TextInput
              placeholder="Search records, labels or values"
              value={search}
              onChange={(e) => {
                setSearch(e.currentTarget.value);
                setPage(1);
              }}
              maw={360}
              data-testid="records-search"
            />
            <ScrollArea type="auto">
              <Table withTableBorder verticalSpacing={4} data-testid="records-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th miw={180}>Record</Table.Th>
                    {plan.features.map((f) => (
                      <Table.Th key={f.featureId} miw={240}>
                        <Text size="sm" fw={600} ff="monospace">
                          {f.featureId}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {labelFor(release.features[f.featureId]?.labels ?? {}, locale)}
                        </Text>
                        {f.exceptionClassIds.length > 0 && (
                          <Text size="xs" c="grape">
                            Class values for {f.exceptionClassIds.join(', ')}
                          </Text>
                        )}
                      </Table.Th>
                    ))}
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((record) => (
                    <RecordRow
                      key={record.code}
                      record={record}
                      plan={plan}
                      options={options}
                      classLabels={classLabels}
                      locale={locale}
                      dispatch={dispatch}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            {totalPages > 1 && <Pagination total={totalPages} value={currentPage} onChange={setPage} size="sm" />}
          </>
        )}
      </Stack>
    </Paper>
  );
});

type Option = { value: string; label: string };

/** Allowed values of a feature: over all selected classes, and per class. */
interface FeatureOptions {
  all: Option[];
  byClass: Record<string, Option[]>;
}

interface RowProps {
  record: SourceRecord;
  plan: SourceEntityPlan;
  /** Allowed values per feature, same order as `plan.features`. */
  options: FeatureOptions[];
  classLabels: Record<string, string>;
  locale: string | undefined;
  dispatch: AppDispatch;
}

const RecordRow = memo(function RecordRow({ record, plan, options, classLabels, locale, dispatch }: RowProps) {
  const setValue = (featureId: string, classId: string | undefined, valueId: string | null) =>
    dispatch({ type: 'setSourceRecordValue', entity: plan.code, code: record.code, featureId, ...(classId ? { classId } : {}), valueId });
  return (
    <Table.Tr data-testid={`record-${record.code}`}>
      <Table.Td style={{ verticalAlign: 'top' }}>
        <Text size="sm" ff="monospace">
          {record.code}
        </Text>
        <Text size="xs" c="dimmed">
          {labelFor(record.labels, locale)}
        </Text>
      </Table.Td>
      {plan.features.map((f, i) => (
        <Table.Td key={f.featureId} style={{ verticalAlign: 'top' }}>
          <Stack gap={4}>
            <ValueSelect
              value={record.values[f.featureId] ?? null}
              allowed={options[i]?.all ?? []}
              placeholder="Not mapped"
              onChange={(v) => setValue(f.featureId, undefined, v)}
              testId={`value-${record.code}-${f.featureId}`}
            />
            <ClassValues
              record={record}
              feature={f}
              options={options[i]?.byClass ?? {}}
              classLabels={classLabels}
              onChange={(classId, v) => setValue(f.featureId, classId, v)}
            />
          </Stack>
        </Table.Td>
      ))}
      <Table.Td style={{ verticalAlign: 'top' }}>
        <Tooltip label="Remove record">
          <ActionIcon
            variant="default"
            aria-label="Remove record"
            onClick={() => dispatch({ type: 'removeSourceRecord', entity: plan.code, code: record.code })}
            data-testid={`record-remove-${record.code}`}
          >
            ×
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );
});

interface ValueSelectProps {
  value: string | null;
  allowed: Option[];
  placeholder: string;
  onChange: (v: string | null) => void;
  testId: string;
}

/** An ETIM value from the allowed list, or typed by hand when ETIM lists none. A value outside the list is shown as an error. */
function ValueSelect({ value, allowed, placeholder, onChange, testId }: ValueSelectProps) {
  if (allowed.length === 0) return <FreeValueInput value={value} onChange={onChange} testId={testId} />;
  const data = value && !allowed.some((o) => o.value === value) ? [...allowed, { value, label: `${value} (not allowed by ETIM)` }] : allowed;
  return (
    <Select
      data={data}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchable
      clearable
      size="xs"
      error={value && data !== allowed ? true : undefined}
      comboboxProps={{ withinPortal: true }}
      data-testid={testId}
    />
  );
}

interface ClassValuesProps {
  record: SourceRecord;
  feature: SourceEntityFeature;
  /** Allowed values per class. */
  options: Record<string, Option[]>;
  classLabels: Record<string, string>;
  onChange: (classId: string, valueId: string | null) => void;
}

/** Class exceptions of one record value: a value per class replacing the default in that class, and a picker to add one. */
function ClassValues({ record, feature, options, classLabels, onChange }: ClassValuesProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const { featureId } = feature;
  const current = Object.entries(record.classValues ?? {})
    .flatMap(([classId, values]) => (values[featureId] ? [{ classId, valueId: values[featureId] }] : []))
    .sort((a, b) => (a.classId < b.classId ? -1 : 1));
  const free = feature.classIds.filter((c) => !current.some((e) => e.classId === c));
  const testId = `class-values-${record.code}-${featureId}`;
  return (
    <>
      {current.map(({ classId, valueId }) => (
        <Group key={classId} gap={4} wrap="nowrap" align="center">
          <Tooltip label={feature.classIds.includes(classId) ? classLabels[classId] || classId : `${classId} is not a selected class using ${featureId}, ignored`}>
            <Badge size="sm" variant="light" color={feature.classIds.includes(classId) ? 'grape' : 'red'} style={{ flexShrink: 0 }}>
              {classId}
            </Badge>
          </Tooltip>
          <div style={{ flex: 1 }}>
            <ValueSelect
              value={valueId}
              allowed={options[classId] ?? []}
              placeholder="Remove class value"
              onChange={(v) => onChange(classId, v)}
              testId={`${testId}-${classId}`}
            />
          </div>
        </Group>
      ))}
      {adding !== null ? (
        <Group gap={4} wrap="nowrap" align="center">
          <Badge size="sm" variant="light" color="grape" style={{ flexShrink: 0 }}>
            {adding}
          </Badge>
          <div style={{ flex: 1 }}>
            <ValueSelect
              value={null}
              allowed={options[adding] ?? []}
              placeholder={`Value in ${adding}`}
              onChange={(v) => {
                if (v) onChange(adding, v);
                setAdding(null);
              }}
              testId={`${testId}-new-value`}
            />
          </div>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Cancel" onClick={() => setAdding(null)}>
            ×
          </ActionIcon>
        </Group>
      ) : (
        feature.classIds.length > 1 &&
        free.length > 0 && (
          <Select
            data={free.map((c) => ({ value: c, label: classLabels[c] ? `${c} - ${classLabels[c]}` : c }))}
            value={null}
            onChange={setAdding}
            placeholder="+ class value"
            searchable
            size="xs"
            variant="unstyled"
            comboboxProps={{ withinPortal: true }}
            data-testid={`${testId}-add`}
          />
        )
      )}
    </>
  );
}

/** For features where ETIM lists no allowed values: a value id typed by hand, stored once it looks like `EV000072`. */
function FreeValueInput({ value, onChange, testId }: { value: string | null; onChange: (v: string | null) => void; testId: string }) {
  const [draft, setDraft] = useState(value ?? '');
  const normalized = draft.trim().toUpperCase();
  const error = normalized !== '' && !VALUE_ID.test(normalized) ? 'Use a value id like EV000072' : undefined;
  return (
    <TextInput
      size="xs"
      placeholder="EV000000"
      value={draft}
      error={error}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => {
        if (normalized === '') onChange(null);
        else if (!error) {
          setDraft(normalized);
          onChange(normalized);
        }
      }}
      data-testid={testId}
    />
  );
}
