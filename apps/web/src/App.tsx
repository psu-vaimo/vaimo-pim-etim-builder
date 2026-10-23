import {
  Alert,
  AppShell,
  Box,
  Burger,
  Button,
  Group,
  NavLink,
  ScrollArea,
  SegmentedControl,
  Stack,
  Stepper,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useState } from 'react';
import { ProjectBar, type ProjectNotice } from './components/ProjectBar.js';
import { ClassesStep } from './steps/ClassesStep.js';
import { ExportStep } from './steps/ExportStep.js';
import { FeaturesStep } from './steps/FeaturesStep.js';
import { ImportStep } from './steps/ImportStep.js';
import { MappingStep } from './steps/MappingStep.js';
import { ReviewStep } from './steps/ReviewStep.js';
import { useAppState } from './state/AppStateContext.js';
import { hasSelectedClasses, isReleaseReady } from './state/appState.js';
import { EXPORT_SECTION, SECTIONS, canOpen, guardReason, type StatusTone } from './workspace/sections.js';
import { useSectionStatuses } from './workspace/useSectionStatuses.js';
import { loadMode, saveMode, shouldOfferWorkspace, type ViewMode } from './workspace/viewMode.js';
import './workspace/layout.css';

function StepContent({ index, label }: { index: number; label: string }) {
  return (
    <div className="app-step">
      <StepScreen index={index} label={label} />
    </div>
  );
}

function StepScreen({ index, label }: { index: number; label: string }) {
  if (index === 0) return <ImportStep />;
  if (index === 1) return <ClassesStep />;
  if (index === 2) return <FeaturesStep />;
  if (index === 3) return <MappingStep />;
  if (index === 4) return <ReviewStep />;
  if (index === 5) return <ExportStep />;
  return (
    <Text c="dimmed" mt="md">
      {label}: not built yet.
    </Text>
  );
}

const TONE_COLORS: Record<StatusTone, string> = { ok: 'teal', warning: 'orange', error: 'red', muted: 'dimmed' };

const MODE_OPTIONS = [
  { label: 'Wizard', value: 'wizard' },
  { label: 'Workspace', value: 'workspace' },
];

export function App() {
  const state = useAppState();
  const [active, setActive] = useState(0);
  const [mode, setModeState] = useState<ViewMode>(() => loadMode());
  const [notice, setNotice] = useState<ProjectNotice | undefined>();
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [reachedExport, setReachedExport] = useState(false);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [navOpened, nav] = useDisclosure(false);
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const ready = isReleaseReady(state);
  const hasClasses = hasSelectedClasses(state);
  const guard = { ready, hasClasses };
  const workspace = mode === 'workspace';
  const statuses = useSectionStatuses(state, workspace);

  const setMode = (next: ViewMode) => {
    setModeState(next);
    saveMode(next);
    nav.close();
  };
  // The wizard and the workspace share the section index, so switching mode keeps the current screen.
  const go = (index: number) => {
    if (!canOpen(index, guard)) return;
    setActive(index);
    if (index === EXPORT_SECTION && !workspace) setReachedExport(true);
    nav.close();
  };
  const onNotice = (n: ProjectNotice) => {
    setNotice(n);
    if (n.kind === 'loaded') setProjectLoaded(true);
  };
  const offer = shouldOfferWorkspace({ mode, ready, projectLoaded, reachedExport, dismissed: offerDismissed });
  const current = SECTIONS[active];
  const blocked = guardReason(active, guard);

  return (
    <AppShell
      header={{ height: { base: 132, sm: 96, md: 56 } }}
      {...(workspace ? { navbar: { width: 260, breakpoint: 'sm', collapsed: { mobile: !navOpened } } } : {})}
      padding="md"
    >
      <AppShell.Header>
        <div className="app-header">
          <Group gap="sm" wrap="nowrap" justify="space-between" className="app-header-main">
            <Group gap="xs" wrap="nowrap">
              {workspace && (
                <Burger opened={navOpened} onClick={nav.toggle} hiddenFrom="sm" size="sm" aria-label="Show sections" data-testid="nav-burger" />
              )}
              <Title order={3} className="app-title">
                Akeneo ETIM
              </Title>
            </Group>
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={(value) => setMode(value === 'workspace' ? 'workspace' : 'wizard')}
              data={MODE_OPTIONS}
              aria-label="View mode"
              data-testid="mode-switch"
            />
          </Group>
          <div className="app-project-bar">
            <ProjectBar onNotice={onNotice} />
          </div>
        </div>
      </AppShell.Header>

      {workspace && (
        <AppShell.Navbar p="xs" data-testid="workspace-nav">
          <AppShell.Section grow component={ScrollArea}>
            {SECTIONS.map((section, index) => {
              const status = statuses[index];
              const reason = guardReason(index, guard);
              const link = (
                <NavLink
                  component="button"
                  type="button"
                  active={active === index}
                  disabled={reason !== undefined}
                  aria-disabled={reason !== undefined}
                  aria-current={active === index ? 'page' : undefined}
                  label={`${index + 1}. ${section.label}`}
                  description={
                    status && (
                      <Text component="span" size="xs" c={TONE_COLORS[status.tone]} data-testid={`nav-status-${section.id}`}>
                        {status.text}
                      </Text>
                    )
                  }
                  onClick={() => go(index)}
                  data-testid={`nav-${section.id}`}
                />
              );
              return reason === undefined ? (
                <Box key={section.id}>{link}</Box>
              ) : (
                <Tooltip key={section.id} label={reason} position="right" withArrow events={{ hover: true, focus: true, touch: true }}>
                  <Box>{link}</Box>
                </Tooltip>
              );
            })}
          </AppShell.Section>
        </AppShell.Navbar>
      )}

      <AppShell.Main className="app-main">
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
        {offer && (
          <Alert
            color="blue"
            mb="md"
            withCloseButton
            closeButtonLabel="Not now"
            onClose={() => setOfferDismissed(true)}
            title="Continue in the workspace?"
            data-testid="workspace-offer"
          >
            <Stack gap="xs" align="flex-start">
              <Text size="sm">The workspace shows all sections in a sidebar, so you can open them in any order.</Text>
              <Button size="xs" onClick={() => setMode('workspace')} data-testid="open-workspace">
                Open workspace
              </Button>
            </Stack>
          </Alert>
        )}

        {workspace && current ? (
          <Box data-testid="workspace-section" data-section={current.id}>
            <Title order={2}>{current.label}</Title>
            <Text c="dimmed" size="sm">
              {current.description}
            </Text>
            {blocked ? (
              <Alert color="gray" mt="md" data-testid="workspace-blocked">
                {blocked}.
              </Alert>
            ) : (
              <StepContent index={active} label={current.label} />
            )}
          </Box>
        ) : (
          <>
            <Stepper
              active={active}
              onStepClick={go}
              orientation={narrow ? 'vertical' : 'horizontal'}
              size={narrow ? 'sm' : 'md'}
            >
              {SECTIONS.map((step, index) => (
                <Stepper.Step key={step.id} label={step.label} description={step.description} allowStepSelect={canOpen(index, guard)}>
                  <StepContent index={index} label={step.label} />
                </Stepper.Step>
              ))}
            </Stepper>
            <Group mt="xl">
              <Button variant="default" disabled={active === 0} onClick={() => setActive((s) => Math.max(s - 1, 0))}>
                Back
              </Button>
              <Button disabled={active === SECTIONS.length - 1 || !canOpen(active + 1, guard)} onClick={() => go(active + 1)} data-testid="next">
                Next
              </Button>
              {active === 1 && ready && !hasClasses && (
                <Text size="sm" c="dimmed" data-testid="next-hint">
                  Select at least one class to continue
                </Text>
              )}
            </Group>
          </>
        )}
      </AppShell.Main>
    </AppShell>
  );
}
