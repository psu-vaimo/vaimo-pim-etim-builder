import { AppShell, Button, Group, Stepper, Text, Title } from '@mantine/core';
import { useState } from 'react';

/** Setup wizard steps, see CLAUDE.md. Each step becomes its own component. */
const STEPS = [
  { label: 'Import ETIM', description: 'Upload ETIM export and translations' },
  { label: 'Classes', description: 'Select classes and locales' },
  { label: 'Features', description: 'Types, units, ranges' },
  { label: 'Mapping', description: 'Customer source attributes' },
  { label: 'Review', description: 'Attributes, dependencies, rules' },
  { label: 'Export', description: 'Akeneo import files' },
] as const;

export function App() {
  const [active, setActive] = useState(0);

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>Akeneo ETIM</Title>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Stepper active={active} onStepClick={setActive}>
          {STEPS.map((step) => (
            <Stepper.Step key={step.label} label={step.label} description={step.description}>
              <Text c="dimmed" mt="md">
                {step.label}: not built yet.
              </Text>
            </Stepper.Step>
          ))}
        </Stepper>
        <Group mt="xl">
          <Button variant="default" disabled={active === 0} onClick={() => setActive((s) => s - 1)}>
            Back
          </Button>
          <Button disabled={active === STEPS.length - 1} onClick={() => setActive((s) => s + 1)}>
            Next
          </Button>
        </Group>
      </AppShell.Main>
    </AppShell>
  );
}
