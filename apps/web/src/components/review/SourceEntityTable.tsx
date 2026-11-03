import { Stack, Table, Text, Tooltip } from '@mantine/core';
import { exceptionsText, filledText, isComplete } from '../../format/sourceEntityText.js';
import type { SourceEntitySummary } from '../../review/reviewRows.js';
import { TEXT_COLORS } from '../../theme.js';
import { RecordAttributeTable } from '../RecordAttributeTable.js';

/**
 * One row per client reference entity: the client attributes using it, its
 * records, the features it provides with values filled and class exceptions,
 * and the record attributes it needs.
 */
export function SourceEntityTable({ summaries, testId }: { summaries: readonly SourceEntitySummary[]; testId: string }) {
  return (
    <Table withTableBorder verticalSpacing={6} data-testid={testId}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Reference entity</Table.Th>
          <Table.Th>Used by</Table.Th>
          <Table.Th w={90} ta="right">
            Records
          </Table.Th>
          <Table.Th>Provides</Table.Th>
          <Table.Th>Record attributes</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {summaries.map((s) => (
          <Table.Tr key={s.code} data-testid={`${testId}-row`} style={{ verticalAlign: 'top' }}>
            <Table.Td ff="monospace">{s.code}</Table.Td>
            <Table.Td>
              <Stack gap={2}>
                {s.attributes.map((a) => (
                  <Text key={a} size="sm" ff="monospace">
                    {a}
                  </Text>
                ))}
              </Stack>
            </Table.Td>
            <Table.Td ta="right">
              {s.records === 0 ? (
                <Text size="sm" c={TEXT_COLORS.warning}>
                  None
                </Text>
              ) : (
                s.records.toLocaleString('en-US')
              )}
            </Table.Td>
            <Table.Td>
              <Stack gap={6} data-testid={`${testId}-features`}>
                {s.features.map((f) => (
                  <Text key={f.featureId} size="sm" component="div">
                    <Text span inherit ff="monospace">
                      {f.featureId}
                    </Text>{' '}
                    {f.label}
                    <Text size="xs" c={isComplete(f, s.records) ? TEXT_COLORS.ok : TEXT_COLORS.warning}>
                      {filledText(f, s.records)}
                      {f.exceptionClasses.length > 0 && (
                        <Tooltip label={f.exceptionClasses.join(', ')}>
                          <Text span inherit c={TEXT_COLORS.accent}>
                            , {exceptionsText(f)}
                          </Text>
                        </Tooltip>
                      )}
                    </Text>
                  </Text>
                ))}
              </Stack>
            </Table.Td>
            <Table.Td>
              <RecordAttributeTable codes={s.recordAttributes} labelSuffix={s.labelSuffix} size="xs" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
