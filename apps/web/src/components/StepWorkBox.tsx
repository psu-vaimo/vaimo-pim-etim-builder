import { ActionIcon, Badge, Group, List, Paper, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { useState } from 'react';
import { isFamilyStep } from '../export/exportFiles.js';
import type { SectionId } from '../workspace/sections.js';
import { openTasks, type StepTask } from '../workspace/stepTasks.js';
import { useStepWork } from '../workspace/useStepWork.js';
import { useAppState } from '../state/AppStateContext.js';
import { TEXT_COLORS } from '../theme.js';
import { loadWorkCollapsed, saveWorkCollapsed } from '../workspace/workCollapsed.js';

/** Done, open, or work the app cannot check (the download, the steps in Akeneo). */
function TaskIcon({ done }: { done: boolean | undefined }) {
  if (done === true) {
    return (
      <ThemeIcon size={18} radius="xl" color="teal" aria-label="Done">
        ✓
      </ThemeIcon>
    );
  }
  if (done === false) {
    return (
      <ThemeIcon size={18} radius="xl" color="orange" aria-label="To do">
        !
      </ThemeIcon>
    );
  }
  return (
    <ThemeIcon size={18} radius="xl" color="blue" variant="outline" aria-label="Reminder, by hand">
      i
    </ThemeIcon>
  );
}

function TaskRow({ task }: { task: StepTask }) {
  return (
    <List.Item icon={<TaskIcon done={task.done} />}>
      <Text size="sm" span {...(task.done ? { td: 'line-through', c: 'dimmed' } : {})}>
        {task.label}
      </Text>
      {task.detail && (
        <Text size="xs" c={task.done === false ? TEXT_COLORS.warning : 'dimmed'}>
          {task.detail}
        </Text>
      )}
    </List.Item>
  );
}

/**
 * The manual work of a step, in a box at the top right of the step: what is done and what is still open.
 * Collapsible to a slim tab with the open count, remembered for the viewer.
 */
export function StepWorkBox({ id }: { id: SectionId }) {
  const work = useStepWork(useAppState(), id);
  const open = openTasks(work);
  const [collapsed, setCollapsed] = useState(loadWorkCollapsed);
  const toggle = () => {
    setCollapsed(!collapsed);
    saveWorkCollapsed(!collapsed);
  };
  const borderColor = open > 0 ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-teal-filled)';
  const statusText = open > 0 ? `${open} to do` : 'All done';
  const status = (
    <Badge color={open > 0 ? 'orange' : 'teal'} variant="light" style={{ flexShrink: 0 }} data-testid="step-work-status">
      {statusText}
    </Badge>
  );

  if (collapsed) {
    return (
      <UnstyledButton
        onClick={toggle}
        aria-expanded={false}
        aria-label="Show manual work"
        className="step-work-collapsed"
        style={{ borderColor }}
        data-testid="step-work"
        data-open={open}
        data-collapsed
      >
        <Text fw={700} size="sm" span>
          ‹ Manual work
        </Text>
        <Text size="sm" fw={600} span c={open > 0 ? TEXT_COLORS.warning : TEXT_COLORS.ok} data-testid="step-work-status">
          {statusText}
        </Text>
      </UnstyledButton>
    );
  }

  return (
    <Paper
      withBorder
      p="sm"
     
      w={340}
      maw="100%"
      style={{ flexShrink: 0, borderColor, borderWidth: 2 }}
      data-testid="step-work"
      data-open={open}
    >
      <Stack gap="xs">
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text fw={700} size="sm">
            Manual work
          </Text>
          <Group gap={4} wrap="nowrap">
            {status}
            <ActionIcon variant="default" size="sm" onClick={toggle} aria-expanded aria-label="Hide manual work" data-testid="step-work-toggle">
              ›
            </ActionIcon>
          </Group>
        </Group>
        <List spacing={6} center={false}>
          {work.tasks.map((t) => (
            <TaskRow key={t.label} task={t} />
          ))}
        </List>
        {work.akeneoSteps.length > 0 && (
          <>
            <Text size="sm" fw={600}>
              Then in Akeneo, in order
            </Text>
            <List type="ordered" size="sm" spacing={4} withPadding data-testid="step-work-akeneo">
              {work.akeneoSteps.map((s) => (
                <List.Item key={s}>
                  {isFamilyStep(s) ? (
                    <Text size="sm" fw={700} span data-testid="family-step">
                      {s}{' '}
                      <Badge color="orange" size="xs">
                        Required
                      </Badge>
                    </Text>
                  ) : (
                    s
                  )}
                </List.Item>
              ))}
            </List>
            <Text size="xs" c="dimmed">
              The same steps are in README.txt in the zip.
            </Text>
          </>
        )}
      </Stack>
    </Paper>
  );
}
