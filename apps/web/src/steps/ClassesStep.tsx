import {
  Badge,
  Button,
  Checkbox,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { useDeferredValue, useMemo, useState } from 'react';
import { SubStep } from '../components/SubStep.js';
import { SUB_STEPS } from '../workspace/sections.js';
import { MissingClassesAlert } from '../components/MissingClassesAlert.js';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { DEFAULT_VALUE_INPUT, TEXT_COLORS } from '../theme.js';
import {
  classRows,
  displayLocale,
  filterClassRows,
  groupOptions,
  unmatchedSearchTerms,
  type SelectionFilter,
} from '../state/appState.js';
import { CodeList } from '../components/CodeList.js';

const PAGE_SIZE = 50;

export function ClassesStep() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { release, project } = state;
  const locale = displayLocale(state);

  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionFilter>('all');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(() => (release ? classRows(release, locale) : []), [release, locale]);
  const selected = useMemo(() => new Set(project.classIds), [project.classIds]);
  const groups = useMemo(() => groupOptions(rows), [rows]);
  const filtered = useMemo(
    () => filterClassRows(rows, { search: deferredSearch, groupId, selection }, selected),
    [rows, deferredSearch, groupId, selection, selected],
  );
  const unmatched = useMemo(() => unmatchedSearchTerms(rows, deferredSearch), [rows, deferredSearch]);

  if (!release) return <Text mt="md">Import an ETIM export first.</Text>;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageSelected = pageRows.filter((r) => selected.has(r.id)).length;
  const filteredSelected = filtered.filter((r) => selected.has(r.id)).length;
  const inRelease = project.classIds.filter((id) => release.classes[id] !== undefined).length;
  const isFiltered = filtered.length !== rows.length;

  const setSelected = (ids: string[], value: boolean) => dispatch({ type: 'setClassesSelected', ids, selected: value });
  const resetPage = () => setPage(1);

  return (
    <Stack gap="lg" mt="md">
      <SubStep
        step={SUB_STEPS.locales}
        description="Labels are generated for these locales. Add more languages in step 1.2, Add a language."
        testId="sub-step-locales"
      >
        <Checkbox.Group
          value={project.locales.filter((l) => release.locales.includes(l))}
          onChange={(locales) =>
            dispatch({
              type: 'setProjectLocales',
              // Keep project locales the release does not have, they are listed in the warning below.
              locales: [...locales, ...project.locales.filter((l) => !release.locales.includes(l))],
            })
          }
        >
          <Group gap="lg">
            {release.locales.map((l) => (
              <Checkbox key={l} value={l} label={l} />
            ))}
          </Group>
        </Checkbox.Group>
        <MissingClassesAlert />
      </SubStep>

      <SubStep
        step={SUB_STEPS.classes}
        description="The ETIM classes the client uses. Attributes, records, dependencies and rules are generated for these."
        aside={
          <Badge size="lg" variant="light" data-testid="selected-count">
            {inRelease.toLocaleString('en-US')} of {rows.length.toLocaleString('en-US')} selected
          </Badge>
        }
        testId="sub-step-classes"
      >

        <Group align="flex-end" gap="sm">
          <Textarea
            label="Search"
            description="Paste a list to match any of its lines (or tab, comma or semicolon separated items)"
            placeholder="Class id, group or label in any language"
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              resetPage();
            }}
            autosize
            minRows={1}
            maxRows={6}
            w={320}
            data-testid="class-search"
          />
          <Select
            label="ETIM group"
            placeholder="All groups"
            classNames={{ input: DEFAULT_VALUE_INPUT }}
            data={groups}
            value={groupId}
            onChange={(v) => {
              setGroupId(v);
              resetPage();
            }}
            searchable
            clearable
            w={280}
          />
          <SegmentedControl
            data={[
              { value: 'all', label: 'All' },
              { value: 'selected', label: 'Selected' },
              { value: 'unselected', label: 'Not selected' },
            ]}
            value={selection}
            onChange={(v) => {
              setSelection(v as SelectionFilter);
              resetPage();
            }}
          />
          {release.locales.length > 1 && (
            <Select
              label="Show labels in"
              data={release.locales}
              value={locale ?? null}
              onChange={(v) => v && dispatch({ type: 'setDisplayLocale', locale: v })}
              allowDeselect={false}
              w={130}
            />
          )}
        </Group>

        {unmatched.length > 0 && (
          <div data-testid="class-search-unmatched">
            <Text size="sm" c={TEXT_COLORS.warning}>
              No match for {unmatched.length.toLocaleString('en-US')} of the searched items:
            </Text>
            <CodeList items={unmatched} c={TEXT_COLORS.warning} columnWidth={16} mt={2} />
          </div>
        )}

        <Group gap="xs">
          <Text size="sm" c="dimmed" mr="sm">
            {isFiltered
              ? `${filtered.length.toLocaleString('en-US')} classes match, ${filteredSelected.toLocaleString('en-US')} of them selected`
              : `${rows.length.toLocaleString('en-US')} classes`}
          </Text>
          <Button
            size="xs"
            variant="light"
            disabled={filtered.length === 0 || filteredSelected === filtered.length}
            onClick={() => setSelected(filtered.map((r) => r.id), true)}
            data-testid="select-filtered"
          >
            {isFiltered ? `Select ${filtered.length.toLocaleString('en-US')} matching` : 'Select all'}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="gray"
            disabled={filteredSelected === 0}
            onClick={() => setSelected(filtered.map((r) => r.id), false)}
          >
            {isFiltered ? `Deselect ${filtered.length.toLocaleString('en-US')} matching` : 'Deselect all'}
          </Button>
          {isFiltered && project.classIds.length > 0 && (
            <Button size="xs" variant="default" onClick={() => dispatch({ type: 'setClassIds', ids: [] })}>
              Clear whole selection
            </Button>
          )}
        </Group>

        <Table striped highlightOnHover withTableBorder verticalSpacing={6} data-testid="class-table">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>
                <Checkbox
                  aria-label="Select classes on this page"
                  checked={pageRows.length > 0 && pageSelected === pageRows.length}
                  indeterminate={pageSelected > 0 && pageSelected < pageRows.length}
                  disabled={pageRows.length === 0}
                  onChange={() =>
                    setSelected(
                      pageRows.map((r) => r.id),
                      pageSelected < pageRows.length,
                    )
                  }
                />
              </Table.Th>
              <Table.Th w={120}>Class</Table.Th>
              <Table.Th>Label{locale ? ` (${locale})` : ''}</Table.Th>
              <Table.Th w={260}>Group</Table.Th>
              <Table.Th w={100} ta="right">
                Features
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageRows.map((row) => {
              const isSelected = selected.has(row.id);
              return (
                <Table.Tr
                  key={row.id}
                  style={{ cursor: 'pointer', ...(isSelected ? { background: 'var(--mantine-primary-color-light)' } : {}) }}
                  onClick={() => setSelected([row.id], !isSelected)}
                >
                  <Table.Td>
                    <Checkbox
                      aria-label={`Select ${row.id}`}
                      checked={isSelected}
                      onChange={() => setSelected([row.id], !isSelected)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Table.Td>
                  <Table.Td ff="monospace">{row.id}</Table.Td>
                  <Table.Td>{row.label || <Text c="dimmed">No label</Text>}</Table.Td>
                  <Table.Td>
                    <Text span ff="monospace" size="sm">
                      {row.groupId}
                    </Text>
                    {row.groupLabel && (
                      <Text span size="sm" c="dimmed" ml={6}>
                        {row.groupLabel}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">{row.featureCount}</Table.Td>
                </Table.Tr>
              );
            })}
            {pageRows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">
                    No classes match the filters
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
      </SubStep>
    </Stack>
  );
}
