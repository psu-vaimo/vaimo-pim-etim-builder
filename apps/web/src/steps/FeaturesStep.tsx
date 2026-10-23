import {
  collectProjectFeatures,
  createProject,
  generateAttributes,
  ETIM_FEATURE_TYPES,
  type EtimFeatureType,
  type NumericSetup,
  type RangeSetup,
} from '@akeneo-etim/core';
import { Badge, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import { DefaultsPanel } from '../components/features/DefaultsPanel.js';
import { FeatureTable } from '../components/features/FeatureTable.js';
import { GenerateIssues } from '../components/features/GenerateIssues.js';
import { UnitMappingPanel } from '../components/features/UnitMappingPanel.js';
import { ATTRIBUTE_TYPE_LABELS, countBy, featureRows, metricUnitRows } from '../features/featureRows.js';
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

export function FeaturesStep() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { release, project } = state;
  const locale = displayLocale(state);

  // Both run over all selected classes. collectProjectFeatures only reads the class ids,
  // so overrides and settings changes do not rerun it.
  const { classIds } = project;
  const collected = useMemo(
    () => (release ? collectProjectFeatures(release, { ...createProject(''), classIds }) : undefined),
    [release, classIds],
  );
  const generated = useMemo(() => (release ? generateAttributes(release, project) : undefined), [release, project]);
  const rows = useMemo(
    () => (release && collected && generated ? featureRows(release, collected.features, generated.attributes, locale) : []),
    [release, collected, generated, locale],
  );
  const units = useMemo(
    () => (release && collected ? metricUnitRows(release, collected.features, project, locale) : []),
    [release, collected, project, locale],
  );
  const errorKeys = useMemo(
    () => new Set((generated?.issues ?? []).filter((i) => i.severity === 'error').flatMap((i) => (i.featureKey ? [i.featureKey] : []))),
    [generated],
  );

  if (!release || !collected || !generated) return <Text mt="md">Import an ETIM export first.</Text>;

  const byEtimType = countBy(rows, (r) => r.type);
  const byAttrType = countBy(generated.attributes, (a) => a.type);

  return (
    <Stack gap="lg" mt="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Stat label="Features" value={rows.length} testId="stat-features" />
        <Stat label="Attributes" value={generated.attributes.length} testId="stat-attributes" />
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Features by ETIM type
          </Text>
          <Group gap={4} mt={6}>
            {ETIM_FEATURE_TYPES.map((t: EtimFeatureType) => (
              <Badge key={t} variant="light" color="gray">
                {t} {byEtimType[t] ?? 0}
              </Badge>
            ))}
          </Group>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Attributes by type
          </Text>
          <Group gap={4} mt={6} data-testid="stat-attribute-types">
            {Object.entries(byAttrType).map(([type, count]) => (
              <Badge key={type} variant="light">
                {ATTRIBUTE_TYPE_LABELS[type as keyof typeof ATTRIBUTE_TYPE_LABELS]} {count}
              </Badge>
            ))}
          </Group>
        </Paper>
      </SimpleGrid>

      <GenerateIssues issues={generated.issues} />

      <DefaultsPanel
        numeric={project.settings.numeric}
        range={project.settings.range}
        onNumeric={(value: NumericSetup) => dispatch({ type: 'setNumericDefault', value })}
        onRange={(value: RangeSetup) => dispatch({ type: 'setRangeDefault', value })}
      />

      <UnitMappingPanel
        units={units}
        unitMap={project.settings.unitMap}
        release={release}
        onChange={(unitId, mapping) => dispatch({ type: 'setUnitMapping', unitId, mapping })}
      />

      <Stack gap="sm">
        <Title order={4}>Features</Title>
        <FeatureTable rows={rows} project={project} locale={locale} errorKeys={errorKeys} dispatch={dispatch} />
      </Stack>
    </Stack>
  );
}
