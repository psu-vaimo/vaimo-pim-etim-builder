import { Collapse, Group, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { useState, type ReactNode } from 'react';
import type { SubStepInfo } from '../workspace/sections.js';

interface Props {
  step: SubStepInfo;
  description?: ReactNode;
  /** Right of the title, e.g. a count or a button. */
  aside?: ReactNode;
  /** Opens and closes from its title, kept mounted while closed so inputs keep their state. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
  testId?: string;
}

/** A numbered part of a step (1.1, 1.2...): a line above it, the numbered title, a description and the content. */
export function SubStep({ step, description, aside, collapsible = false, defaultOpen = true, children, testId }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const heading = (
    <Title order={4}>
      <Text span inherit c="dimmed" mr={8}>
        {step.number}
      </Text>
      {step.title}
    </Title>
  );
  const body = (
    <Stack gap="sm" pt="sm">
      {description && (
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      )}
      {children}
    </Stack>
  );
  return (
    <section className="sub-step" data-testid={testId}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        {collapsible ? (
          <UnstyledButton onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={testId && `${testId}-toggle`}>
            <Group gap="xs" wrap="nowrap">
              {heading}
              <Text c="dimmed" aria-hidden>
                {open ? '▾' : '▸'}
              </Text>
            </Group>
          </UnstyledButton>
        ) : (
          heading
        )}
        {aside}
      </Group>
      {collapsible ? <Collapse expanded={open}>{body}</Collapse> : body}
    </section>
  );
}
