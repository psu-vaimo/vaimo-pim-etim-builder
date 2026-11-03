import { SegmentedControl, useMantineColorScheme, type MantineColorScheme } from '@mantine/core';

const OPTIONS: { value: MantineColorScheme; label: string }[] = [
  { value: 'auto', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/** System, dark or light theme. Mantine remembers the choice in localStorage. */
export function ThemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <SegmentedControl
      size="xs"
      className="theme-switch"
      value={colorScheme}
      onChange={(v) => setColorScheme(v as MantineColorScheme)}
      data={OPTIONS}
      aria-label="Theme"
      data-testid="theme-switch"
    />
  );
}
