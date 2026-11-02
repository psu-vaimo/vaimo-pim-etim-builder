import { Accordion, Badge, Group, ScrollArea, Stack, Text } from '@mantine/core';
import type { EtimTableName, ParseIssue } from '@akeneo-etim/core';
import { useMemo } from 'react';
import { ETIM_TABLES } from '@akeneo-etim/core';
import { TEXT_COLORS } from '../theme.js';

/** Rows rendered per table, real exports can have thousands of warnings. */
const MAX_ROWS = 200;

interface TableIssues {
  table: EtimTableName;
  errors: ParseIssue[];
  warnings: ParseIssue[];
}

function groupByTable(issues: readonly ParseIssue[]): TableIssues[] {
  return ETIM_TABLES.map((table) => {
    const own = issues.filter((i) => i.table === table);
    return {
      table,
      errors: own.filter((i) => i.severity === 'error'),
      warnings: own.filter((i) => i.severity === 'warning'),
    };
  }).filter((g) => g.errors.length + g.warnings.length > 0);
}

export function IssueCounts({ issues }: { issues: readonly ParseIssue[] }) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  if (issues.length === 0) {
    return (
      <Badge color="green" variant="light">
        No issues
      </Badge>
    );
  }
  return (
    <Group gap={4}>
      {errors > 0 && <Badge color="red">{errors === 1 ? '1 error' : `${errors} errors`}</Badge>}
      {warnings > 0 && (
        <Badge color="yellow" variant="light">
          {warnings === 1 ? '1 warning' : `${warnings} warnings`}
        </Badge>
      )}
    </Group>
  );
}

/** Parse issues grouped by table. Tables with errors start expanded. */
export function IssueList({ issues }: { issues: readonly ParseIssue[] }) {
  const groups = useMemo(() => groupByTable(issues), [issues]);
  if (groups.length === 0) return null;
  const withErrors = groups.filter((g) => g.errors.length > 0).map((g) => g.table);

  return (
    <Accordion multiple defaultValue={withErrors} variant="contained" chevronPosition="left">
      {groups.map((g) => {
        const rows = [...g.errors, ...g.warnings];
        return (
          <Accordion.Item key={g.table} value={g.table}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap" pr="sm">
                <Text ff="monospace" size="sm">
                  {g.table}
                </Text>
                <IssueCounts issues={rows} />
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <ScrollArea.Autosize mah={220} type="auto">
                <Stack gap={2}>
                  {rows.slice(0, MAX_ROWS).map((issue, i) => (
                    <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
                      <Text size="xs" fw={700} c={issue.severity === 'error' ? TEXT_COLORS.error : TEXT_COLORS.warning} w={56} style={{ flexShrink: 0 }}>
                        {issue.severity === 'error' ? 'Error' : 'Warning'}
                      </Text>
                      <Text size="xs" c="dimmed" w={64} style={{ flexShrink: 0 }}>
                        {issue.row === undefined ? '' : `row ${issue.row}`}
                      </Text>
                      <Text size="xs" fw={issue.severity === 'error' ? 600 : 400}>
                        {issue.message}
                      </Text>
                    </Group>
                  ))}
                  {rows.length > MAX_ROWS && (
                    <Text size="xs" c="dimmed">
                      {rows.length - MAX_ROWS} more not shown
                    </Text>
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
