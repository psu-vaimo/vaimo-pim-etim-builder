import { collectProjectFeatures, collectSourceEntities, createProject } from '@akeneo-etim/core';
import { useDeferredValue, useMemo } from 'react';
import { useGeneratedModel } from '../review/generated.js';
import type { AppState } from '../state/appState.js';
import { hasSelectedClasses, isReleaseReady } from '../state/appState.js';
import { countMapped, recordCounts, sectionStatuses, type SectionStatus, type StatusInput } from './sections.js';

/**
 * Sidebar statuses for the workspace. Generation runs on a deferred project,
 * so typing in a step stays responsive, and shares the cache with Review and
 * Export. Pass `enabled: false` in the wizard to skip the work.
 */
export function useSectionStatuses(state: AppState, enabled: boolean): SectionStatus[] {
  const ready = isReleaseReady(state);
  const hasClasses = hasSelectedClasses(state);
  const deferredProject = useDeferredValue(state.project);
  const { release } = state;
  const { classIds } = state.project;

  const collected = useMemo(
    () => (enabled && release ? collectProjectFeatures(release, { ...createProject(''), classIds }).features : []),
    [enabled, release, classIds],
  );
  const entities = useMemo(
    () => (enabled && ready && hasClasses && release ? collectSourceEntities(release, deferredProject).entities : []),
    [enabled, ready, hasClasses, release, deferredProject],
  );
  const model = useGeneratedModel(enabled && ready && hasClasses ? release : undefined, deferredProject);

  return useMemo(() => {
    const base = state.imports[0];
    const errors = model?.issues.filter((i) => i.severity === 'error').length;
    const input: StatusInput = {
      ready,
      hasClasses,
      imported: base !== undefined,
      importErrors: base?.issues.filter((i) => i.severity === 'error').length ?? 0,
      localeCount: release?.locales.length ?? 0,
      selectedClasses: release ? classIds.filter((id) => release.classes[id] !== undefined).length : 0,
      features: collected.length,
      mappedFeatures: countMapped(collected, state.project.features),
      ...recordCounts(entities),
      generatorErrors: errors,
      generatorWarnings: model && errors !== undefined ? model.issues.length - errors : undefined,
    };
    return sectionStatuses(input);
  }, [state.imports, state.project.features, model, ready, hasClasses, release, classIds, collected, entities]);
}
