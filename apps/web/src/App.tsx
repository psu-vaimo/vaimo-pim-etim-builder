import {
  Alert,
  AppShell,
  Box,
  Burger,
  Button,
  Group,
  NavLink,
  ScrollArea,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { ProjectBar, type ProjectNotice } from './components/ProjectBar.js';
import { ClassesStep } from './steps/ClassesStep.js';
import { ExportStep } from './steps/ExportStep.js';
import { FeaturesStep } from './steps/FeaturesStep.js';
import { ImportStep } from './steps/ImportStep.js';
import { MappingStep } from './steps/MappingStep.js';
import { RecordsStep } from './steps/RecordsStep.js';
import { ReviewStep } from './steps/ReviewStep.js';
import { useAppState } from './state/AppStateContext.js';
import { hasSelectedClasses, isReleaseReady } from './state/appState.js';
import { SECTIONS, canOpen, guardReason, type StatusTone } from './workspace/sections.js';
import { useSectionStatuses } from './workspace/useSectionStatuses.js';
import './workspace/layout.css';
import { TEXT_COLORS } from './theme.js';
import { StepWorkBox } from './components/StepWorkBox.js';

function StepContent({ index, label }: { index: number; label: string }) {
  return (
    <div className="app-step">
      <StepScreen index={index} label={label} />
    </div>
  );
}

function StepScreen({ index, label }: { index: number; label: string }) {
  switch (SECTIONS[index]?.id) {
    case 'import':
      return <ImportStep />;
    case 'classes':
      return <ClassesStep />;
    case 'features':
      return <FeaturesStep />;
    case 'mapping':
      return <MappingStep />;
    case 'records':
      return <RecordsStep />;
    case 'review':
      return <ReviewStep />;
    case 'export':
      return <ExportStep />;
    default:
      return (
        <Text c="dimmed" mt="md">
          {label}: not built yet.
        </Text>
      );
  }
}

/** Step names in the sidebar, heavier than their status line. */
const NAV_LABEL = { label: { fontWeight: 600 } } as const;

const TONE_COLORS: Record<StatusTone, string> = { ok: TEXT_COLORS.ok, warning: TEXT_COLORS.warning, error: TEXT_COLORS.error, muted: 'dimmed' };

export function App() {
  const state = useAppState();
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<ProjectNotice | undefined>();
  const [navOpened, nav] = useDisclosure(false);
  const ready = isReleaseReady(state);
  const hasClasses = hasSelectedClasses(state);
  const guard = { ready, hasClasses };
  const statuses = useSectionStatuses(state);

  const go = (index: number) => {
    if (!canOpen(index, guard)) return;
    setActive(index);
    nav.close();
  };
  const current = SECTIONS[active];
  const blocked = guardReason(active, guard);
  const next = active + 1 < SECTIONS.length && canOpen(active + 1, guard) ? active + 1 : undefined;

  return (
    <AppShell
      header={{ height: { base: 132, sm: 96, md: 56 } }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <div className="app-header">
          <Group gap="xs" wrap="nowrap" className="app-header-main">
            <Burger opened={navOpened} onClick={nav.toggle} hiddenFrom="sm" size="sm" aria-label="Show steps" data-testid="nav-burger" />
            <Title order={3} className="app-title">
              Akeneo ETIM
            </Title>
          </Group>
          <div className="app-project-bar">
            <ProjectBar onNotice={setNotice} />
          </div>
        </div>
      </AppShell.Header>

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
                leftSection={<StepNumber n={index + 1} active={active === index} />}
                label={section.label}
                styles={NAV_LABEL}
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
              <Box key={section.id} className="nav-step">{link}</Box>
            ) : (
              <Tooltip key={section.id} label={reason} position="right" withArrow events={{ hover: true, focus: true, touch: true }}>
                <Box className="nav-step">{link}</Box>
              </Tooltip>
            );
          })}
        </AppShell.Section>
      </AppShell.Navbar>

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

        {current && (
          <Box data-testid="workspace-section" data-section={current.id}>
            <Title order={2}>
              {active + 1}. {current.label}
            </Title>
            <Text c="dimmed" size="sm">
              {current.description}
            </Text>
            <div className="step-layout">
              <div className="step-layout-main">
                {blocked ? (
                  <Alert color="gray" mt="md" data-testid="workspace-blocked">
                    {blocked}.
                  </Alert>
                ) : (
                  <>
                    <StepContent index={active} label={current.label} />
                    {next !== undefined && (
                      <Group mt="xl">
                        <Button variant="light" onClick={() => go(next)} data-testid="next">
                          Next: {next + 1}. {SECTIONS[next]!.label}
                        </Button>
                      </Group>
                    )}
                  </>
                )}
              </div>
              {!blocked && (
                <div className="step-layout-aside">
                  <StepWorkBox id={current.id} />
                </div>
              )}
            </div>
          </Box>
        )}
      </AppShell.Main>
    </AppShell>
  );
}

/** Step number in the sidebar, filled for the open step. */
function StepNumber({ n, active }: { n: number; active: boolean }) {
  return (
    <ThemeIcon size={22} radius="xl" variant={active ? 'filled' : 'light'} color={active ? 'blue' : 'gray'} aria-hidden>
      <Text size="xs" fw={700} span>
        {n}
      </Text>
    </ThemeIcon>
  );
}
