import { Badge, Group, List, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { isFamilyStep } from '../export/exportFiles.js';
import type { SectionId } from '../workspace/sections.js';
import { openTasks, type StepTask } from '../workspace/stepTasks.js';
import { useStepWork } from '../workspace/useStepWork.js';
import { useAppState } from '../state/AppStateContext.js';
import { TEXT_COLORS } from '../theme.js';

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
        {task.subStep && (
          <Text span inherit c="dimmed" fw={600} mr={6}>
            {task.subStep}
          </Text>
        )}
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

interface Props {
  id: SectionId;
  /** The side column is collapsed: a slim box with the open count. */
  collapsed: boolean;
}

/** The manual work of a step, in a box at the top right of the step: what is done and what is still open. */
export function StepWorkBox({ id, collapsed }: Props) {
  const work = useStepWork(useAppState(), id);
  const open = openTasks(work);
  const statusText = open > 0 ? `${open} to do` : 'All done';
  const status = (
    <Badge color={open > 0 ? 'orange' : 'teal'} variant="light" style={{ flexShrink: 0 }} data-testid="step-work-status">
      {statusText}
    </Badge>
  );

  if (collapsed) {
    return (
      <div className="side-collapsed" data-testid="step-work" data-open={open} data-collapsed>
        <Text fw={700} size="sm" span>
          Tasks
        </Text>
        <Text size="sm" fw={600} span c={open > 0 ? TEXT_COLORS.warning : TEXT_COLORS.ok} data-testid="step-work-status">
          {statusText}
        </Text>
      </div>
    );
  }

  return (
    <Paper
      withBorder
      p="sm"
      w={340}
      maw="100%"
      style={{ flexShrink: 0 }}
      data-testid="step-work"
      data-open={open}
    >
      <Stack gap="xs">
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text fw={700} size="sm">
            Tasks
          </Text>
          {status}
        </Group>
        <List spacing={6} center={false}>
          {work.tasks.map((t) => (
            <TaskRow key={`${t.subStep ?? ''} ${t.label}`} task={t} />
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
