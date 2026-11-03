import { ETIM_FEATURE_TYPES, type EtimFeatureType } from '@vaimo-pim-etim-builder/core';
import { Text } from '@mantine/core';
import { ETIM_TYPE_LABELS } from '../../features/featureRows.js';

/** A column as narrow as its header allows, for short numbers like the class count. */
export const NARROW = { w: '1%', style: { whiteSpace: 'nowrap' } } as const;

/** Unit cell of a feature without a unit: a faint dash. */
export function NoUnit() {
  return (
    <Text size="sm" c="dimmed" opacity={0.5} aria-label="No unit">
      –
    </Text>
  );
}

/** ETIM type letter in bold monospace and its name in regular weight, as in the features by ETIM type table. */
export function EtimTypeLabel({ type }: { type: EtimFeatureType }) {
  return (
    <>
      <Text span inherit ff="monospace" fw={600} mr={6}>
        {type}
      </Text>
      <Text span inherit fw={400}>
        {ETIM_TYPE_LABELS[type]}
      </Text>
    </>
  );
}

/** Segmented control options to filter by ETIM type, `all` first. */
export const ETIM_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  ...ETIM_FEATURE_TYPES.map((t) => ({ value: t, label: <EtimTypeLabel type={t} /> })),
];
