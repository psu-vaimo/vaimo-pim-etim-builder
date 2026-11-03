import { type EtimFeatureType, type FeatureKey, type MappingStatus } from '@vaimo-pim-etim-builder/core';
import { Badge, Button, Group, Pagination, SegmentedControl, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { Fragment, memo, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { ETIM_TYPE_LABELS } from '../../features/featureRows.js';
import { KEEP_CASE } from '../../theme.js';
import { ETIM_TYPE_OPTIONS, NARROW, NoUnit } from '../features/tableCells.js';
import {
  filterMappingRows,
  formatSource,
  groupBySource,
  pageGroups,
  type MappedFilter,
  type MappingRow,
  type SourceGroup,
} from '../../mapping/sourceMappings.js';

const PAGE_SIZE = 50;

type View = 'features' | 'sources';

const STATUS_BADGES: Record<MappingStatus, { label: string; variant: string; color: string }> = {
  mapped: { label: 'Mapped', variant: 'filled', color: 'teal' },
  unmapped: { label: 'Unmapped', variant: 'light', color: 'gray' },
  skipped: { label: 'Skipped', variant: 'outline', color: 'gray' },
};

interface Props {
  rows: readonly MappingRow[];
  locale: string | undefined;
  /** Features with a generator error, highlighted. */
  errorKeys: ReadonlySet<FeatureKey>;
  onEdit: (key: FeatureKey) => void;
  /** Marks an unmapped feature as skipped (not mapped on purpose), or takes that back. */
  onSkip: (key: FeatureKey, skipped: boolean) => void;
  /** Reference entity per source attribute of an A feature. */
  entityFor: (source: string) => string | undefined;
}

export const MappingTable = memo(function MappingTable({ rows, locale, errorKeys, onEdit, onSkip, entityFor }: Props) {
  const [view, setView] = useState<View>('features');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<EtimFeatureType | 'all'>('all');
  const [mapped, setMapped] = useState<MappedFilter>('all');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(
    () => filterMappingRows(rows, { search: deferredSearch, type: type === 'all' ? null : type, mapped }),
    [rows, deferredSearch, type, mapped],
  );

  const groupPages = useMemo(() => (view === 'sources' ? pageGroups(groupBySource(filtered), PAGE_SIZE) : []), [view, filtered]);

  const totalPages = Math.max(1, view === 'sources' ? groupPages.length : Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageSources = groupPages[currentPage - 1] ?? [];
  const sourceCount = groupPages.flat().filter((g) => g.source !== null).length;

  const renderRow = (row: MappingRow, groupKey = '') => {
    const hasError = errorKeys.has(row.key);
    const isMapped = row.status === 'mapped';
    return (
      <Table.Tr
        key={groupKey + row.key}
        data-testid={`mapping-row-${row.key}`}
        style={hasError ? { background: 'var(--mantine-color-red-light)' } : undefined}
      >
        <Table.Td ff="monospace">{row.featureId}</Table.Td>
        <Table.Td>{row.label || <Text c="dimmed">No label</Text>}</Table.Td>
        <Table.Td>
          <Tooltip label={ETIM_TYPE_LABELS[row.type]}>
            <Badge variant="light" color="gray" styles={KEEP_CASE}>
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
            <NoUnit />
          )}
        </Table.Td>
        <Table.Td>{row.classCount}</Table.Td>
        <Table.Td>
          <Badge {...STATUS_BADGES[row.status]} data-testid="mapping-status">
            {STATUS_BADGES[row.status].label}
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
          <Group gap={6} wrap="nowrap">
            <Button size="xs" variant={isMapped ? 'default' : 'light'} onClick={() => onEdit(row.key)} data-testid={`edit-${row.key}`}>
              {isMapped ? 'Edit' : 'Map'}
            </Button>
            {!isMapped && (
              <Tooltip label={row.status === 'skipped' ? 'Back to unmapped' : 'Not mapped on purpose, enriched by hand'}>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => onSkip(row.key, row.status !== 'skipped')}
                  data-testid={`skip-${row.key}`}
                >
                  {row.status === 'skipped' ? 'Unskip' : 'Skip'}
                </Button>
              </Tooltip>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  };

  const renderGroupHeader = ({ source, status, rows: groupRows }: SourceGroup): ReactNode => {
    const entity = source !== null && groupRows.some((r) => r.type === 'A') ? entityFor(source) : undefined;
    const count = groupRows.length === 1 ? '1 feature' : `${groupRows.length} features`;
    return (
      <Table.Tr data-testid={`source-group-${source ?? status}`} style={{ background: 'var(--mantine-color-default-hover)' }}>
        <Table.Td colSpan={8}>
          <Group gap="sm">
            {source === null ? (
              <Text fw={700}>{status === 'skipped' ? 'Skipped' : 'Not mapped'}</Text>
            ) : (
              <Text fw={700} ff="monospace">
                {source}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              {count}
            </Text>
            {entity && (
              <Text size="sm" c="dimmed">
                reference entity <Text span ff="monospace" c="var(--mantine-color-text)">{entity}</Text>
              </Text>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  };

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
          data={[
            { value: 'features', label: 'Features' },
            { value: 'sources', label: 'By source' },
          ]}
          value={view}
          onChange={(v) => {
            setView(v as View);
            setPage(1);
          }}
          data-testid="mapping-view"
        />
        <SegmentedControl
          data={ETIM_TYPE_OPTIONS}
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
            { value: 'skipped', label: 'Skipped' },
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
          {view === 'sources' && `, ${sourceCount.toLocaleString('en-US')} ${sourceCount === 1 ? 'source' : 'sources'}`}
        </Text>
      </Group>

      <Table striped highlightOnHover withTableBorder verticalSpacing={6} data-testid="mapping-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={110}>Feature</Table.Th>
            <Table.Th>Label{locale ? ` (${locale})` : ''}</Table.Th>
            <Table.Th w={60}>Type</Table.Th>
            <Table.Th w={110}>Unit</Table.Th>
            <Table.Th {...NARROW}>Classes</Table.Th>
            <Table.Th w={110} miw={110}>Status</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th w={150} miw={140} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {view === 'features'
            ? pageRows.map((row) => renderRow(row))
            : pageSources.map((group) => (
                <Fragment key={group.source ?? `\n${group.status}`}>
                  {renderGroupHeader(group)}
                  {group.rows.map((row) => renderRow(row, `${group.source ?? group.status}\n`))}
                </Fragment>
              ))}
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

      {totalPages > 1 && view === 'sources' && (
        <Group justify="flex-end">
          <Pagination total={totalPages} value={currentPage} onChange={setPage} size="sm" />
        </Group>
      )}
      {totalPages > 1 && view === 'features' && (
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
