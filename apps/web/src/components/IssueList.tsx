import { Badge, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { CollapsibleBox } from './CollapsibleBox.js';
import type { EtimTableName, ParseIssue } from '@vaimo-pim-etim-builder/core';
import { useMemo } from 'react';
import { ETIM_TABLES } from '@vaimo-pim-etim-builder/core';
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

/** Parse issues grouped by table, in collapsible boxes. Tables with errors start open. */
export function IssueList({ issues }: { issues: readonly ParseIssue[] }) {
  const groups = useMemo(() => groupByTable(issues), [issues]);
  if (groups.length === 0) return null;

  return (
    <Stack gap="xs">
      {groups.map((g) => {
        const rows = [...g.errors, ...g.warnings];
        return (
          <CollapsibleBox
            key={g.table}
            title={
              <Text ff="monospace" size="sm">
                {g.table}
              </Text>
            }
            aside={<IssueCounts issues={rows} />}
            defaultOpen={g.errors.length > 0}
            p="sm"
          >
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
          </CollapsibleBox>
        );
      })}
    </Stack>
  );
}
