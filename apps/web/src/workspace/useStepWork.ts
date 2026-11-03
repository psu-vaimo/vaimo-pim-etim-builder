import {
  akeneoManualSteps,
  collectLogicalSources,
  collectProjectFeatures,
  collectSourceEntities,
  featureRecordAttributes,
  featuresWithoutYesValues,
} from '@vaimo-pim-etim-builder/core';
import { useDeferredValue, useMemo } from 'react';
import { metricUnitRows } from '../features/featureRows.js';
import { useGeneratedModel } from '../review/generated.js';
import { displayLocale, hasSelectedClasses, isReleaseReady, type AppState } from '../state/appState.js';
import { countMapped, countSourcesWithoutEntity, recordCounts, type SectionId } from './sections.js';
import { stepWork, type StepWork } from './stepTasks.js';

/**
 * The manual work of one step, done and open. Runs on a deferred project like
 * the sidebar statuses and shares the generator cache with Review and Export.
 */
export function useStepWork(state: AppState, id: SectionId): StepWork {
  const ready = isReleaseReady(state);
  const hasClasses = hasSelectedClasses(state);
  const project = useDeferredValue(state.project);
  const { release } = state;
  const locale = displayLocale(state);

  const features = useMemo(() => (release ? collectProjectFeatures(release, project).features : []), [release, project]);
  const entities = useMemo(
    () => (ready && hasClasses && release ? collectSourceEntities(release, project).entities : []),
    [ready, hasClasses, release, project],
  );
  const logical = useMemo(
    () => (ready && hasClasses && release ? collectLogicalSources(release, project) : []),
    [ready, hasClasses, release, project],
  );
  const model = useGeneratedModel(ready && hasClasses ? release : undefined, project);

  return useMemo(() => {
    const units = release ? metricUnitRows(release, features, project, locale) : [];
    const sourcesWithoutEntity = countSourcesWithoutEntity(features, project);
    const errors = model?.issues.filter((i) => i.severity === 'error').length;
    const records = recordCounts(entities);
    return stepWork(id, {
      ready,
      selectedClasses: release ? project.classIds.filter((c) => release.classes[c] !== undefined).length : 0,
      projectLocales: project.locales.length,
      metricUnits: units.length,
      unmappedUnits: units.filter((u) => !u.mapped).length,
      features: features.length,
      mappedFeatures: countMapped(features, project.features),
      skippedFeatures: countMapped(features, project.features, 'skipped'),
      sourcesWithoutEntity,
      sourceEntities: records.sourceEntities,
      entitiesWithoutRecords: entities.filter((e) => e.records.length === 0).length,
      recordValues: records.recordValues,
      mappedRecordValues: records.mappedRecordValues,
      skippedRecordValues: records.skippedRecordValues,
      logicalSources: logical.length,
      logicalWithoutYes: featuresWithoutYesValues(logical).length,
      entityAttributes: entities.reduce((n, e) => n + e.features.flatMap((f) => featureRecordAttributes(project, f)).length, 0),
      generatorErrors: errors,
      generatorWarnings: model && errors !== undefined ? model.issues.length - errors : undefined,
      akeneoSteps: id === 'export' ? akeneoManualSteps(project, entities) : [],
    });
  }, [id, ready, release, features, project, locale, entities, logical, model]);
}
