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
import { ActionIcon, Alert, Badge, Button, Group, Pagination, Paper, Popover, ScrollArea, Select, Stack, Table, Text, TextInput, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { Fragment, memo, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { codeError } from '../mapping/sourceMappings.js';
import type { Dispatch } from 'react';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { displayLocale, type AppAction } from '../state/appState.js';
import { DEFAULT_VALUE_INPUT, TEXT_COLORS } from '../theme.js';
import { RecordAttributeTable } from '../components/RecordAttributeTable.js';
import { exceptionsText, filledText, isComplete, providesText, recordsText } from '../format/sourceEntityText.js';
import { sourceEntitySummaries, type SourceEntityFeatureSummary } from '../review/reviewRows.js';
import { LogicalSources } from './LogicalSources.js';
import { SubStep } from '../components/SubStep.js';
import { GenerateIssues } from '../components/features/GenerateIssues.js';
import { ToggleIcon } from '../components/ToggleIcon.js';
import { SUB_STEPS } from '../workspace/sections.js';

type AppDispatch = Dispatch<AppAction>;

const PAGE_SIZE = 25;
const VALUE_ID = /^EV\d{6}$/;

/**
 * Maps the records of the client reference entities that provide A features to ETIM values, and the values of the
 * client attributes that provide L features to yes or no.
 */
export function RecordsStep() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { release, project } = state;
  const locale = displayLocale(state);
  const collected = useMemo(() => (release ? collectSourceEntities(release, project) : undefined), [release, project]);

  if (!release || !collected) return <Text mt="md">Import an ETIM export first.</Text>;

  return (
    <Stack gap="lg" mt="md">
      <SubStep
        step={SUB_STEPS.records}
        description={
          <>
            A reference entity provides the A features mapped from its client attributes: the selected record provides the ETIM
            value. Map each record to an ETIM value per feature it provides. The export writes one record import file per reference entity, filling the record attributes{' '}
            {sourceRecordAttribute(project, 'EF000139')} (value code) and {sourceRecordAttribute(project, 'EF000139')}
            {project.settings.codes.labelSuffix} (value label). When a record needs another value in one class, add a class value: the
            feature then gets the record attributes {sourceRecordAttribute(project, 'EF000139')}_ec000009 and its label, and a rule that only
            runs for that class. Click a reference entity to open it.
          </>
        }
        testId="sub-step-records"
      >
        {collected.entities.length === 0 && (
          <Alert color="gray" data-testid="records-empty">
            No reference entity provides an A feature yet. Map A features in step 4.2, Map features, and set the reference entity of their
            source attribute (or upload the Akeneo attribute export in step 4.1, which has it).
          </Alert>
        )}
        <GenerateIssues issues={collected.issues.filter((i) => i.featureKey !== undefined)} />
        {collected.entities.map((plan) => (
          <EntityPanel key={plan.code} plan={plan} release={release} project={project} locale={locale} dispatch={dispatch} />
        ))}
      </SubStep>
      <LogicalSources release={release} project={project} locale={locale} dispatch={dispatch} />
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
    <Paper withBorder p="md" data-testid={`entity-${plan.code}`}>
      <Stack gap="sm">
        <UnstyledButton className="toggle-trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`entity-toggle-${plan.code}`}>
          <Group gap="sm">
            <ToggleIcon open={open} />
            <Title order={4} ff="monospace">
              {plan.code}
            </Title>
            <Badge variant="light" color="gray" data-testid="entity-attributes">
              {plan.attributes.join(', ')}
            </Badge>
            <Badge variant="light" color={plan.records.length === 0 ? 'orange' : 'blue'} data-testid="entity-records">
              {recordsText(plan.records.length)}
            </Badge>
            <Badge
              variant="light"
              color={summary.features.every((f) => isComplete(f, plan.records.length)) ? 'teal' : 'orange'}
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
              <RecordAttributeTable codes={recordAttributes} labelSuffix={project.settings.codes.labelSuffix} testId={`entity-attributes-${plan.code}`} />
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
                  {/* Not stretched to the full width: each feature column is about 600px, at least 320px. */}
                  <Table withTableBorder verticalSpacing={4} w="auto" data-testid="records-table">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th miw={180}>Record</Table.Th>
                        {plan.features.map((f, i) => (
                          <Table.Th key={f.featureId} w={600} miw={320}>
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
  const open = plan.features.filter((f) => !record.values[f.featureId]).map((f) => f.featureId);
  // The whole record is skipped when every feature without a value is skipped. With one open value the cell's own Skip does the same.
  const recordSkipped = open.length > 0 && open.every((id) => isRecordValueSkipped(record, id));
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
          <FeatureValues
            record={record}
            feature={f}
            allowed={options[i]?.all ?? []}
            byClass={options[i]?.byClass ?? {}}
            classLabels={classLabels}
            onChange={(classId, v) => setValue(f.featureId, classId, v)}
            skip={
              record.values[f.featureId] ? null : (
                <SkipButton
                  skipped={isRecordValueSkipped(record, f.featureId)}
                  onChange={(skipped) =>
                    dispatch({ type: 'setSourceRecordSkipped', entity: plan.code, code: record.code, featureId: f.featureId, skipped })
                  }
                  testId={`skip-${record.code}-${f.featureId}`}
                />
              )
            }
          />
        </Table.Td>
      ))}
      <Table.Td style={{ verticalAlign: 'top' }}>
        <Group gap={4} wrap="nowrap">
          {open.length > 1 && (
            <Tooltip label={recordSkipped ? 'Back to not mapped' : 'Skip every value of this record without an ETIM value, its record attributes stay empty'}>
              <Button
                size="compact-xs"
                variant="default"
                onClick={() => dispatch({ type: 'setSourceRecordSkippedAll', entity: plan.code, code: record.code, featureIds: open, skipped: !recordSkipped })}
                data-testid={`record-skip-${record.code}`}
              >
                {recordSkipped ? 'Unskip record' : 'Skip record'}
              </Button>
            </Tooltip>
          )}
          <RemoveRecordButton
            record={record}
            onConfirm={() => dispatch({ type: 'removeSourceRecord', entity: plan.code, code: record.code })}
          />
        </Group>
      </Table.Td>
    </Table.Tr>
  );
});

/** The × of a record row, asks before removing the record since its ETIM values go with it. */
function RemoveRecordButton({ record, onConfirm }: { record: SourceRecord; onConfirm: () => void }) {
  const [opened, setOpened] = useState(false);
  const values = Object.keys(record.values).length + Object.values(record.classValues ?? {}).reduce((n, v) => n + Object.keys(v).length, 0);
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md" trapFocus>
      <Popover.Target>
        <Tooltip label="Remove record" disabled={opened}>
          <ActionIcon variant="default" aria-label="Remove record" onClick={() => setOpened((o) => !o)} data-testid={`record-remove-${record.code}`}>
            ×
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown maw={300}>
        <Stack gap="xs">
          <Text size="sm">
            Remove record{' '}
            <Text span inherit ff="monospace">
              {record.code}
            </Text>
            ?{' '}
            {values === 0 ? 'It has no ETIM values yet.' : `Its ${values === 1 ? 'ETIM value is' : `${values} ETIM values are`} lost.`} The
            record stays in Akeneo, it is only left out of the export.
          </Text>
          <Group gap="xs" justify="flex-end">
            <Button size="xs" variant="default" onClick={() => setOpened(false)} data-testid="record-remove-cancel">
              Cancel
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => {
                setOpened(false);
                onConfirm();
              }}
              data-testid="record-remove-confirm"
            >
              Remove
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** Skips a record value on purpose (no ETIM value, done for the to do), or takes the skip back. */
function SkipButton({ skipped, onChange, testId }: { skipped: boolean; onChange: (skipped: boolean) => void; testId: string }) {
  return (
    <Tooltip label={skipped ? 'Back to not mapped' : 'No ETIM value on purpose, the record attribute stays empty'}>
      <Button size="compact-xs" variant="default" onClick={() => onChange(!skipped)} style={{ flexShrink: 0 }} data-testid={testId}>
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

interface FeatureValuesProps {
  record: SourceRecord;
  feature: SourceEntityFeature;
  /** Allowed values over all selected classes, and per class. */
  allowed: Option[];
  byClass: Record<string, Option[]>;
  classLabels: Record<string, string>;
  /** `classId` undefined for the default value. */
  onChange: (classId: string | undefined, valueId: string | null) => void;
  /** Skip button next to the default value, `null` when it has a value. */
  skip: ReactNode;
}

/**
 * The ETIM value of one record for one feature. Without class exceptions the default value takes the full width. With
 * exceptions every value gets a label in front, Default first, then one row per class. Add exception picks a class.
 */
function FeatureValues({ record, feature, allowed, byClass, classLabels, onChange, skip }: FeatureValuesProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const { featureId } = feature;
  const current = Object.entries(record.classValues ?? {})
    .flatMap(([classId, values]) => (values[featureId] ? [{ classId, valueId: values[featureId] }] : []))
    .sort((a, b) => (a.classId < b.classId ? -1 : 1));
  const free = feature.classIds.filter((c) => !current.some((e) => e.classId === c));
  const testId = `class-values-${record.code}-${featureId}`;
  const classText = (classId: string) => (classLabels[classId] ? `${classId} - ${classLabels[classId]}` : classId);
  const withExceptions = current.length > 0 || adding !== null;

  const defaultValue = (
    <Group gap={4} wrap="nowrap" align="center">
      <div style={{ flex: 1, minWidth: 0 }}>
        <ValueSelect
          value={record.values[featureId] ?? null}
          allowed={allowed}
          placeholder={isRecordValueSkipped(record, featureId) ? 'Skipped, no ETIM value' : 'Not mapped'}
          placeholderIsDefault
          onChange={(v) => onChange(undefined, v)}
          testId={`value-${record.code}-${featureId}`}
        />
      </div>
      {skip}
    </Group>
  );
  const addException =
    adding === null && feature.classIds.length > 1 && free.length > 0 ? (
      <Select
        data={free.map((c) => ({ value: c, label: classText(c) }))}
        value={null}
        onChange={setAdding}
        placeholder="Add exception"
        searchable
        size="xs"
        comboboxProps={{ withinPortal: true, width: 'max-content' }}
        data-testid={`${testId}-add`}
      />
    ) : null;

  if (!withExceptions) {
    return (
      <Stack gap={4}>
        {defaultValue}
        {addException && (
          <div className="value-grid">
            {addException}
          </div>
        )}
      </Stack>
    );
  }

  return (
    <div className="value-grid">
      <ValueLabel text="Default" fw={500} />
      {defaultValue}
      {current.map(({ classId, valueId }) => {
        const used = feature.classIds.includes(classId);
        return (
          <Fragment key={classId}>
            <ValueLabel
              text={classText(classId)}
              tooltip={used ? classText(classId) : `${classId} is not a selected class using ${featureId}, ignored`}
              color={used ? TEXT_COLORS.accent : TEXT_COLORS.error}
            />
            <ValueSelect
              value={valueId}
              allowed={byClass[classId] ?? []}
              placeholder="Remove exception"
              onChange={(v) => onChange(classId, v)}
              testId={`${testId}-${classId}`}
            />
          </Fragment>
        );
      })}
      {adding !== null && (
        <>
          <ValueLabel text={classText(adding)} tooltip={classText(adding)} color={TEXT_COLORS.accent} />
          <Group gap={4} wrap="nowrap" align="center">
            <div style={{ flex: 1, minWidth: 0 }}>
              <ValueSelect
                value={null}
                allowed={byClass[adding] ?? []}
                placeholder={`Value in ${adding}`}
                onChange={(v) => {
                  if (v) onChange(adding, v);
                  setAdding(null);
                }}
                testId={`${testId}-new-value`}
              />
            </div>
            <ActionIcon size="sm" variant="default" aria-label="Cancel" onClick={() => setAdding(null)}>
              ×
            </ActionIcon>
          </Group>
        </>
      )}
      {addException}
    </div>
  );
}

/**
 * Label in front of a value when a record value has class exceptions, cut off when long: Default slightly heavier, the
 * classes in the accent color (red when ignored).
 */
function ValueLabel({ text, tooltip, color, fw }: { text: string; tooltip?: string; color?: string; fw?: number }) {
  const label = (
    <Text size="sm" truncate="end" {...(color ? { c: color } : {})} {...(fw ? { fw } : {})}>
      {text}
    </Text>
  );
  return tooltip ? (
    <Tooltip label={tooltip} multiline maw={360}>
      {label}
    </Tooltip>
  ) : (
    label
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
