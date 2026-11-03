import { parseAkeneoAttributeExport, type GenerateIssue, type SourceAttribute } from '@akeneo-etim/core';
import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useState } from 'react';
import { useAppDispatch, useAppState } from '../../state/AppStateContext.js';
import { CountTable, type CountRow } from '../CountTable.js';

/** Upload of an Akeneo attribute export, its attributes are offered as sources and used to check mappings. */
export function SourceAttributesPanel() {
  const { project } = useAppState();
  const dispatch = useAppDispatch();
  const [result, setResult] = useState<{ fileName: string; issues: GenerateIssue[] } | undefined>();
  const attributes = project.sourceAttributes ?? [];

  async function read(file: File) {
    const parsed = parseAkeneoAttributeExport(new Uint8Array(await file.arrayBuffer()), file.name);
    setResult({ fileName: file.name, issues: parsed.issues });
    if (parsed.attributes.length > 0) dispatch({ type: 'setSourceAttributes', attributes: parsed.attributes });
  }

  return (
    <Paper withBorder p="md" data-testid="source-attributes">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Akeneo attributes</Title>
        {attributes.length > 0 && (
          <Button
            size="xs"
            variant="default"
            onClick={() => {
              dispatch({ type: 'setSourceAttributes', attributes: null });
              setResult(undefined);
            }}
            data-testid="source-attributes-remove"
          >
            Remove list
          </Button>
        )}
      </Group>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Upload the client's Akeneo attribute export (XLSX or CSV) to pick sources from a list and check their types. It is saved in
          the project file. Without it, source codes are typed by hand.
        </Text>
        {attributes.length > 0 && (
          <div style={{ maxWidth: 360 }}>
            <CountTable rows={typeCounts(attributes)} total="All attributes" testId="source-attribute-count" />
          </div>
        )}
        <Dropzone
          onDrop={(files) => files[0] && void read(files[0])}
          multiple={false}
          accept={['.xlsx', '.csv', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']}
          data-testid="source-attributes-dropzone"
        >
          <Text ta="center" py="xs" fw={600} style={{ pointerEvents: 'none' }}>
            {attributes.length > 0 ? 'Drop a new export to replace the list' : 'Drop the attribute export here, or click to choose'}
          </Text>
        </Dropzone>
        {result?.issues.map((issue, i) => (
          <Alert key={i} color={issue.severity === 'error' ? 'red' : 'yellow'} p="xs">
            <Text size="sm">{issue.message}</Text>
          </Alert>
        ))}
      </Stack>
    </Paper>
  );
}

/** Uploaded attributes per Akeneo type, most first, attributes without a type last. */
function typeCounts(attributes: readonly SourceAttribute[]): CountRow[] {
  const counts = new Map<string, number>();
  for (const a of attributes) counts.set(a.type || 'no type', (counts.get(a.type || 'no type') ?? 0) + 1);
  return [...counts]
    .sort(([a, x], [b, y]) => Number(a === 'no type') - Number(b === 'no type') || y - x || (a < b ? -1 : 1))
    .map(([type, count]) => (type === 'no type' ? { label: 'No type', count } : { code: type, label: '', count }));
}
