import { createTheme, type CSSVariablesResolver } from '@mantine/core';

export const theme = createTheme({});

/**
 * Higher text contrast than the Mantine defaults: dimmed text and placeholders one or two steps darker (lighter in dark mode),
 * and status text colors (`TEXT_COLORS`) dark enough to read on white.
 */
export const cssVariablesResolver: CSSVariablesResolver = (t) => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': t.colors.gray[7],
    '--mantine-color-placeholder': t.colors.gray[6],
    '--app-color-ok': t.colors.teal[9],
    '--app-color-warning': t.colors.orange[9],
    '--app-color-error': t.colors.red[8],
    '--app-color-accent': t.colors.grape[8],
  },
  dark: {
    '--mantine-color-text': t.colors.gray[2],
    '--mantine-color-dimmed': t.colors.dark[0],
    '--mantine-color-placeholder': t.colors.dark[1],
    '--app-color-ok': t.colors.teal[4],
    '--app-color-warning': t.colors.orange[4],
    '--app-color-error': t.colors.red[4],
    '--app-color-accent': t.colors.grape[4],
  },
});

/** Colors for status text, readable in both color schemes. Use as `c={TEXT_COLORS.warning}`. */
export const TEXT_COLORS = {
  ok: 'var(--app-color-ok)',
  warning: 'var(--app-color-warning)',
  error: 'var(--app-color-error)',
  accent: 'var(--app-color-accent)',
} as const;

/**
 * For inputs whose placeholder names the value used when empty ("Not mapped", "All groups"):
 * shown in the text color so the control looks active, not disabled. Use as `classNames={{ input: DEFAULT_VALUE_INPUT }}`.
 */
export const DEFAULT_VALUE_INPUT = 'default-value-input';

/** For an unstyled select acting as a button ("+ class value"): placeholder in the link color. */
export const ACTION_INPUT = 'action-input';
