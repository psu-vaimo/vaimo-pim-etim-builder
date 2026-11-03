import { Table, Text } from '@mantine/core';

export interface CountRow {
  label: string;
  count: number;
  /** Shown before the label in a monospaced font, e.g. the ETIM type letter. */
  code?: string;
}

interface Props {
  rows: readonly CountRow[];
  /** Adds a total row with this label. */
  total?: string;
  testId?: string;
}

/** A compact two column table of counts, used for breakdowns such as attributes by type. */
export function CountTable({ rows, total, testId }: Props) {
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <Table fz="xs" verticalSpacing={2} horizontalSpacing={6} mt={6} data-testid={testId}>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.code ?? r.label}>
            <Table.Td px={0}>
              {r.code !== undefined && (
                <Text span inherit ff="monospace" fw={600} mr={6}>
                  {r.code}
                </Text>
              )}
              {r.label}
            </Table.Td>
            <Table.Td ta="right" pr={0}>
              {fmt(r.count)}
            </Table.Td>
          </Table.Tr>
        ))}
        {total !== undefined && (
          <Table.Tr fw={600}>
            <Table.Td px={0}>{total}</Table.Td>
            <Table.Td ta="right" pr={0}>
              {fmt(rows.reduce((n, r) => n + r.count, 0))}
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
}
