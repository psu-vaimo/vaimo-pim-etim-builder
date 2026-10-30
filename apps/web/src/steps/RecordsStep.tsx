import {
  collectSourceEntities,
  labelFor,
  parseAkeneoRecordExport,
  sourceRecordAttribute,
  type EtimRelease,
  type GenerateIssue,
  type Project,
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
        {project.settings.codes.labelSuffix} (value label).
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

  const options = useMemo(
    () =>
      plan.features.map((f) =>
        f.valueIds.map((id) => ({ value: id, label: `${id} - ${labelFor(release.values[id]?.labels ?? {}, locale)}` })),
      ),
    [plan.features, release, locale],
  );
  const filtered = useMemo(() => {
    const words = deferredSearch.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return plan.records;
    return plan.records.filter((r) => {
      const text = [r.code, ...Object.values(r.labels), ...Object.values(r.values)].join('\n').toLowerCase();
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
  const recordAttributes = plan.features.flatMap((f) => {
    const code = sourceRecordAttribute(project, f.featureId);
    return [code, code + codes.labelSuffix];
  });

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
                      </Table.Th>
                    ))}
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((record) => (
                    <RecordRow key={record.code} record={record} plan={plan} options={options} locale={locale} dispatch={dispatch} />
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

interface RowProps {
  record: SourceRecord;
  plan: SourceEntityPlan;
  /** Allowed values per feature, same order as `plan.features`. */
  options: { value: string; label: string }[][];
  locale: string | undefined;
  dispatch: AppDispatch;
}

const RecordRow = memo(function RecordRow({ record, plan, options, locale, dispatch }: RowProps) {
  const setValue = (featureId: string, valueId: string | null) =>
    dispatch({ type: 'setSourceRecordValue', entity: plan.code, code: record.code, featureId, valueId });
  return (
    <Table.Tr data-testid={`record-${record.code}`}>
      <Table.Td>
        <Text size="sm" ff="monospace">
          {record.code}
        </Text>
        <Text size="xs" c="dimmed">
          {labelFor(record.labels, locale)}
        </Text>
      </Table.Td>
      {plan.features.map((f, i) => {
        const value = record.values[f.featureId] ?? null;
        const allowed = options[i] ?? [];
        if (allowed.length === 0) {
          return (
            <Table.Td key={f.featureId}>
              <FreeValueInput value={value} onChange={(v) => setValue(f.featureId, v)} testId={`value-${record.code}-${f.featureId}`} />
            </Table.Td>
          );
        }
        const data = value && !allowed.some((o) => o.value === value) ? [...allowed, { value, label: `${value} (not allowed by ETIM)` }] : allowed;
        return (
          <Table.Td key={f.featureId}>
            <Select
              data={data}
              value={value}
              onChange={(v) => setValue(f.featureId, v)}
              placeholder="Not mapped"
              searchable
              clearable
              size="xs"
              error={value && data !== allowed ? true : undefined}
              comboboxProps={{ withinPortal: true }}
              data-testid={`value-${record.code}-${f.featureId}`}
            />
          </Table.Td>
        );
      })}
      <Table.Td>
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
