import {
  attributeCode,
  effectiveRange,
  sourceRecordAttribute,
  generateAttributes,
  generateRules,
  labelFor,
  type EtimRelease,
  type GenerateIssue,
  type Project,
  type SourceAttribute,
  type SourceMapping,
} from '@vaimo-pim-etim-builder/core';
import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ATTRIBUTE_TYPE_LABELS, ETIM_TYPE_LABELS, RANGE_LABELS } from '../../features/featureRows.js';
import {
  draftsDiffer,
  emptyDraft,
  formatAction,
  hasDraftErrors,
  codeError,
  issuesFor,
  ruleConditions,
  toDrafts,
  validateDrafts,
  type MappingRow,
  type SourceDraft,
} from '../../mapping/sourceMappings.js';
import { normalizeSources, withSources } from '@vaimo-pim-etim-builder/core';
import { KEEP_CASE } from '../../theme.js';

const MONO_INPUT = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } };

interface Props {
  row: MappingRow | undefined;
  release: EtimRelease;
  project: Project;
  locale: string | undefined;
  /** Asked to close, by the close button, Escape, the overlay or Cancel. The parent decides whether to ask about unsaved changes. */
  onClose: () => void;
  /** `entity` is the reference entity override for an A feature's source, `''` when none (the uploaded reference data name applies). */
  onSave: (row: MappingRow, sources: SourceMapping[], entity: string) => void;
  /** Called when the drafts start or stop differing from the saved sources, and with `false` when the editor closes. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Drawer to edit the sources of one feature, with a live preview of its attributes and rules. */
export function SourceEditor({ row, ...rest }: Props) {
  return (
    <Drawer
      opened={row !== undefined}
      onClose={rest.onClose}
      position="right"
      size="xl"
      title={row ? <Text fw={700} size="lg" span>{`${row.featureId} - ${row.label || 'No label'}`}</Text> : null}
      data-testid="source-editor"
    >
      {row && <EditorBody key={row.key} row={row} {...rest} />}
    </Drawer>
  );
}

function TypeHelp({ row, project }: { row: MappingRow; project: Project }) {
  const { codes } = project.settings;
  const code = attributeCode(project.settings, row.key);
  const mono = (s: string) => (
    <Text span ff="monospace" size="sm">
      {s}
    </Text>
  );
  switch (row.type) {
    case 'A': {
      const recordAttribute = sourceRecordAttribute(project, row.featureId);
      return (
        <Text size="sm">
          The source must be a reference entity attribute whose records have the attributes {mono(recordAttribute)} (the ETIM value
          code, for example EV000072) and {mono(recordAttribute + codes.labelSuffix)} (the value label). Once mapped, {mono(code)}{' '}
          becomes a read only text attribute holding the ETIM value code, and {mono(code + codes.labelSuffix)} holds the value label.
        </Text>
      );
    }
    case 'N':
      return <Text size="sm">The source value is copied to {mono(code)}, which becomes read only.</Text>;
    case 'L':
      return (
        <Text size="sm">
          A Yes/No source is copied to {mono(code)}. For another source, such as a simple select, pick the values meaning yes in step 5,
          Mapping: Source record to Value: {mono(code)} is then set to true when the source is one of them and to false for any other
          value. An empty source leaves it empty.
        </Text>
      );
    case 'R': {
      const range = effectiveRange(project, row.key);
      return range === 'text' ? (
        <Text size="sm">
          Range setup is {RANGE_LABELS[range].toLowerCase()}. With a second source the two values are joined as {mono('10-20')}{' '}
          into {mono(code)}, without it the first source is copied as is.
        </Text>
      ) : (
        <Text size="sm">
          Range setup is {RANGE_LABELS[range].toLowerCase()}. The first source fills {mono(`${code}_min`)} and the second source
          fills {mono(`${code}_max`)}. Without a second source the same source fills both.
        </Text>
      );
    }
  }
}

function IssueAlerts({ issues }: { issues: readonly GenerateIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <Stack gap={4} data-testid="editor-issues">
      {issues.map((issue, i) => (
        <Alert key={i} color={issue.severity === 'error' ? 'red' : 'yellow'} p="xs">
          <Text size="sm">{issue.message}</Text>
        </Alert>
      ))}
    </Stack>
  );
}

function EditorBody({ row, release, project, locale, onClose, onSave, onDirtyChange }: Omit<Props, 'row'> & { row: MappingRow }) {
  const [drafts, setDrafts] = useState<SourceDraft[]>(() => {
    const initial = toDrafts(row.sources);
    return initial.length > 0 ? initial : [emptyDraft()];
  });
  const errors = useMemo(() => validateDrafts(drafts, row.type), [drafts, row.type]);
  const normalized = useMemo(() => normalizeSources(drafts, row.type), [drafts, row.type]);
  const deferred = useDeferredValue(normalized);
  // The link belongs to the source attribute (shared by its features), so it follows the attribute being typed until edited here.
  const linkFor = (attribute: string | undefined) => project.sourceEntityLinks?.[attribute ?? ''] ?? '';
  const currentLink = linkFor(normalized[0]?.attribute);
  const [entityEdit, setEntityEdit] = useState<string | undefined>();
  const entity = entityEdit ?? currentLink;
  const entityError = row.type === 'A' ? codeError(entity) : undefined;
  const dirty = useMemo(
    () => draftsDiffer(drafts, row.sources, row.type) || (row.type === 'A' && entity.trim() !== currentLink),
    [drafts, row.sources, row.type, entity, currentLink],
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Only the first class using the feature is needed: attributes and rules are per feature, not per class.
  const preview = useMemo(() => {
    const p: Project = {
      ...project,
      classIds: row.firstClassId ? [row.firstClassId] : [],
      features: { ...project.features, [row.key]: withSources(project.features[row.key], deferred) },
    };
    const generated = generateAttributes(release, p);
    const ruled = generateRules(release, p, generated.attributes);
    return {
      attributes: generated.attributes.filter((a) => a.origin.kind === 'feature' && a.origin.key === row.key),
      rules: ruled.rules.filter((r) => r.origin.keys.includes(row.key)),
      issues: [...issuesFor(generated.issues, row.key), ...issuesFor(ruled.issues, row.key)],
    };
  }, [release, project, row, deferred]);

  const update = (index: number, patch: Partial<SourceDraft>) =>
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  // Yes values are picked per source value on step 5, they belong to the saved attribute and go when another one is typed.
  const yesValuesFor = (attribute: string) => row.sources.find((s) => s.attribute === attribute.trim())?.yesValues ?? [];
  const known = useMemo(() => new Map((project.sourceAttributes ?? []).map((a) => [a.code, a])), [project.sourceAttributes]);
  const codes = useMemo(() => [...known.keys()], [known]);
  const sourceInput = (index: number, field: 'attribute' | 'second', label: string, value: string, error: string | undefined) => (
    <Autocomplete
      label={label}
      placeholder="att_code"
      description={known.size > 0 ? attributeHint(known.get(value.trim()), value.trim(), locale) : undefined}
      data={codes}
      limit={50}
      value={value}
      error={error}
      onChange={(v) => update(index, field === 'attribute' ? { attribute: v, yesValues: yesValuesFor(v) } : { second: v })}
      renderOption={({ option }) => <SourceOption code={option.value} attribute={known.get(option.value)} locale={locale} />}
      styles={MONO_INPUT}
      data-testid={`source-${field}-${index}`}
    />
  );

  return (
    <Stack gap="md" data-testid={`editor-${row.key}`}>
      <Group gap="xs">
        <Badge variant="light" color="gray" styles={KEEP_CASE}>
          {row.type} {ETIM_TYPE_LABELS[row.type].toLowerCase()}
        </Badge>
        {row.unitId && (
          <Badge variant="light" color="gray">
            Unit {row.unitLabel || row.unitId}
          </Badge>
        )}
        <Badge variant="light" color="gray">
          {row.classCount === 1 ? '1 class' : `${row.classCount} classes`}
        </Badge>
      </Group>

      <Paper withBorder p="sm" bg="var(--mantine-color-gray-light)">
        <TypeHelp row={row} project={project} />
      </Paper>

      <Stack gap="xs">
        <Title order={5}>Source attribute</Title>
        <Text size="sm" c="dimmed">
          The client (data model) attribute that provides this feature. One source per feature, a source can provide many
          features: its rule gets one copy action per feature.
          {known.size === 0 && ' Upload an Akeneo attribute export in Add Akeneo attributes on this step to pick from a list.'}
        </Text>
        {drafts.map((d, i) => (
          <Paper key={i} withBorder p="sm" data-testid={`source-${i}`}>
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <Stack gap="xs" style={{ flex: 1 }}>
                {sourceInput(i, 'attribute', row.type === 'R' ? 'Source attribute (first value)' : 'Source attribute', d.attribute, errors[i]?.attribute)}
                {row.type === 'R' && sourceInput(i, 'second', 'Second source (optional)', d.second, errors[i]?.second)}
                {row.type === 'A' && i === 0 && (
                  <TextInput
                    label="Reference entity"
                    description={
                      `Akeneo reference entity the source links to, shared by all features mapped from ${d.attribute.trim() || 'it'}. ` +
                      'Its records are mapped to ETIM values in step 5, Mapping: Source record to Value.'
                    }
                    placeholder={known.get(d.attribute.trim())?.referenceDataName ?? 'reference_entity_code'}
                    value={entity}
                    error={entityError}
                    onChange={(e) => setEntityEdit(e.currentTarget.value)}
                    styles={MONO_INPUT}
                    data-testid="source-entity"
                  />
                )}
              </Stack>
              <Tooltip label="Remove source">
                <ActionIcon
                  variant="default"
                  color="red"
                  aria-label="Remove source"
                  mt={26}
                  onClick={() => setDrafts((list) => list.filter((_, j) => j !== i))}
                  data-testid={`source-remove-${i}`}
                >
                  ×
                </ActionIcon>
              </Tooltip>
            </Group>
          </Paper>
        ))}
        {drafts.length === 0 && (
          <>
            <Text size="sm" c="dimmed">
              No source, the feature stays unmapped.
            </Text>
            <Group>
              <Button variant="light" size="xs" onClick={() => setDrafts([emptyDraft()])} data-testid="source-add">
                Add source
              </Button>
            </Group>
          </>
        )}
      </Stack>

      <Group justify="space-between">
        <Group gap="xs">
          <Button onClick={() => onSave(row, normalized, entity.trim())} disabled={hasDraftErrors(errors) || entityError !== undefined || !dirty} data-testid="source-save">
            Save
          </Button>
          <Button variant="default" onClick={onClose} data-testid="source-cancel">
            Cancel
          </Button>
        </Group>
        {row.sources.length > 0 && (
          <Button variant="light" color="red" onClick={() => onSave(row, [], '')} data-testid="source-unmap">
            Remove mapping
          </Button>
        )}
      </Group>

      <Divider label="Preview" labelPosition="left" />

      <IssueAlerts issues={preview.issues} />

      <Stack gap="xs" data-testid="preview-attributes">
        <Title order={5}>Attributes</Title>
        {preview.attributes.map((a) => (
          <Paper key={a.code} withBorder p="xs">
            <Group gap="xs">
              <Text ff="monospace" size="sm" fw={600}>
                {a.code}
              </Text>
              <Badge size="sm" variant="light">
                {ATTRIBUTE_TYPE_LABELS[a.type]}
              </Badge>
              {a.referenceDataName && (
                <Badge size="sm" variant="light" color="grape">
                  {a.referenceDataName}
                </Badge>
              )}
              <Badge size="sm" variant="light" color="gray">
                {a.group}
              </Badge>
              {a.readOnly && (
                <Badge size="sm" variant="light" color="orange">
                  Read only
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed" mt={2}>
              {labelFor(a.labels, locale) || 'No label'}
            </Text>
          </Paper>
        ))}
      </Stack>

      <Stack gap="xs" data-testid="preview-rules">
        <Title order={5}>Rules</Title>
        {preview.rules.length === 0 && (
          <Text size="sm" c="dimmed">
            No rules, the feature is unmapped or its sources have errors.
          </Text>
        )}
        {preview.rules.map((r) => (
          <Paper key={r.code} withBorder p="xs" data-testid={`preview-rule-${r.code}`}>
            <Group gap="xs">
              <Text ff="monospace" size="sm" fw={600}>
                {r.code}
              </Text>
              <Badge size="sm" variant="light" data-testid="rule-priority">
                Priority {r.priority}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" mt={2}>
              {labelFor(r.labels, locale)}
            </Text>
            <Text size="xs" fw={600} mt={6}>
              When
            </Text>
            {ruleConditions(r).map((c, i) => (
              <Text key={i} size="sm" ff="monospace">
                {c}
              </Text>
            ))}
            <Text size="xs" fw={600} mt={6}>
              Then
            </Text>
            {r.actions.map((a, i) => (
              <Text key={i} size="sm" ff="monospace" data-testid="rule-action">
                {formatAction(a)}
              </Text>
            ))}
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

/** Type and label of the picked source, or a note that it is not in the uploaded export. */
function attributeHint(attribute: SourceAttribute | undefined, code: string, locale: string | undefined): string | undefined {
  if (code === '') return undefined;
  if (!attribute) return 'Not in the uploaded Akeneo attributes';
  const label = labelFor(attribute.labels, locale);
  return [attribute.type, attribute.referenceDataName, label].filter(Boolean).join(', ');
}

function SourceOption({ code, attribute, locale }: { code: string; attribute: SourceAttribute | undefined; locale: string | undefined }) {
  return (
    <Stack gap={0}>
      <Text size="sm" ff="monospace">
        {code}
      </Text>
      {attribute && (
        <Text size="xs" c="dimmed">
          {[labelFor(attribute.labels, locale), attribute.type].filter(Boolean).join(' · ')}
        </Text>
      )}
    </Stack>
  );
}
