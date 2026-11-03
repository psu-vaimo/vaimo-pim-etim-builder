import { Group, Text, Title, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Shown after the title, e.g. a count while collapsed. */
  aside?: ReactNode;
  testId?: string;
}

/** Title of a box that opens and closes, with a ▸/▾ arrow, like the reference entity panels. */
export function CollapsibleTitle({ title, open, onToggle, aside, testId }: Props) {
  return (
    <UnstyledButton onClick={onToggle} aria-expanded={open} data-testid={testId}>
      <Group gap="xs">
        <Text c="dimmed" w={14} aria-hidden>
          {open ? '▾' : '▸'}
        </Text>
        <Title order={4}>{title}</Title>
        {aside}
      </Group>
    </UnstyledButton>
  );
}
