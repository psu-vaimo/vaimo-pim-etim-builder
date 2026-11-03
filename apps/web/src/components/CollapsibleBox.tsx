import { Collapse, Group, Paper, Stack, Title, UnstyledButton, type MantineSpacing } from '@mantine/core';
import { useState, type ReactNode } from 'react';
import { ToggleIcon } from './ToggleIcon.js';

interface Props {
  /** A string is shown as a heading, anything else as it is, e.g. a colored count. */
  title: ReactNode;
  /** Right of the title, outside the toggle, e.g. counts or a button. */
  aside?: ReactNode;
  defaultOpen?: boolean;
  /** Padding of the box, `sm` for boxes inside other boxes. */
  p?: MantineSpacing;
  children: ReactNode;
  testId?: string;
}

/**
 * A bordered box that opens and closes from its title, with the round toggle button in front of it. The content is
 * kept mounted while closed.
 */
export function CollapsibleBox({ title, aside, defaultOpen = true, p = 'md', children, testId }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Paper withBorder p={p} data-testid={testId}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <UnstyledButton
          className="toggle-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-testid={testId && `${testId}-toggle`}
          style={{ minWidth: 0 }}
        >
          <Group gap="sm" wrap="nowrap">
            <ToggleIcon open={open} />
            {typeof title === 'string' ? <Title order={4}>{title}</Title> : title}
          </Group>
        </UnstyledButton>
        {aside}
      </Group>
      <Collapse expanded={open}>
        <Stack gap="sm" pt="sm">
          {children}
        </Stack>
      </Collapse>
    </Paper>
  );
}
