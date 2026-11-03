import {
  collectSourceEntities,
  featureRecordAttributes,
  isRecordValueSkipped,
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
import { ActionIcon, Alert, Badge, Button, Group, Pagination, Paper, ScrollArea, Select, Stack, Table, Text, TextInput, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { memo, useDeferredValue, useMemo, useState } from 'react';
import { codeError } from '../mapping/sourceMappings.js';
import type { Dispatch } from 'react';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { displayLocale, type AppAction } from '../state/appState.js';
import { ACTION_INPUT, DEFAULT_VALUE_INPUT, TEXT_COLORS } from '../theme.js';
import { CodeList } from '../components/CodeList.js';
import { exceptionsText, filledText, isComplete, providesText, recordsText } from '../format/sourceEntityText.js';
import { sourceEntitySummaries, type SourceEntityFeatureSummary } from '../review/reviewRows.js';

type AppDispatch = Dispatch<AppAction>;

const PAGE_SIZE = 25;
const VALUE_ID = /^EV\d{6}$/;

/** Maps the records of the client reference entities that provide A features to ETIM values. */
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
        A reference entity provides the A features mapped from its client attributes: the selected record provides the ETIM
        value. Map each record to an ETIM value per feature it provides. The export writes one record import file per reference entity, filling the record attributes{' '}
        {sourceRecordAttribute(project, 'EF000139')} (value code) and {sourceRecordAttribute(project, 'EF000139')}
        {project.settings.codes.labelSuffix} (value label). When a record needs another value in one class, add a class value: the
        feature then gets the record attributes {sourceRecordAttribute(project, 'EF000139')}_ec000009 and its label, and a rule that only
        runs for that class. Click a reference entity to open it.
      </Text>
      {collected.entities.length === 0 && (
        <Alert color="gray" data-testid="records-empty">
          No reference entity provides an A feature yet. Map A features in step 4, Mapping: Feature to Source attribute, and set the reference entity of their
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

/** Values filled for a feature and the classes its records make exceptions in, under the feature's column header. */
function FeatureCounts({ feature, records, classLabels }: { feature: SourceEntityFeatureSummary; records: number; classLabels: Record<string, string> }) {
  return (
    <>
      <Text size="xs" c={isComplete(feature, records) ? TEXT_COLORS.ok : TEXT_COLORS.warning} data-testid={`feature-filled-${feature.featureId}`}>
        {filledText(feature, records)}
      </Text>
      {feature.exceptionClasses.length > 0 && (
        <Tooltip label={feature.exceptionClasses.map((c) => (classLabels[c] ? `${c} - ${classLabels[c]}` : c)).join(', ')} multiline maw={360}>
          <Text size="xs" c={TEXT_COLORS.accent} data-testid={`feature-exceptions-${feature.featureId}`}>
            {exceptionsText(feature).replace(/^c/, 'C')}
          </Text>
        </Tooltip>
      )}
    </>
  );
}

interface PanelProps {
  plan: SourceEntityPlan;
  release: EtimRelease;
  project: Project;
  locale: string | undefined;
  dispatch: AppDispatch;
}

/** Class pill on a class value: code and description, as written, cut off when long (the tooltip has all of it). */
const CLASS_PILL = { tt: 'none', maw: '40%', style: { flexShrink: 0 } } as const;

/**
 * One reference entity, collapsed by default: the header with the client attributes using it, its records and the
 * features it provides, opened to upload, add and map records. Each feature column shows its values filled and class exceptions.
 */
const EntityPanel = memo(function EntityPanel({ plan, release, project, locale, dispatch }: PanelProps) {
  const [open, setOpen] = useState(false);
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

  const summary = useMemo(() => sourceEntitySummaries(release, project, [plan], locale)[0]!, [release, project, plan, locale]);
  const newCodeTrimmed = newCode.trim();
  const newCodeError =
    codeError(newCodeTrimmed) ?? (plan.records.some((r) => r.code === newCodeTrimmed) ? `${newCodeTrimmed} already exists` : undefined);
  const recordAttributes = plan.features.flatMap((f) => featureRecordAttributes(project, f));

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
        <UnstyledButton onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`entity-toggle-${plan.code}`}>
          <Group gap="xs">
            <Text c="dimmed" w={14} aria-hidden>
              {open ? '▾' : '▸'}
            </Text>
            <Title order={4} ff="monospace">
              {plan.code}
            </Title>
            <Badge variant="light" color="gray" tt="none" data-testid="entity-used-by">
              used by {plan.attributes.join(', ')}
            </Badge>
            <Badge variant="light" color={plan.records.length === 0 ? 'orange' : 'blue'} tt="none" data-testid="entity-records">
              {recordsText(plan.records.length)}
            </Badge>
            <Badge
              variant="light"
              color={summary.features.every((f) => isComplete(f, plan.records.length)) ? 'teal' : 'orange'}
              tt="none"
              data-testid="entity-provides"
            >
              {providesText(plan.features.length)}
            </Badge>
          </Group>
        </UnstyledButton>
        {open && (
          <>
            <div>
              <Text size="sm" c="dimmed">
                Needs the text attributes (not localizable, not scopable):
              </Text>
              <CodeList items={recordAttributes} labelSuffix={project.settings.codes.labelSuffix} mt={2} testId={`entity-attributes-${plan.code}`} />
            </div>

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
                        {plan.features.map((f, i) => (
                          <Table.Th key={f.featureId} miw={240}>
                            <Text size="sm" fw={600} ff="monospace">
                              {f.featureId}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {labelFor(release.features[f.featureId]?.labels ?? {}, locale)}
                            </Text>
                            <FeatureCounts feature={summary.features[i]!} records={plan.records.length} classLabels={classLabels} />
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
            <Group gap={4} wrap="nowrap" align="center">
              <div style={{ flex: 1 }}>
                <ValueSelect
                  value={record.values[f.featureId] ?? null}
                  allowed={options[i]?.all ?? []}
                  placeholder={isRecordValueSkipped(record, f.featureId) ? 'Skipped, no ETIM value' : 'Not mapped'}
                  placeholderIsDefault
                  onChange={(v) => setValue(f.featureId, undefined, v)}
                  testId={`value-${record.code}-${f.featureId}`}
                />
              </div>
              {!record.values[f.featureId] && (
                <SkipButton
                  skipped={isRecordValueSkipped(record, f.featureId)}
                  onChange={(skipped) =>
                    dispatch({ type: 'setSourceRecordSkipped', entity: plan.code, code: record.code, featureId: f.featureId, skipped })
                  }
                  testId={`skip-${record.code}-${f.featureId}`}
                />
              )}
            </Group>
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

/** Skips a record value on purpose (no ETIM value, done for the to do), or takes the skip back. */
function SkipButton({ skipped, onChange, testId }: { skipped: boolean; onChange: (skipped: boolean) => void; testId: string }) {
  return (
    <Tooltip label={skipped ? 'Back to not mapped' : 'No ETIM value on purpose, the record attribute stays empty'}>
      <Button size="compact-xs" variant="subtle" color="gray" onClick={() => onChange(!skipped)} style={{ flexShrink: 0 }} data-testid={testId}>
        {skipped ? 'Unskip' : 'Skip'}
      </Button>
    </Tooltip>
  );
}

interface ValueSelectProps {
  value: string | null;
  allowed: Option[];
  placeholder: string;
  /** The placeholder names what an empty value means, shown like a value. */
  placeholderIsDefault?: boolean;
  onChange: (v: string | null) => void;
  testId: string;
}

/** An ETIM value from the allowed list, or typed by hand when ETIM lists none. A value outside the list is shown as an error. */
function ValueSelect({ value, allowed, placeholder, placeholderIsDefault, onChange, testId }: ValueSelectProps) {
  if (allowed.length === 0) return <FreeValueInput value={value} onChange={onChange} testId={testId} />;
  const data = value && !allowed.some((o) => o.value === value) ? [...allowed, { value, label: `${value} (not allowed by ETIM)` }] : allowed;
  return (
    <Select
      data={data}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...(placeholderIsDefault ? { classNames: { input: DEFAULT_VALUE_INPUT } } : {})}
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
  const classText = (classId: string) => (classLabels[classId] ? `${classId} - ${classLabels[classId]}` : classId);
  return (
    <>
      {current.map(({ classId, valueId }) => (
        <Group key={classId} gap={4} wrap="nowrap" align="center">
          <Tooltip label={feature.classIds.includes(classId) ? classLabels[classId] || classId : `${classId} is not a selected class using ${featureId}, ignored`}>
            <Badge size="sm" variant="light" color={feature.classIds.includes(classId) ? 'grape' : 'red'} {...CLASS_PILL}>
              {classText(classId)}
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
          <Badge size="sm" variant="light" color="grape" {...CLASS_PILL}>
            {classText(adding)}
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
            classNames={{ input: ACTION_INPUT }}
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
