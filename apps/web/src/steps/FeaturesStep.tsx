import {
  collectProjectFeatures,
  createProject,
  generateAttributes,
  ETIM_FEATURE_TYPES,
  type EtimFeatureType,
  type NumericSetup,
  type RangeSetup,
} from '@akeneo-etim/core';
import { Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { DefaultsPanel } from '../components/features/DefaultsPanel.js';
import { FeatureTable } from '../components/features/FeatureTable.js';
import { GenerateIssues } from '../components/features/GenerateIssues.js';
import { UnitMappingPanel } from '../components/features/UnitMappingPanel.js';
import { StepSummary, SummaryRow } from '../components/StepSummary.js';
import { SubStep } from '../components/SubStep.js';
import { SUB_STEPS } from '../workspace/sections.js';
import { ATTRIBUTE_TYPE_LABELS, ETIM_TYPE_LABELS, countBy, featureRows, metricUnitRows } from '../features/featureRows.js';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { displayLocale } from '../state/appState.js';

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
      <StepSummary>
        <SummaryRow label="Features" value={rows.length} testId="stat-features" />
        {ETIM_FEATURE_TYPES.map((t: EtimFeatureType) => (
          <SummaryRow key={t} sub code={t} label={ETIM_TYPE_LABELS[t]} value={byEtimType[t] ?? 0} />
        ))}
        <SummaryRow label="Attributes" value={generated.attributes.length} testId="stat-attributes" />
        {Object.entries(byAttrType).map(([type, count]) => (
          <SummaryRow key={type} sub label={ATTRIBUTE_TYPE_LABELS[type as keyof typeof ATTRIBUTE_TYPE_LABELS]} value={count ?? 0} />
        ))}
      </StepSummary>

      <GenerateIssues issues={generated.issues} />

      <SubStep
        step={SUB_STEPS.defaults}
        collapsible
        description="Used by every feature without its own setting in the feature table."
        testId="sub-step-defaults"
      >
        <DefaultsPanel
          numeric={project.settings.numeric}
          range={project.settings.range}
          onNumeric={(value: NumericSetup) => dispatch({ type: 'setNumericDefault', value })}
          onRange={(value: RangeSetup) => dispatch({ type: 'setRangeDefault', value })}
        />
      </SubStep>

      <SubStep
        step={SUB_STEPS.units}
        description="Metric attributes need the Akeneo measurement family and unit code for their ETIM unit. Without a mapping the attribute falls back to number."
        testId="unit-mapping"
      >
        <UnitMappingPanel
          units={units}
          unitMap={project.settings.unitMap}
          release={release}
          onChange={(unitId, mapping) => dispatch({ type: 'setUnitMapping', unitId, mapping })}
        />
      </SubStep>

      <SubStep
        step={SUB_STEPS.features}
        description="One row per feature and unit over the selected classes, with the Akeneo attributes it becomes. N and R features can override the project defaults."
        testId="sub-step-features"
      >
        <FeatureTable rows={rows} project={project} locale={locale} errorKeys={errorKeys} dispatch={dispatch} />
      </SubStep>
    </Stack>
  );
}
