import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { EtimTableName } from '@akeneo-etim/core';
import { useState } from 'react';
import { EtimUploadForm, type TableFiles } from '../components/EtimUploadForm.js';
import { IssueCounts, IssueList } from '../components/IssueList.js';
import { MissingClassesAlert } from '../components/MissingClassesAlert.js';
import { ReleaseSummary } from '../components/ReleaseSummary.js';
import type { EtimJobFile } from '../etim/etimJob.js';
import { runEtimJob } from '../etim/runEtimJob.js';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { isReleaseReady } from '../state/appState.js';

async function readFiles(files: TableFiles): Promise<{ jobFiles: EtimJobFile[]; fileNames: string[] }> {
  const entries = Object.entries(files) as [EtimTableName, File][];
  const jobFiles = await Promise.all(entries.map(async ([table, file]) => ({ table, bytes: await file.arrayBuffer() })));
  return { jobFiles, fileNames: entries.map(([, file]) => file.name) };
}

export function ImportStep() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { release, imports } = state;
  const [busy, setBusy] = useState<'base' | 'translation' | undefined>();
  const [failure, setFailure] = useState<string | undefined>();
  const [showReplace, setShowReplace] = useState(false);
  // Remounts the forms after a successful upload so they start empty.
  const [formKey, setFormKey] = useState(0);

  async function importBase(locale: string, files: TableFiles) {
    setBusy('base');
    setFailure(undefined);
    try {
      const { jobFiles, fileNames } = await readFiles(files);
      const result = await runEtimJob({ kind: 'import', locale, files: jobFiles });
      dispatch({ type: 'baseImported', locale, fileNames, result });
      setShowReplace(false);
      setFormKey((k) => k + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function importTranslation(locale: string, files: TableFiles) {
    if (!release) return;
    setBusy('translation');
    setFailure(undefined);
    try {
      const { jobFiles, fileNames } = await readFiles(files);
      const result = await runEtimJob({ kind: 'translate', locale, release, files: jobFiles });
      dispatch({ type: 'translationImported', locale, fileNames, result });
      setFormKey((k) => k + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(undefined);
    }
  }

  const baseErrors = release !== undefined && !isReleaseReady(state);

  return (
    <Stack gap="lg" mt="md">
      {failure && (
        <Alert color="red" title="The files could not be read" withCloseButton onClose={() => setFailure(undefined)}>
          {failure}
        </Alert>
      )}

      {release && (
        <Stack gap="sm">
          <Title order={4}>ETIM release</Title>
          <ReleaseSummary release={release} />
          {baseErrors && (
            <Alert color="red" title="The ETIM export has errors">
              Fix the files and import them again to continue. Missing tables or columns are errors.
            </Alert>
          )}
          <MissingClassesAlert />
          {imports.map((entry, i) => (
            <Paper key={i} withBorder p="sm" radius="md" data-testid="import-entry">
              <Group justify="space-between" mb={entry.issues.length > 0 ? 'xs' : 0}>
                <Group gap="xs">
                  <Badge variant="outline">{entry.locale}</Badge>
                  <Text fw={600}>{entry.kind === 'base' ? 'ETIM export' : 'Translation'}</Text>
                  <Text size="sm" c="dimmed">
                    {entry.fileNames.length} files
                  </Text>
                  {!entry.applied && (
                    <Badge color="red" variant="filled">
                      Not added
                    </Badge>
                  )}
                </Group>
                <IssueCounts issues={entry.issues} />
              </Group>
              <IssueList issues={entry.issues} />
            </Paper>
          ))}
        </Stack>
      )}

      {(!release || showReplace) && (
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="xs">
            {release ? 'Replace ETIM export' : 'ETIM export'}
          </Title>
          {release && (
            <Text size="sm" c="dimmed" mb="sm">
              A new export replaces the current release and all added languages. Selected classes are kept.
            </Text>
          )}
          <EtimUploadForm
            key={`base-${formKey}`}
            mode="base"
            busy={busy === 'base'}
            existingLocales={release?.locales ?? []}
            submitLabel="Import ETIM export"
            onSubmit={(locale, files) => void importBase(locale, files)}
          />
        </Paper>
      )}

      {release && !baseErrors && (
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="xs">
            Add a language
          </Title>
          <Text size="sm" c="dimmed" mb="sm">
            Upload the ETIM export in another language to add its labels to the release.
          </Text>
          <EtimUploadForm
            key={`translation-${formKey}`}
            mode="translation"
            busy={busy === 'translation'}
            existingLocales={release.locales}
            submitLabel="Add language"
            onSubmit={(locale, files) => void importTranslation(locale, files)}
          />
        </Paper>
      )}

      {release && !showReplace && (
        <Group>
          <Button variant="subtle" onClick={() => setShowReplace(true)}>
            Replace ETIM export
          </Button>
        </Group>
      )}
    </Stack>
  );
}
