import { List, Text, type MantineSize } from '@mantine/core';
import { pairLabelCodes } from '../format/codeLists.js';

interface Props {
  items: readonly string[];
  /** Codes in a monospaced font, the default. */
  mono?: boolean;
  /** Joins a code with its label attribute after it: `ref_ef000013 (and _label)`. */
  labelSuffix?: string;
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
export function CodeList({ items, mono = true, labelSuffix, more = 0, columnWidth, size = 'sm', c, mt, testId }: Props) {
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
      {pairLabelCodes(items, labelSuffix).map(({ code: item, withLabel }, i) => (
        <List.Item key={i}>
          {code(item)}
          {withLabel && (
            <>
              {' (and '}
              {code(labelSuffix!)})
            </>
          )}
        </List.Item>
      ))}
      {more > 0 && <List.Item>and {more.toLocaleString('en-US')} more</List.Item>}
    </List>
  );
}
