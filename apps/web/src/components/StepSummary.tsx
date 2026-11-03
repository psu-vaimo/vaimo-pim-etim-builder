import { Paper, Table, Text } from '@mantine/core';
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The element in the side column, below the Tasks box, that the open step's summary renders into, and whether the
 * column is collapsed.
 */
export const SummarySlot = createContext<{ element: HTMLElement | null; collapsed: boolean }>({ element: null, collapsed: false });

/** The counts of a step, shown as a light table in the side column. Renders nothing where it is placed. */
export function StepSummary({ children }: { children: ReactNode }) {
  const { element: slot, collapsed } = useContext(SummarySlot);
  if (!slot) return null;
  if (collapsed) {
    return createPortal(
      <div className="side-collapsed" data-testid="step-summary" data-collapsed>
        <Text fw={700} size="sm" span>
          Summary
        </Text>
      </div>,
      slot,
    );
  }
  return createPortal(
    <Paper withBorder p="sm" w={340} maw="100%" data-testid="step-summary">
      <Text fw={700} size="sm" mb={4}>
        Summary
      </Text>
      <Table fz="sm" verticalSpacing={3} horizontalSpacing={0}>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </Paper>,
    slot,
  );
}

interface RowProps {
  label: ReactNode;
  value: number | ReactNode;
  /** Shown before the label in bold monospace, e.g. the ETIM type letter. */
  code?: string;
  /** A breakdown of the row above: indented, dimmed, regular weight. */
  sub?: boolean;
  /** Color of a number above zero, e.g. errors. */
  color?: string;
  testId?: string;
}

export function SummaryRow({ label, value, code, sub, color, testId }: RowProps) {
  const isNumber = typeof value === 'number';
  return (
    <Table.Tr>
      <Table.Td pl={sub ? 'md' : 0} {...(sub ? { c: 'dimmed' } : {})}>
        {code !== undefined && (
          <Text span inherit ff="monospace" fw={600} mr={6}>
            {code}
          </Text>
        )}
        {label}
      </Table.Td>
      <Table.Td
        ta="right"
        pr={0}
        fw={sub ? 400 : 600}
        {...(sub ? { c: 'dimmed' } : {})}
        {...(isNumber && color && value > 0 ? { c: color } : {})}
        data-testid={testId}
      >
        {isNumber ? value.toLocaleString('en-US') : value}
      </Table.Td>
    </Table.Tr>
  );
}
