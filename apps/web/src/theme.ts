import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  CloseButton,
  Combobox,
  Input,
  Menu,
  Pagination,
  Popover,
  SegmentedControl,
  createTheme,
  type CSSVariablesResolver,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';

/**
 * Mantine's dark scale with the background steps (4 to 9) darker, so the body (`dark[7]`), papers and inputs sit on a
 * near black page. Text steps (0 to 3) are unchanged.
 */
const DARK = ['#C9C9C9', '#b8b8b8', '#828282', '#696969', '#383838', '#2c2c2c', '#222222', '#181818', '#121212', '#0b0b0b'] as const;

/** Rounded corners only on controls: inputs, drop downs, drop areas and buttons. Boxes, alerts and tables are square. */
const CONTROL_RADIUS = { defaultProps: { radius: 'sm' } } as const;

/** Fonts from `fonts/fonts.css`, with the system fonts as fallback while they load. */
const SANS = "InterDisplay, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const theme = createTheme({
  colors: { dark: [...DARK] },
  fontFamily: SANS,
  fontFamilyMonospace: "'Meslo LG M', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  headings: { fontFamily: `DINish, ${SANS}` },
  defaultRadius: 0,
  components: {
    Input: Input.extend(CONTROL_RADIUS),
    Checkbox: Checkbox.extend(CONTROL_RADIUS),
    Combobox: Combobox.extend(CONTROL_RADIUS),
    Popover: Popover.extend(CONTROL_RADIUS),
    Menu: Menu.extend(CONTROL_RADIUS),
    Dropzone: Dropzone.extend(CONTROL_RADIUS),
    Button: Button.extend(CONTROL_RADIUS),
    ActionIcon: ActionIcon.extend(CONTROL_RADIUS),
    CloseButton: CloseButton.extend(CONTROL_RADIUS),
    SegmentedControl: SegmentedControl.extend(CONTROL_RADIUS),
    Pagination: Pagination.extend(CONTROL_RADIUS),
    // Pills stay round, their text is lower case.
    Badge: Badge.extend({ defaultProps: { radius: 'xl' }, styles: { label: { textTransform: 'lowercase' } } }),
  },
});

/**
 * Higher text contrast than the Mantine defaults: dimmed text one or two steps darker (lighter in dark mode). Placeholders and
 * idle drop area text (`--app-color-faint`) are faint,
 * and status text colors (`TEXT_COLORS`) dark enough to read on white.
 */
export const cssVariablesResolver: CSSVariablesResolver = (t) => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': t.colors.gray[7],
    '--mantine-color-placeholder': t.colors.gray[4],
    '--app-color-faint': t.colors.gray[5],
    '--app-color-ok': t.colors.teal[9],
    '--app-color-warning': t.colors.orange[9],
    '--app-color-error': t.colors.red[8],
    '--app-color-accent': t.colors.grape[8],
  },
  dark: {
    '--mantine-color-text': t.colors.gray[2],
    '--mantine-color-dimmed': t.colors.dark[0],
    '--mantine-color-placeholder': t.colors.dark[3],
    '--app-color-faint': t.colors.dark[2],
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

/** For pills whose text keeps its case, such as locales (`en_US`). Use as `styles={KEEP_CASE}`. */
export const KEEP_CASE = { label: { textTransform: 'none' } } as const;

/**
 * For inputs whose placeholder names the value used when empty ("Not mapped", "All groups"):
 * shown in the text color so the control looks active, not disabled. Use as `classNames={{ input: DEFAULT_VALUE_INPUT }}`.
 */
export const DEFAULT_VALUE_INPUT = 'default-value-input';

/** For an unstyled select acting as a button ("+ class value"): placeholder in the link color. */
export const ACTION_INPUT = 'action-input';
