import type { EtimRelease, Project } from '@akeneo-etim/core';
import { Alert, Button, Group, Loader, Modal, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { GenerateIssues } from '../components/features/GenerateIssues.js';
import { CollapsibleBox } from '../components/CollapsibleBox.js';
import { SourceEntityTable } from '../components/review/SourceEntityTable.js';
import { downloadFile } from '../export/download.js';
import {
  baseName,
  formatBytes,
  groupExportFiles,
  mimeType,
  summarizeIssues,
  zipFileName,
} from '../export/exportFiles.js';
import type { ExportJobResult } from '../export/exportJob.js';
import { runExportJob } from '../export/runExportJob.js';
import { useGeneratedModel } from '../review/generated.js';
import { sourceEntitySummaries } from '../review/reviewRows.js';
import { useAppState } from '../state/AppStateContext.js';
import { displayLocale } from '../state/appState.js';
import { TEXT_COLORS } from '../theme.js';

/** Wait after the last project change before building, typing the project name should not start a build per key. */
const BUILD_DELAY_MS = 300;

interface Built {
  release: EtimRelease;
  project: Project;
  result: ExportJobResult;
}

type Download = { kind: 'zip' } | { kind: 'file'; path: string };

/** Builds the export in a worker whenever the release or project changes while the step is open. */
function useExportBuild(release: EtimRelease | undefined, project: Project) {
  const [built, setBuilt] = useState<Built | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (!release) return;
    setBuilding(true);
    setError(undefined);
    let cancel: (() => void) | undefined;
    let active = true;
    const timer = setTimeout(() => {
      const job = runExportJob({ release, project });
      cancel = job.cancel;
      job.promise.then(
        (result) => {
          if (!active) return;
          setBuilt({ release, project, result });
          setBuilding(false);
        },
        (e: unknown) => {
          if (!active) return;
          setError(e instanceof Error ? e.message : String(e));
          setBuilding(false);
        },
      );
    }, BUILD_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      cancel?.();
    };
  }, [release, project]);

  const current = built && built.release === release && built.project === project ? built.result : undefined;
  return { result: current, previous: built?.result, building, error };
}

export function ExportStep() {
  const state = useAppState();
  const { release, project } = state;
  const locale = displayLocale(state);
  const { result, previous, building, error } = useExportBuild(release, project);
  const [confirm, setConfirm] = useState<Download | undefined>();

  const shown = result ?? previous;
  const groups = useMemo(() => (shown ? groupExportFiles(shown.files) : []), [shown]);
  const summary = useMemo(() => (shown ? summarizeIssues(shown.issues) : undefined), [shown]);
  const model = useGeneratedModel(release, project);
  const entities = useMemo(() => (model && release ? sourceEntitySummaries(release, project, model.sourceEntities, locale) : []), [model, release, project, locale]);

  if (!release) return <Text mt="md">Import an ETIM export first.</Text>;

  const zipName = zipFileName(project);
  const totalSize = groups.reduce((sum, g) => sum + g.files.reduce((s, f) => s + f.size, 0), 0);

  const run = (d: Download) => {
    if (!result) return;
    if (d.kind === 'zip') {
      downloadFile(zipName, result.zip, mimeType(zipName));
      return;
    }
    const file = result.files.find((f) => f.path === d.path);
    if (file) downloadFile(baseName(file.path), file.content, mimeType(file.path));
  };
  const request = (d: Download) => {
    if (result?.hasErrors) setConfirm(d);
    else run(d);
  };

  return (
    <Stack gap="lg" mt="md">
      {error && (
        <Alert color="red" title="The export could not be built" data-testid="export-error">
          {error}
        </Alert>
      )}

      {summary && summary.errors > 0 && (
        <Text size="sm" c="red" fw={600} data-testid="export-has-errors">
          The export has {summary.errors === 1 ? '1 error' : `${summary.errors} errors`}. Files are still generated, check them before
          importing into Akeneo.
        </Text>
      )}
      {shown && <GenerateIssues issues={shown.issues} />}

      <Paper withBorder p="md">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={4}>Export files</Title>
            <Text size="sm" c="dimmed" data-testid="export-status">
              {building
                ? 'Preparing the export...'
                : result
                  ? `${result.files.length} files, ${formatBytes(totalSize)}, zipped ${formatBytes(result.zip.byteLength)}`
                  : error
                    ? 'The export failed'
                    : 'Preparing the export...'}
            </Text>
          </Stack>
          <Group gap="sm">
            {building && <Loader size="sm" data-testid="export-loading" />}
            <Button onClick={() => request({ kind: 'zip' })} disabled={!result || building} data-testid="download-zip">
              Download zip
            </Button>
          </Group>
        </Group>
        {result && (
          <Text size="xs" c="dimmed" mt={4} data-testid="export-zip-name">
            {zipName}, built in {((result.buildMs + result.zipMs) / 1000).toFixed(1)} s
          </Text>
        )}
      </Paper>

      {entities.length > 0 && (
        <CollapsibleBox title="Create source record attributes" testId="export-source-records">
          <Text size="sm" c="dimmed">
            Add the record attributes to each reference entity in Akeneo first, then import its 07_records file to fill them.
            Unmapped values are exported empty.
          </Text>
          <SourceEntityTable summaries={entities} testId="export-source-entities" />
        </CollapsibleBox>
      )}


      {groups.length > 0 && (
        <CollapsibleBox
          title="Files"
          aside={
            result && (
              <Text size="sm" c="dimmed">
                {result.files.length} files, {formatBytes(totalSize)}
              </Text>
            )
          }
          defaultOpen={false}
          testId="export-files-box"
        >
          <Table withTableBorder verticalSpacing={6} data-testid="export-files" style={building ? { opacity: 0.6 } : undefined}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File</Table.Th>
                <Table.Th w={110} ta="right">
                  Size
                </Table.Th>
                <Table.Th w={120} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groups.map((g) => [
                <Table.Tr key={g.id} bg="var(--mantine-color-gray-light)">
                  <Table.Td colSpan={3}>
                    <Text size="sm" fw={600}>
                      {g.label}
                    </Text>
                  </Table.Td>
                </Table.Tr>,
                ...g.files.map((f) => (
                  <Table.Tr key={f.file.path} data-testid="export-file">
                    <Table.Td ff="monospace" pl="lg" data-testid="export-file-path">
                      {f.file.path}
                    </Table.Td>
                    <Table.Td ta="right">{formatBytes(f.size)}</Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="xs"
                        variant="default"
                        disabled={!result || building}
                        onClick={() => request({ kind: 'file', path: f.file.path })}
                        data-testid={`download-${f.file.path}`}
                      >
                        Download
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                )),
              ])}
            </Table.Tbody>
          </Table>
        </CollapsibleBox>
      )}

      <Modal
        opened={confirm !== undefined}
        onClose={() => setConfirm(undefined)}
        title={<Text fw={700}>Download with errors?</Text>}
        data-testid="confirm-download"
      >
        {summary && (
          <Stack gap="sm">
            <Text size="sm" data-testid="confirm-error-count">
              The export has {summary.errors === 1 ? '1 error' : `${summary.errors} errors`}. The files may not import cleanly into
              Akeneo.
            </Text>
            <Stack gap={2}>
              {summary.firstErrors.map((e, i) => (
                <Text key={i} size="xs" c={TEXT_COLORS.error}>
                  {e.message}
                </Text>
              ))}
              {summary.errors > summary.firstErrors.length && (
                <Text size="xs" c="dimmed">
                  {summary.errors - summary.firstErrors.length} more, see the list on this page
                </Text>
              )}
            </Stack>
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setConfirm(undefined)} data-testid="confirm-cancel">
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => {
                  if (confirm) run(confirm);
                  setConfirm(undefined);
                }}
                data-testid="confirm-download-anyway"
              >
                Download anyway
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
