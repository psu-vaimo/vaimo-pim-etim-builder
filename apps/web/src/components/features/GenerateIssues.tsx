import type { GenerateIssue } from '@akeneo-etim/core';
import { Accordion, Alert, ScrollArea, Stack, Text } from '@mantine/core';

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

/** Generator issues: errors always visible, warnings collapsed. */
export function GenerateIssues({ issues }: { issues: readonly GenerateIssue[] }) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (issues.length === 0) return null;

  return (
    <Stack gap="sm">
      {errors.length > 0 && (
        <Alert color="red" title={errors.length === 1 ? '1 error' : `${errors.length} errors`} data-testid="generate-errors">
          <IssueRows issues={errors} />
        </Alert>
      )}
      {warnings.length > 0 && (
        <Accordion variant="contained" chevronPosition="left" data-testid="generate-warnings">
          <Accordion.Item value="warnings">
            <Accordion.Control>
              <Text size="sm" c="yellow.8" fw={600}>
                {warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <IssueRows issues={warnings} />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </Stack>
  );
}
