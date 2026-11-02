import { collectProjectFeatures, createProject, generateAttributes, generateRules, sourceEntityFor, type FeatureKey } from '@akeneo-etim/core';
import { Button, Group, Modal, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { GenerateIssues } from '../components/features/GenerateIssues.js';
import { MappingTable } from '../components/mapping/MappingTable.js';
import { SourceAttributesPanel } from '../components/mapping/SourceAttributesPanel.js';
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
  // Where to go once unsaved changes are discarded: another feature, or `undefined` to close.
  const [discard, setDiscard] = useState<{ target: FeatureKey | undefined } | undefined>();
  const dirty = useRef(false);
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const discardRef = useRef(discard);
  discardRef.current = discard;
  /**
   * Opens a feature (or closes with `undefined`), asking first when the open editor has unsaved changes.
   * The drawer also asks to close on Escape while the prompt is open, that answers the prompt with keep editing.
   */
  const requestEdit = useCallback((target: FeatureKey | undefined) => {
    if (discardRef.current !== undefined) {
      if (target === undefined) setDiscard(undefined);
      return;
    }
    if (target === editingRef.current) return;
    if (dirty.current) setDiscard({ target });
    else setEditing(target);
  }, []);

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
  const onEdit = useCallback((key: FeatureKey) => requestEdit(key), [requestEdit]);
  const entityFor = useCallback((source: string) => sourceEntityFor(project, source), [project]);

  if (!release || !collected || !generated) return <Text mt="md">Import an ETIM export first.</Text>;

  const mapped = rows.filter((r) => r.sources.length > 0).length;
  const editingRow = editing === undefined ? undefined : rows.find((r) => r.key === editing);

  return (
    <Stack gap="lg" mt="md">
      <Text size="sm" c="dimmed">
        Pick the customer (data model) attribute that feeds each ETIM feature. Mapped features become read only and are filled by
        Akeneo rules, one rule per source attribute. Unmapped features are enriched by hand.
      </Text>
      <SourceAttributesPanel />
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Stat label="Features" value={rows.length} testId="stat-features" />
        <Stat label="Mapped" value={mapped} testId="stat-mapped" />
        <Stat label="Unmapped" value={rows.length - mapped} testId="stat-unmapped" />
        <Stat label="Rules" value={generated.rules.length} testId="stat-rules" />
      </SimpleGrid>

      <GenerateIssues issues={generated.issues} />

      {orphans.length > 0 && (
        <Group gap="sm" wrap="nowrap" align="flex-start" data-testid="orphan-mappings">
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>
            {orphans.length === 1 ? '1 mapped feature is' : `${orphans.length} mapped features are`} not used by the selected
            classes, the mapping is kept in the project: {orphans.join(', ')}
          </Text>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            style={{ flexShrink: 0 }}
            onClick={() => dispatch({ type: 'removeSources', keys: orphans })}
            data-testid="remove-orphans"
          >
            Remove unused mappings
          </Button>
        </Group>
      )}

      <Stack gap="sm">
        <Title order={4}>Features</Title>
        <MappingTable
          rows={rows}
          locale={locale}
          errorKeys={errorKeys}
          onEdit={onEdit}
          entityFor={entityFor}
        />
      </Stack>

      <SourceEditor
        row={editingRow}
        release={release}
        project={project}
        locale={locale}
        onClose={() => requestEdit(undefined)}
        onDirtyChange={onDirtyChange}
        onSave={(row, sources, entity) => {
          dispatch({ type: 'setFeatureSources', key: row.key, featureType: row.type, sources });
          const attribute = sources[0]?.attribute;
          if (row.type === 'A' && attribute) dispatch({ type: 'setSourceEntityLink', attribute, entity: entity || null });
          dirty.current = false;
          setEditing(undefined);
        }}
      />

      <Modal
        opened={discard !== undefined}
        onClose={() => setDiscard(undefined)}
        title={<Text fw={700}>Discard changes?</Text>}
        zIndex={400}
        // Drawer and modal both listen for Escape on the window, the drawer's onClose handles it (see requestEdit).
        closeOnEscape={false}
        data-testid="discard-modal"
      >
        <Text size="sm">
          The sources of {editingRow?.featureId ?? 'this feature'} have unsaved changes. Discarding them keeps the saved mapping.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDiscard(undefined)} data-testid="discard-keep">
            Keep editing
          </Button>
          <Button
            color="red"
            onClick={() => {
              dirty.current = false;
              setEditing(discard?.target);
              setDiscard(undefined);
            }}
            data-testid="discard-confirm"
          >
            Discard changes
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
