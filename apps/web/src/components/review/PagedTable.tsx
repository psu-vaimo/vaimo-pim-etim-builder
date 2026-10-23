import { Group, Pagination, Stack, Table, Text, TextInput } from '@mantine/core';
import { Fragment, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { filterBySearch, paginate, type Searchable } from '../../review/reviewRows.js';

export interface Column<T> {
  header: ReactNode;
  width?: number;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

interface Props<T extends Searchable> {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  /** `attributes` gives `12 attributes`. */
  noun: string;
  placeholder: string;
  testId: string;
  pageSize?: number;
  /** Rows with details open below them. */
  expanded?: ReadonlySet<string>;
  renderExpanded?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}

/** Read only table with search over `searchText` and pagination, for lists with thousands of rows. */
export function PagedTable<T extends Searchable>({
  rows,
  columns,
  rowKey,
  noun,
  placeholder,
  testId,
  pageSize = 50,
  expanded,
  renderExpanded,
  onRowClick,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => filterBySearch(rows, deferredSearch), [rows, deferredSearch]);
  const current = paginate(filtered, page, pageSize);
  const count = (n: number) => n.toLocaleString('en-US');

  return (
    <Stack gap="sm" data-testid={testId}>
      <Group align="flex-end" gap="sm">
        <TextInput
          label="Search"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={320}
          data-testid={`${testId}-search`}
        />
        <Text size="sm" c="dimmed" data-testid={`${testId}-count`}>
          {filtered.length === rows.length
            ? `${count(rows.length)} ${noun}`
            : `${count(filtered.length)} of ${count(rows.length)} ${noun} match`}
        </Text>
      </Group>
      <Table striped highlightOnHover withTableBorder verticalSpacing={6} data-testid={`${testId}-table`}>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c, i) => (
              <Table.Th key={i} w={c.width} ta={c.align}>
                {c.header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {current.rows.map((row) => {
            const key = rowKey(row);
            const open = expanded?.has(key) === true && renderExpanded !== undefined;
            return (
              <Fragment key={key}>
                <Table.Tr
                  data-testid={`${testId}-row`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((c, i) => (
                    <Table.Td key={i} ta={c.align}>
                      {c.render(row)}
                    </Table.Td>
                  ))}
                </Table.Tr>
                {open && (
                  <Table.Tr data-testid={`${testId}-details`}>
                    <Table.Td colSpan={columns.length} bg="var(--mantine-color-body)">
                      {renderExpanded(row)}
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            );
          })}
          {current.rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Text c="dimmed" ta="center" py="md">
                  {rows.length === 0 ? `No ${noun}` : `No ${noun} match the search`}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
      {current.totalPages > 1 && (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Showing {count(current.start + 1)} to {count(current.start + current.rows.length)}
          </Text>
          <Pagination total={current.totalPages} value={current.page} onChange={setPage} size="sm" />
        </Group>
      )}
    </Stack>
  );
}
