import { type EtimFeatureType, type FeatureKey, type NumericSetup, type Project, type RangeSetup } from '@vaimo-pim-etim-builder/core';
import { Badge, Group, NativeSelect, Pagination, SegmentedControl, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { memo, useDeferredValue, useMemo, useState, type Dispatch } from 'react';
import {
  ATTRIBUTE_TYPE_LABELS,
  ETIM_TYPE_LABELS,
  NUMERIC_LABELS,
  RANGE_LABELS,
  filterFeatureRows,
  type FeatureRow,
} from '../../features/featureRows.js';
import type { AppAction } from '../../state/appState.js';
import { KEEP_CASE } from '../../theme.js';
import { ETIM_TYPE_OPTIONS, NARROW, NoUnit } from './tableCells.js';

const PAGE_SIZE = 50;
/** Same line height for attribute codes and their types, so the two columns line up. */
const LINE = '22px';
/** Badge labels are cut off with an ellipsis by default, the type pills keep their full text so the column fits them. */
const FULL_LABEL = { root: { flexShrink: 0 }, label: { overflow: 'visible' } } as const;
const DEFAULT = 'default';

interface OverrideProps {
  row: FeatureRow;
  project: Project;
  dispatch: Dispatch<AppAction>;
}

/** Number or metric for N features with a unit, range setup for R features. */
function OverrideSelect({ row, project, dispatch }: OverrideProps) {
  const config = project.features[row.key];
  if (row.type === 'N' && row.unitId) {
    const value = config?.numeric ?? DEFAULT;
    return (
      <NativeSelect
        size="xs"
        aria-label={`Setup for ${row.key}`}
        value={value}
        onChange={(e) => {
          const v = e.currentTarget.value;
          dispatch({ type: 'setFeatureNumeric', key: row.key, value: v === DEFAULT ? null : (v as NumericSetup) });
        }}
        data={[
          { value: DEFAULT, label: `Project default (${NUMERIC_LABELS[project.settings.numeric]})` },
          ...Object.entries(NUMERIC_LABELS).map(([v, label]) => ({ value: v, label })),
        ]}
        data-testid={`override-${row.key}`}
      />
    );
  }
  if (row.type === 'R') {
    const value = config?.range ?? DEFAULT;
    return (
      <NativeSelect
        size="xs"
        aria-label={`Setup for ${row.key}`}
        value={value}
        onChange={(e) => {
          const v = e.currentTarget.value;
          dispatch({ type: 'setFeatureRange', key: row.key, value: v === DEFAULT ? null : (v as RangeSetup) });
        }}
        data={[
          { value: DEFAULT, label: `Project default (${RANGE_LABELS[project.settings.range]})` },
          ...Object.entries(RANGE_LABELS).map(([v, label]) => ({ value: v, label })),
        ]}
        data-testid={`override-${row.key}`}
      />
    );
  }
  return null;
}

interface Props {
  rows: readonly FeatureRow[];
  project: Project;
  locale: string | undefined;
  /** Features with a generator error, highlighted. */
  errorKeys: ReadonlySet<FeatureKey>;
  dispatch: Dispatch<AppAction>;
}

export const FeatureTable = memo(function FeatureTable({ rows, project, locale, errorKeys, dispatch }: Props) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<EtimFeatureType | 'all'>('all');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(
    () => filterFeatureRows(rows, { search: deferredSearch, type: type === 'all' ? null : type }),
    [rows, deferredSearch, type],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Stack gap="sm">
      <Group align="flex-end" gap="sm">
        <TextInput
          label="Search"
          placeholder="Feature id, label, unit or attribute code"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={320}
          data-testid="feature-search"
        />
        <SegmentedControl
          data={ETIM_TYPE_OPTIONS}
          value={type}
          onChange={(v) => {
            setType(v as EtimFeatureType | 'all');
            setPage(1);
          }}
          data-testid="feature-type-filter"
        />
        <Text size="sm" c="dimmed">
          {filtered.length === rows.length
            ? `${rows.length.toLocaleString('en-US')} features`
            : `${filtered.length.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} features match`}
        </Text>
      </Group>

      <Table striped highlightOnHover withTableBorder verticalSpacing={6} data-testid="feature-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={110}>Feature</Table.Th>
            <Table.Th>Label{locale ? ` (${locale})` : ''}</Table.Th>
            <Table.Th w={60}>Type</Table.Th>
            <Table.Th w={110}>Unit</Table.Th>
            <Table.Th {...NARROW}>Classes</Table.Th>
            <Table.Th>Akeneo attributes</Table.Th>
            <Table.Th>Akeneo type</Table.Th>
            <Table.Th w={230}>Setup</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {pageRows.map((row) => {
            const hasError = errorKeys.has(row.key);
            return (
              <Table.Tr
                key={row.key}
                data-testid={`feature-row-${row.key}`}
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
                  <Stack gap={2}>
                    {row.attributes.map((a) => (
                      <Text key={a.code} size="sm" ff="monospace" lh={LINE}>
                        {a.code}
                      </Text>
                    ))}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {row.attributes.map((a) => (
                      <Group key={a.code} h={LINE} align="center">
                        <Badge size="sm" variant="light" color={a.type === 'pim_catalog_metric' ? 'teal' : 'blue'} styles={FULL_LABEL} data-testid="attr-type">
                          {ATTRIBUTE_TYPE_LABELS[a.type]}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <OverrideSelect row={row} project={project} dispatch={dispatch} />
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
