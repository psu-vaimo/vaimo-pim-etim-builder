import {
  attributeCode,
  effectiveRange,
  generateAttributes,
  generateRules,
  labelFor,
  type EtimRelease,
  type GenerateIssue,
  type Project,
  type SourceMapping,
} from '@akeneo-etim/core';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Paper,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDeferredValue, useMemo, useState } from 'react';
import { ATTRIBUTE_TYPE_LABELS, ETIM_TYPE_LABELS, RANGE_LABELS } from '../../features/featureRows.js';
import {
  emptyDraft,
  formatAction,
  hasDraftErrors,
  issuesFor,
  moveItem,
  ruleConditions,
  toDrafts,
  validateDrafts,
  type MappingRow,
  type SourceDraft,
} from '../../mapping/sourceMappings.js';
import { normalizeSources, withSources } from '@akeneo-etim/core';

const MONO_INPUT = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } };

interface Props {
  row: MappingRow | undefined;
  release: EtimRelease;
  project: Project;
  locale: string | undefined;
  onClose: () => void;
  onSave: (row: MappingRow, sources: SourceMapping[]) => void;
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
    case 'A':
      return (
        <Text size="sm">
          The source must be a reference entity attribute whose records have the attributes {mono(codes.sourceValueAttribute)}{' '}
          (the ETIM value code, for example EV000072) and {mono(codes.sourceLabelAttribute)} (the value label). Once mapped,{' '}
          {mono(code)} becomes a read only text attribute holding the ETIM value code, and {mono(code + codes.labelSuffix)} holds
          the value label.
        </Text>
      );
    case 'N':
      return <Text size="sm">The source value is copied to {mono(code)}, which becomes read only.</Text>;
    case 'L':
      return (
        <Text size="sm">
          With yes values, {mono(code)} is set to true when the source is one of them and to false for any other value. An empty
          source leaves it empty. Without yes values the source must be a Yes/No attribute and is copied.
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

function EditorBody({ row, release, project, locale, onClose, onSave }: Omit<Props, 'row'> & { row: MappingRow }) {
  const [drafts, setDrafts] = useState<SourceDraft[]>(() => {
    const initial = toDrafts(row.sources);
    return initial.length > 0 ? initial : [emptyDraft()];
  });
  const errors = useMemo(() => validateDrafts(drafts, row.type), [drafts, row.type]);
  const normalized = useMemo(() => normalizeSources(drafts, row.type), [drafts, row.type]);
  const deferred = useDeferredValue(normalized);
  const dirty = JSON.stringify(normalized) !== JSON.stringify(row.sources);

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
      rules: ruled.rules.filter((r) => r.origin.key === row.key),
      issues: [...issuesFor(generated.issues, row.key), ...issuesFor(ruled.issues, row.key)],
    };
  }, [release, project, row, deferred]);

  const update = (index: number, patch: Partial<SourceDraft>) =>
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  return (
    <Stack gap="md" data-testid={`editor-${row.key}`}>
      <Group gap="xs">
        <Badge variant="light" color="gray">
          {row.type} {ETIM_TYPE_LABELS[row.type]}
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

      <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-light)">
        <TypeHelp row={row} project={project} />
      </Paper>

      <Stack gap="xs">
        <Title order={5}>Source attributes</Title>
        <Text size="sm" c="dimmed">
          Customer attribute codes in preference order. Akeneo runs higher priority rules first and later rules overwrite, so the
          first source gets the lowest priority and wins whenever it is not empty.
        </Text>
        {drafts.map((d, i) => (
          <Paper key={i} withBorder p="sm" radius="md" data-testid={`source-${i}`}>
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <Stack gap={2} mt={28} w={72} align="center" style={{ flexShrink: 0 }}>
                <Badge variant={i === 0 ? 'filled' : 'light'} circle size="lg">
                  {i + 1}
                </Badge>
                {i === 0 && drafts.length > 1 && (
                  <Text size="xs" c="dimmed">
                    Preferred
                  </Text>
                )}
              </Stack>
              <Stack gap="xs" style={{ flex: 1 }}>
                <TextInput
                  label={row.type === 'R' ? 'Source attribute (first value)' : 'Source attribute'}
                  placeholder="att_code"
                  value={d.attribute}
                  error={errors[i]?.attribute}
                  onChange={(e) => update(i, { attribute: e.currentTarget.value })}
                  styles={MONO_INPUT}
                  data-testid={`source-attribute-${i}`}
                />
                {row.type === 'R' && (
                  <TextInput
                    label="Second source (optional)"
                    placeholder="att_code"
                    value={d.second}
                    error={errors[i]?.second}
                    onChange={(e) => update(i, { second: e.currentTarget.value })}
                    styles={MONO_INPUT}
                    data-testid={`source-second-${i}`}
                  />
                )}
                {row.type === 'L' && (
                  <TagsInput
                    label="Yes values (optional)"
                    description="Source values meaning yes, press Enter after each"
                    placeholder="yes"
                    value={d.yesValues}
                    onChange={(yesValues) => update(i, { yesValues })}
                    acceptValueOnBlur
                    clearable
                    data-testid={`source-yes-${i}`}
                  />
                )}
              </Stack>
              <Group gap={4} mt={26} wrap="nowrap">
                <Tooltip label="Move up">
                  <ActionIcon
                    variant="default"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => setDrafts((list) => moveItem(list, i, i - 1))}
                    data-testid={`source-up-${i}`}
                  >
                    ↑
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Move down">
                  <ActionIcon
                    variant="default"
                    aria-label="Move down"
                    disabled={i === drafts.length - 1}
                    onClick={() => setDrafts((list) => moveItem(list, i, i + 1))}
                    data-testid={`source-down-${i}`}
                  >
                    ↓
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Remove source">
                  <ActionIcon
                    variant="default"
                    color="red"
                    aria-label="Remove source"
                    onClick={() => setDrafts((list) => list.filter((_, j) => j !== i))}
                    data-testid={`source-remove-${i}`}
                  >
                    ×
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>
        ))}
        {drafts.length === 0 && (
          <Text size="sm" c="dimmed">
            No sources, the feature stays unmapped.
          </Text>
        )}
        <Group>
          <Button variant="light" size="xs" onClick={() => setDrafts((list) => [...list, emptyDraft()])} data-testid="source-add">
            Add source
          </Button>
        </Group>
      </Stack>

      <Group justify="space-between">
        <Group gap="xs">
          <Button onClick={() => onSave(row, normalized)} disabled={hasDraftErrors(errors) || !dirty} data-testid="source-save">
            Save
          </Button>
          <Button variant="default" onClick={onClose} data-testid="source-cancel">
            Cancel
          </Button>
        </Group>
        {row.sources.length > 0 && (
          <Button variant="subtle" color="red" onClick={() => onSave(row, [])} data-testid="source-unmap">
            Remove mapping
          </Button>
        )}
      </Group>

      <Divider label="Preview" labelPosition="left" />

      <IssueAlerts issues={preview.issues} />

      <Stack gap="xs" data-testid="preview-attributes">
        <Title order={5}>Attributes</Title>
        {preview.attributes.map((a) => (
          <Paper key={a.code} withBorder p="xs" radius="md">
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
          <Paper key={r.code} withBorder p="xs" radius="md" data-testid={`preview-rule-${r.code}`}>
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
