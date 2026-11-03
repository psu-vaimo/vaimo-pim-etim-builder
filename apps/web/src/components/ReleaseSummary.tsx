import { Badge, Group } from '@mantine/core';
import type { EtimRelease } from '@akeneo-etim/core';
import { KEEP_CASE } from '../theme.js';
import { StepSummary, SummaryRow } from './StepSummary.js';

/** Counts of the imported ETIM release, in the side column summary. */
export function ReleaseSummary({ release }: { release: EtimRelease }) {
  return (
    <StepSummary>
      <SummaryRow label="Classes" value={Object.keys(release.classes).length} testId="stat-classes" />
      <SummaryRow label="Features" value={Object.keys(release.features).length} testId="stat-features" />
      <SummaryRow label="Values" value={Object.keys(release.values).length} testId="stat-values" />
      <SummaryRow label="Units" value={Object.keys(release.units).length} testId="stat-units" />
      <SummaryRow
        label="Locales"
        value={
          <Group gap={4} justify="flex-end" data-testid="stat-locales">
            {release.locales.map((l) => (
              <Badge key={l} variant="light" size="sm" styles={KEEP_CASE}>
                {l}
              </Badge>
            ))}
          </Group>
        }
      />
    </StepSummary>
  );
}
