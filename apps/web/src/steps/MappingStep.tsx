import { collectProjectFeatures, createProject, generateAttributes, generateRules, type FeatureKey } from '@akeneo-etim/core';
import { Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { GenerateIssues } from '../components/features/GenerateIssues.js';
import { MappingTable } from '../components/mapping/MappingTable.js';
import { SourceEditor } from '../components/mapping/SourceEditor.js';
import { featureRows } from '../features/featureRows.js';
import { mappingRows, orphanMappings } from '../mapping/sourceMappings.js';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { displayLocale } from '../state/appState.js';

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} data-testid={testId}>
        {value.toLocaleString('en-US')}
      </Text>
    </Paper>
  );
}

export function MappingStep() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { release, project } = state;
  const locale = displayLocale(state);
  const [editing, setEditing] = useState<FeatureKey | undefined>();

  const { classIds } = project;
  const collected = useMemo(
    () => (release ? collectProjectFeatures(release, { ...createProject(''), classIds }) : undefined),
    [release, classIds],
  );
  const generated = useMemo(() => {
    if (!release) return undefined;
    const attrs = generateAttributes(release, project);
    const rules = generateRules(release, project, attrs.attributes);
    return { attributes: attrs.attributes, rules: rules.rules, issues: [...attrs.issues, ...rules.issues] };
  }, [release, project]);
  const rows = useMemo(
    () =>
      release && collected && generated
        ? mappingRows(featureRows(release, collected.features, generated.attributes, locale), collected.features, project.features)
        : [],
    [release, collected, generated, locale, project.features],
  );
  const errorKeys = useMemo(
    () => new Set((generated?.issues ?? []).filter((i) => i.severity === 'error').flatMap((i) => (i.featureKey ? [i.featureKey] : []))),
    [generated],
  );
  const orphans = useMemo(() => (collected ? orphanMappings(collected.features, project.features) : []), [collected, project.features]);
  const onEdit = useCallback((key: FeatureKey) => setEditing(key), []);

  if (!release || !collected || !generated) return <Text mt="md">Import an ETIM export first.</Text>;

  const mapped = rows.filter((r) => r.sources.length > 0).length;
  const editingRow = editing === undefined ? undefined : rows.find((r) => r.key === editing);

  return (
    <Stack gap="lg" mt="md">
      <Text size="sm" c="dimmed">
        Enter the existing customer attributes that feed each ETIM feature. Mapped features become read only and are filled by
        Akeneo rules. Unmapped features are enriched by hand.
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Stat label="Features" value={rows.length} testId="stat-features" />
        <Stat label="Mapped" value={mapped} testId="stat-mapped" />
        <Stat label="Unmapped" value={rows.length - mapped} testId="stat-unmapped" />
        <Stat label="Rules" value={generated.rules.length} testId="stat-rules" />
      </SimpleGrid>

      <GenerateIssues issues={generated.issues} />

      {orphans.length > 0 && (
        <Text size="sm" c="dimmed" data-testid="orphan-mappings">
          {orphans.length === 1 ? '1 mapped feature is' : `${orphans.length} mapped features are`} not used by the selected classes,
          the mapping is kept in the project: {orphans.join(', ')}
        </Text>
      )}

      <Stack gap="sm">
        <Title order={4}>Features</Title>
        <MappingTable rows={rows} locale={locale} errorKeys={errorKeys} onEdit={onEdit} />
      </Stack>

      <SourceEditor
        row={editingRow}
        release={release}
        project={project}
        locale={locale}
        onClose={() => setEditing(undefined)}
        onSave={(row, sources) => {
          dispatch({ type: 'setFeatureSources', key: row.key, featureType: row.type, sources });
          setEditing(undefined);
        }}
      />
    </Stack>
  );
}
