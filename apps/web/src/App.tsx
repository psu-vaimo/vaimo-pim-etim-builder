import { Alert, AppShell, Button, Group, Stepper, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { ProjectBar, type ProjectNotice } from './components/ProjectBar.js';
import { ClassesStep } from './steps/ClassesStep.js';
import { ImportStep } from './steps/ImportStep.js';
import { useAppState } from './state/AppStateContext.js';
import { isReleaseReady } from './state/appState.js';

/** Setup wizard steps, see CLAUDE.md. Each step becomes its own component. */
const STEPS = [
  { label: 'Import ETIM', description: 'Upload ETIM export and translations' },
  { label: 'Classes', description: 'Select classes and locales' },
  { label: 'Features', description: 'Types, units, ranges' },
  { label: 'Mapping', description: 'Customer source attributes' },
  { label: 'Review', description: 'Attributes, dependencies, rules' },
  { label: 'Export', description: 'Akeneo import files' },
] as const;

function StepContent({ index, label }: { index: number; label: string }) {
  if (index === 0) return <ImportStep />;
  if (index === 1) return <ClassesStep />;
  return (
    <Text c="dimmed" mt="md">
      {label}: not built yet.
    </Text>
  );
}

export function App() {
  const state = useAppState();
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<ProjectNotice | undefined>();
  const ready = isReleaseReady(state);
  // Every step after the import needs a release without errors.
  const canGoTo = (step: number) => step === 0 || ready;

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Title order={3}>Akeneo ETIM</Title>
          <ProjectBar onNotice={setNotice} />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        {notice && (
          <Alert
            color={notice.color}
            mb="md"
            withCloseButton
            onClose={() => setNotice(undefined)}
            data-testid="project-notice"
          >
            {notice.message}
          </Alert>
        )}
        <Stepper active={active} onStepClick={(step) => canGoTo(step) && setActive(step)}>
          {STEPS.map((step, index) => (
            <Stepper.Step key={step.label} label={step.label} description={step.description} allowStepSelect={canGoTo(index)}>
              <StepContent index={index} label={step.label} />
            </Stepper.Step>
          ))}
        </Stepper>
        <Group mt="xl">
          <Button variant="default" disabled={active === 0} onClick={() => setActive((s) => s - 1)}>
            Back
          </Button>
          <Button
            disabled={active === STEPS.length - 1 || !canGoTo(active + 1)}
            onClick={() => setActive((s) => s + 1)}
            data-testid="next"
          >
            Next
          </Button>
        </Group>
      </AppShell.Main>
    </AppShell>
  );
}
