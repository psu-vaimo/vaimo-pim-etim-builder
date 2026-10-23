import { Badge, Group, Paper, SimpleGrid, Text } from '@mantine/core';
import type { EtimRelease } from '@akeneo-etim/core';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} data-testid={`stat-${label.toLowerCase()}`}>
        {value.toLocaleString('en-US')}
      </Text>
    </Paper>
  );
}

export function ReleaseSummary({ release }: { release: EtimRelease }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
      <Stat label="Classes" value={Object.keys(release.classes).length} />
      <Stat label="Features" value={Object.keys(release.features).length} />
      <Stat label="Values" value={Object.keys(release.values).length} />
      <Stat label="Units" value={Object.keys(release.units).length} />
      <Paper withBorder p="sm" radius="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          Locales
        </Text>
        <Group gap={4} mt={6} data-testid="stat-locales">
          {release.locales.map((l) => (
            <Badge key={l} variant="light">
              {l}
            </Badge>
          ))}
        </Group>
      </Paper>
    </SimpleGrid>
  );
}
