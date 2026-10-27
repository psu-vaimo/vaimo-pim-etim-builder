import { ETIM_FEATURE_TYPES, type EtimFeatureType, type FeatureKey } from '@akeneo-etim/core';
import { Badge, Button, Group, Pagination, SegmentedControl, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { memo, useDeferredValue, useMemo, useState } from 'react';
import { ETIM_TYPE_LABELS } from '../../features/featureRows.js';
import { filterMappingRows, formatSource, type MappedFilter, type MappingRow } from '../../mapping/sourceMappings.js';

const PAGE_SIZE = 50;

interface Props {
  rows: readonly MappingRow[];
  locale: string | undefined;
  /** Features with a generator error, highlighted. */
  errorKeys: ReadonlySet<FeatureKey>;
  onEdit: (key: FeatureKey) => void;
}

export const MappingTable = memo(function MappingTable({ rows, locale, errorKeys, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<EtimFeatureType | 'all'>('all');
  const [mapped, setMapped] = useState<MappedFilter>('all');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(
    () => filterMappingRows(rows, { search: deferredSearch, type: type === 'all' ? null : type, mapped }),
    [rows, deferredSearch, type, mapped],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Stack gap="sm">
      <Group align="flex-end" gap="sm">
        <TextInput
          label="Search"
          placeholder="Feature id, label, attribute or source code"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={320}
          data-testid="mapping-search"
        />
        <SegmentedControl
          data={[{ value: 'all', label: 'All types' }, ...ETIM_FEATURE_TYPES.map((t) => ({ value: t, label: `${t} ${ETIM_TYPE_LABELS[t]}` }))]}
          value={type}
          onChange={(v) => {
            setType(v as EtimFeatureType | 'all');
            setPage(1);
          }}
          data-testid="mapping-type-filter"
        />
        <SegmentedControl
          data={[
            { value: 'all', label: 'All' },
            { value: 'mapped', label: 'Mapped' },
            { value: 'unmapped', label: 'Unmapped' },
          ]}
          value={mapped}
          onChange={(v) => {
            setMapped(v as MappedFilter);
            setPage(1);
          }}
          data-testid="mapping-status-filter"
        />
        <Text size="sm" c="dimmed">
          {filtered.length === rows.length
            ? `${rows.length.toLocaleString('en-US')} features`
            : `${filtered.length.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} features match`}
        </Text>
      </Group>

      <Table striped highlightOnHover withTableBorder verticalSpacing={6} data-testid="mapping-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={110}>Feature</Table.Th>
            <Table.Th>Label{locale ? ` (${locale})` : ''}</Table.Th>
            <Table.Th w={60}>Type</Table.Th>
            <Table.Th w={110}>Unit</Table.Th>
            <Table.Th w={80} ta="right">
              Classes
            </Table.Th>
            <Table.Th w={100}>Status</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th w={90} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {pageRows.map((row) => {
            const hasError = errorKeys.has(row.key);
            const isMapped = row.sources.length > 0;
            return (
              <Table.Tr
                key={row.key}
                data-testid={`mapping-row-${row.key}`}
                style={hasError ? { background: 'var(--mantine-color-red-light)' } : undefined}
              >
                <Table.Td ff="monospace">{row.featureId}</Table.Td>
                <Table.Td>{row.label || <Text c="dimmed">No label</Text>}</Table.Td>
                <Table.Td>
                  <Tooltip label={ETIM_TYPE_LABELS[row.type]}>
                    <Badge variant="light" color="gray">
                      {row.type}
                    </Badge>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  {row.unitId ? (
                    <Tooltip label={row.unitId}>
                      <Text size="sm">{row.unitLabel || row.unitId}</Text>
                    </Tooltip>
                  ) : (
                    <Text size="sm" c="dimmed">
                      None
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">{row.classCount}</Table.Td>
                <Table.Td>
                  <Badge variant={isMapped ? 'filled' : 'light'} color={isMapped ? 'teal' : 'gray'} data-testid="mapping-status">
                    {isMapped ? 'Mapped' : 'Unmapped'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {row.sources.map((s, i) => (
                      <Text key={i} size="sm" ff="monospace">
                        {row.sources.length > 1 ? `${i + 1}. ` : ''}
                        {formatSource(s)}
                      </Text>
                    ))}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant={isMapped ? 'default' : 'light'} onClick={() => onEdit(row.key)} data-testid={`edit-${row.key}`}>
                    {isMapped ? 'Edit' : 'Map'}
                  </Button>
                </Table.Td>
              </Table.Tr>
            );
          })}
          {pageRows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="dimmed" ta="center" py="md">
                  {rows.length === 0 ? 'The selected classes have no features' : 'No features match the filters'}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {totalPages > 1 && (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Showing {((currentPage - 1) * PAGE_SIZE + 1).toLocaleString('en-US')} to{' '}
            {Math.min(currentPage * PAGE_SIZE, filtered.length).toLocaleString('en-US')}
          </Text>
          <Pagination total={totalPages} value={currentPage} onChange={setPage} size="sm" />
        </Group>
      )}
    </Stack>
  );
});
