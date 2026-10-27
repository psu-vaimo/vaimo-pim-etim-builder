import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { ETIM_LABEL_TABLES, ETIM_TABLES, type EtimTableName, type ParseResult } from '@akeneo-etim/core';
import { useState } from 'react';
import { EtimLibraryForm } from '../components/EtimLibraryForm.js';
import { EtimUploadForm, type TableFiles } from '../components/EtimUploadForm.js';
import { IssueCounts, IssueList } from '../components/IssueList.js';
import { MissingClassesAlert } from '../components/MissingClassesAlert.js';
import { ReleaseSummary } from '../components/ReleaseSummary.js';
import type { EtimJobFile } from '../etim/etimJob.js';
import { fetchLibraryFiles, type LibraryLocale } from '../etim/library.js';
import { assignFiles } from '../etim/tableFiles.js';
import { runEtimJob } from '../etim/runEtimJob.js';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { isReleaseReady } from '../state/appState.js';

async function readFiles(files: TableFiles): Promise<{ jobFiles: EtimJobFile[]; fileNames: string[] }> {
  const entries = Object.entries(files) as [EtimTableName, File][];
  const jobFiles = await Promise.all(entries.map(async ([table, file]) => ({ table, bytes: await file.arrayBuffer() })));
  return { jobFiles, fileNames: entries.map(([, file]) => file.name) };
}

/** Downloads the files of a pre-loaded locale and assigns them to tables like an upload. */
async function libraryJobFiles(
  release: string,
  locale: LibraryLocale,
  tables: readonly EtimTableName[],
): Promise<{ jobFiles: EtimJobFile[]; fileNames: string[] }> {
  const files = await fetchLibraryFiles(release, locale);
  const entries = Object.entries(assignFiles(files, tables).byTable) as [EtimTableName, { name: string; bytes: ArrayBuffer }][];
  return { jobFiles: entries.map(([table, f]) => ({ table, bytes: f.bytes })), fileNames: entries.map(([, f]) => `${release}/${locale.locale}/${f.name}`) };
}

const hasErrors = (result: ParseResult) => result.issues.some((i) => i.severity === 'error');

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

  async function importLibrary(releaseName: string, base: LibraryLocale, translations: LibraryLocale[]) {
    setBusy('base');
    setFailure(undefined);
    try {
      const baseFiles = await libraryJobFiles(releaseName, base, ETIM_TABLES);
      let result = await runEtimJob({ kind: 'import', locale: base.locale, files: baseFiles.jobFiles });
      dispatch({ type: 'baseImported', locale: base.locale, fileNames: baseFiles.fileNames, result });
      if (!hasErrors(result)) {
        for (const locale of translations) {
          const files = await libraryJobFiles(releaseName, locale, ETIM_LABEL_TABLES);
          const translated = await runEtimJob({ kind: 'translate', locale: locale.locale, release: result.release, files: files.jobFiles });
          dispatch({ type: 'translationImported', locale: locale.locale, fileNames: files.fileNames, result: translated });
          if (!hasErrors(translated)) result = translated;
        }
      }
      setShowReplace(false);
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
          <EtimLibraryForm
            key={`library-${formKey}`}
            busy={busy === 'base'}
            onSubmit={(name, base, translations) => void importLibrary(name, base, translations)}
          />
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
