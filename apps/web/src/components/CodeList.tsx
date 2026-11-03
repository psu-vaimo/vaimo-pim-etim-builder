import { List, Text, type MantineSize } from '@mantine/core';

interface Props {
  items: readonly string[];
  /** Codes in a monospaced font, the default. */
  mono?: boolean;
  /** Items not shown, added as `and N more`. */
  more?: number;
  /** Long lists flow into columns this wide, in characters. */
  columnWidth?: number;
  size?: MantineSize;
  c?: string | undefined;
  mt?: number | MantineSize | undefined;
  testId?: string | undefined;
}

/** A bulleted list of codes or names, used instead of comma separated prose. */
export function CodeList({ items, mono = true, more = 0, columnWidth, size = 'sm', c, mt, testId }: Props) {
  const code = (s: string) => (mono ? <Text span inherit ff="monospace">{s}</Text> : s);
  return (
    <List
      size={size}
      spacing={0}
      {...(c ? { c } : {})}
      {...(mt !== undefined ? { mt } : {})}
      withPadding
      style={columnWidth ? { columnWidth: `${columnWidth}ch`, columnGap: 'var(--mantine-spacing-lg)' } : undefined}
      data-testid={testId}
    >
      {items.map((item, i) => (
        <List.Item key={i}>{code(item)}</List.Item>
      ))}
      {more > 0 && <List.Item>and {more.toLocaleString('en-US')} more</List.Item>}
    </List>
  );
}
