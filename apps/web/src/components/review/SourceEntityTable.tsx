import { Badge, Table, Text } from '@mantine/core';
import type { SourceEntitySummary } from '../../review/reviewRows.js';
import { TEXT_COLORS } from '../../theme.js';

/** One row per customer reference entity: sources, features, records, mapped values and the record attributes it needs. */
export function SourceEntityTable({ summaries, testId }: { summaries: readonly SourceEntitySummary[]; testId: string }) {
  return (
    <Table withTableBorder verticalSpacing={6} data-testid={testId}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Reference entity</Table.Th>
          <Table.Th>Sources</Table.Th>
          <Table.Th w={90} ta="right">
            Records
          </Table.Th>
          <Table.Th w={150} ta="right">
            Values mapped
          </Table.Th>
          <Table.Th w={110} ta="right">
            Class values
          </Table.Th>
          <Table.Th>Record attributes</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {summaries.map((s) => (
          <Table.Tr key={s.code} data-testid={`${testId}-row`}>
            <Table.Td ff="monospace">{s.code}</Table.Td>
            <Table.Td>
              <Text size="sm" ff="monospace">
                {s.attributes.join(', ')}
              </Text>
              <Text size="xs" c="dimmed">
                {s.features.join(', ')}
              </Text>
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
            <Table.Td ta="right">
              {s.total > 0 && (
                <Badge variant="light" color={s.mapped === s.total ? 'teal' : 'orange'}>
                  {s.mapped.toLocaleString('en-US')} of {s.total.toLocaleString('en-US')}
                </Badge>
              )}
            </Table.Td>
            <Table.Td ta="right">{s.classValues > 0 ? s.classValues.toLocaleString('en-US') : ''}</Table.Td>
            <Table.Td>
              <Text size="xs" ff="monospace">
                {s.recordAttributes.join(', ')}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
