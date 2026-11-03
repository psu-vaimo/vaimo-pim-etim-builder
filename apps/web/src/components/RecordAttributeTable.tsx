import { Table, type MantineSize } from '@mantine/core';
import { pairLabelCodes } from '../format/codeLists.js';

interface Props {
  /** Record attribute codes, each value code followed by its label code. */
  codes: readonly string[];
  labelSuffix: string;
  size?: MantineSize;
  testId?: string | undefined;
}

/** Record attributes a reference entity needs, value code and label code side by side so both columns line up. */
export function RecordAttributeTable({ codes, labelSuffix, size = 'sm', testId }: Props) {
  return (
    <Table fz={size} verticalSpacing={2} horizontalSpacing={0} w="auto" mt={4} data-testid={testId}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th fw={600} pr="lg">
            Value code
          </Table.Th>
          <Table.Th fw={600}>
            Value label
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {pairLabelCodes(codes, labelSuffix).map(({ code, withLabel }) => (
          <Table.Tr key={code}>
            <Table.Td ff="monospace" pr="lg">
              {code}
            </Table.Td>
            <Table.Td ff="monospace">{withLabel ? code + labelSuffix : ''}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
