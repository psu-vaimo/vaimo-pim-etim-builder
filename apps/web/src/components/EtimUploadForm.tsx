import { Alert, Autocomplete, Badge, Button, Group, LoadingOverlay, Stack, Table, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import type { EtimTableName } from '@akeneo-etim/core';
import { useMemo, useState } from 'react';
import { isLocaleCode, LOCALE_SUGGESTIONS } from '../etim/locales.js';
import { assignFiles, ETIM_LABEL_TABLES, ETIM_TABLES, missingTables } from '../etim/tableFiles.js';

export type TableFiles = Partial<Record<EtimTableName, File>>;

interface Props {
  mode: 'base' | 'translation';
  busy: boolean;
  /** Locales already in the release, used for a hint and to pick a default suggestion. */
  existingLocales: readonly string[];
  submitLabel: string;
  onSubmit: (locale: string, files: TableFiles) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Locale input, file drop and table status for one ETIM upload. */
export function EtimUploadForm({ mode, busy, existingLocales, submitLabel, onSubmit }: Props) {
  const [locale, setLocale] = useState(mode === 'base' ? 'en_US' : '');
  const [files, setFiles] = useState<File[]>([]);
  const tables = mode === 'base' ? ETIM_TABLES : ETIM_LABEL_TABLES;
  const assignment = useMemo(() => assignFiles(files, tables), [files, tables]);
  const missing = missingTables(assignment.byTable, tables);
  const found = tables.length - missing.length;

  const localeError = locale !== '' && !isLocaleCode(locale) ? 'Use an Akeneo locale code like en_US or sv_SE' : undefined;
  const ready = isLocaleCode(locale) && (mode === 'base' ? missing.length === 0 : found > 0);
  const suggestions = LOCALE_SUGGESTIONS.filter((l) => mode === 'base' || !existingLocales.includes(l));

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={busy} overlayProps={{ blur: 1 }} loaderProps={{ children: <Text fw={600}>Reading ETIM files...</Text> }} />
      <Autocomplete
        label="Language of the files"
        description="Akeneo locale code, the descriptions in these files become labels in this locale"
        data={suggestions}
        value={locale}
        onChange={setLocale}
        error={localeError}
        maw={360}
        aria-label="Locale"
        data-testid={`${mode}-locale`}
      />
      {mode === 'translation' && existingLocales.includes(locale) && (
        <Text size="sm" c="yellow.8">
          {locale} is already loaded, its labels will be replaced.
        </Text>
      )}

      <Dropzone onDrop={(dropped) => setFiles((prev) => [...prev, ...dropped])} multiple data-testid={`${mode}-dropzone`}>
        <Stack gap={4} align="center" py="md" style={{ pointerEvents: 'none' }}>
          <Text fw={600}>Drop ETIM CSV files here, or click to choose</Text>
          <Text size="sm" c="dimmed">
            {mode === 'base'
              ? 'All six tables, one file per table, named like the table (ETIMARTCLASS.csv and so on)'
              : 'The description tables ETIMARTCLASS, ETIMFEATURE, ETIMVALUE and ETIMUNIT, any of them can be left out'}
          </Text>
        </Stack>
      </Dropzone>

      <Table withTableBorder verticalSpacing={4} fz="sm" data-testid={`${mode}-tables`}>
        <Table.Tbody>
          {tables.map((table) => {
            const file = assignment.byTable[table];
            return (
              <Table.Tr key={table}>
                <Table.Td ff="monospace" w={260}>
                  {table}
                </Table.Td>
                <Table.Td>
                  {file ? (
                    <Group gap="xs">
                      <Badge color="green" variant="light">
                        Found
                      </Badge>
                      <Text size="sm">{file.name}</Text>
                      <Text size="xs" c="dimmed">
                        {formatSize(file.size)}
                      </Text>
                    </Group>
                  ) : (
                    <Badge color={mode === 'base' ? 'red' : 'gray'} variant="light">
                      {mode === 'base' ? 'Missing' : 'Not added'}
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {assignment.unrecognized.length > 0 && (
        <Alert color="yellow" title="Files not recognized" p="xs">
          <Text size="sm">
            {assignment.unrecognized.map((f) => f.name).join(', ')}. The file name must contain exactly one ETIM table name.
          </Text>
        </Alert>
      )}
      {assignment.notNeeded.length > 0 && (
        <Text size="sm" c="dimmed">
          Not needed for a translation, ignored: {assignment.notNeeded.map((f) => f.name).join(', ')}
        </Text>
      )}

      <Group>
        <Button disabled={!ready || busy} loading={busy} onClick={() => onSubmit(locale, assignment.byTable)}>
          {submitLabel}
        </Button>
        {files.length > 0 && (
          <Button variant="subtle" color="gray" disabled={busy} onClick={() => setFiles([])}>
            Clear files
          </Button>
        )}
        <Text size="sm" c="dimmed">
          {found} of {tables.length} tables
        </Text>
      </Group>
    </Stack>
  );
}
