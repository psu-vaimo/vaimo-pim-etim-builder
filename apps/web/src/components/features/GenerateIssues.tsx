import type { GenerateIssue } from '@vaimo-pim-etim-builder/core';
import { ScrollArea, Stack, Text } from '@mantine/core';
import { CollapsibleBox } from '../CollapsibleBox.js';
import { TEXT_COLORS } from '../../theme.js';

/** Rows rendered per list, a big selection can give thousands of warnings. */
const MAX_ROWS = 200;

function IssueRows({ issues }: { issues: readonly GenerateIssue[] }) {
  return (
    <ScrollArea.Autosize mah={220} type="auto">
      <Stack gap={2}>
        {issues.slice(0, MAX_ROWS).map((issue, i) => (
          <Text key={i} size="xs">
            {issue.message}
          </Text>
        ))}
        {issues.length > MAX_ROWS && (
          <Text size="xs" c="dimmed">
            {issues.length - MAX_ROWS} more not shown
          </Text>
        )}
      </Stack>
    </ScrollArea.Autosize>
  );
}

/** Generator issues, in collapsible boxes: errors open, warnings closed. */
export function GenerateIssues({ issues }: { issues: readonly GenerateIssue[] }) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (issues.length === 0) return null;

  return (
    <Stack gap="sm">
      {errors.length > 0 && (
        <CollapsibleBox title={<IssueTitle color={TEXT_COLORS.error} count={errors.length} word="error" />} testId="generate-errors">
          <IssueRows issues={errors} />
        </CollapsibleBox>
      )}
      {warnings.length > 0 && (
        <CollapsibleBox
          title={<IssueTitle color={TEXT_COLORS.warning} count={warnings.length} word="warning" />}
          defaultOpen={false}
          testId="generate-warnings"
        >
          <IssueRows issues={warnings} />
        </CollapsibleBox>
      )}
    </Stack>
  );
}

function IssueTitle({ color, count, word }: { color: string; count: number; word: string }) {
  return (
    <Text fw={700} c={color}>
      {count === 1 ? `1 ${word}` : `${count.toLocaleString('en-US')} ${word}s`}
    </Text>
  );
}
