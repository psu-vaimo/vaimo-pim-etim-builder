import type { NumericSetup, RangeSetup } from '@akeneo-etim/core';
import { Radio, SimpleGrid, Stack } from '@mantine/core';

const NUMERIC_OPTIONS: { value: NumericSetup; label: string; description: string }[] = [
  { value: 'number', label: 'Number', description: 'Plain number attribute, the unit is only shown in the label.' },
  {
    value: 'metric',
    label: 'Metric',
    description: 'Akeneo measurement attribute, needs an Akeneo measurement family and unit for every ETIM unit.',
  },
];

const RANGE_OPTIONS: { value: RangeSetup; label: string; description: string }[] = [
  { value: 'text', label: 'One text attribute', description: 'Both values in one text attribute, like 10-20.' },
  { value: 'minmax-number', label: 'Min and max, number', description: 'Two number attributes, code_min and code_max.' },
  {
    value: 'minmax-metric',
    label: 'Min and max, metric',
    description: 'Two metric attributes, code_min and code_max, needs a unit mapping.',
  },
];

interface Props {
  numeric: NumericSetup;
  range: RangeSetup;
  onNumeric: (value: NumericSetup) => void;
  onRange: (value: RangeSetup) => void;
}

/** Project defaults for N and R features, each feature can override them in the table below. */
export function DefaultsPanel({ numeric, range, onNumeric, onRange }: Props) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Radio.Group
          label="Numeric features (N)"
          value={numeric}
          onChange={(v) => onNumeric(v as NumericSetup)}
          data-testid="default-numeric"
        >
          <Stack gap="xs" mt="xs">
            {NUMERIC_OPTIONS.map((o) => (
              <Radio key={o.value} value={o.value} label={o.label} description={o.description} />
            ))}
          </Stack>
        </Radio.Group>
        <Radio.Group
          label="Range features (R)"
          value={range}
          onChange={(v) => onRange(v as RangeSetup)}
          data-testid="default-range"
        >
          <Stack gap="xs" mt="xs">
            {RANGE_OPTIONS.map((o) => (
              <Radio key={o.value} value={o.value} label={o.label} description={o.description} />
            ))}
          </Stack>
        </Radio.Group>
    </SimpleGrid>
  );
}
