import type { AkeneoUnit, EtimRelease } from '@akeneo-etim/core';
import { Alert, Autocomplete, Badge, Button, Table, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { MEASUREMENT_SUGGESTIONS, suggestUnitMapping, unitSuggestions, type MetricUnitRow } from '../../features/featureRows.js';

const FAMILIES = Object.keys(MEASUREMENT_SUGGESTIONS);

interface RowProps {
  row: MetricUnitRow;
  saved: AkeneoUnit | undefined;
  etimLabels: string[];
  onChange: (mapping: AkeneoUnit | null) => void;
}

function UnitMappingRow({ row, saved, etimLabels, onChange }: RowProps) {
  // Drafts allow a half filled mapping while typing, only complete ones are saved to the project.
  const [family, setFamily] = useState(saved?.family ?? '');
  const [unit, setUnit] = useState(saved?.unit ?? '');

  // Follow the project when it changes from outside, e.g. a loaded project file.
  useEffect(() => {
    if (saved) {
      setFamily(saved.family);
      setUnit(saved.unit);
    }
  }, [saved]);

  const update = (nextFamily: string, nextUnit: string) => {
    setFamily(nextFamily);
    setUnit(nextUnit);
    onChange(nextFamily.trim() && nextUnit.trim() ? { family: nextFamily, unit: nextUnit } : null);
  };
  const suggestion = suggestUnitMapping(etimLabels);
  const incomplete = !row.mapped;

  return (
    <Table.Tr data-testid={`unit-row-${row.unitId}`} style={incomplete ? { background: 'var(--mantine-color-red-light)' } : undefined}>
      <Table.Td ff="monospace">{row.unitId}</Table.Td>
      <Table.Td>{row.label || <Text c="dimmed">No label</Text>}</Table.Td>
      <Table.Td ta="right">{row.featureKeys.length}</Table.Td>
      <Table.Td>
        <Autocomplete
          aria-label={`Measurement family for ${row.unitId}`}
          placeholder="Family code"
          data={FAMILIES}
          value={family}
          onChange={(v) => update(v, unit)}
          size="xs"
          data-testid={`unit-family-${row.unitId}`}
        />
      </Table.Td>
      <Table.Td>
        <Autocomplete
          aria-label={`Akeneo unit for ${row.unitId}`}
          placeholder="Unit code"
          data={unitSuggestions(family)}
          value={unit}
          onChange={(v) => update(family, v)}
          size="xs"
          data-testid={`unit-unit-${row.unitId}`}
        />
      </Table.Td>
      <Table.Td>
        {row.mapped ? (
          <Badge color="green" variant="light">
            Mapped
          </Badge>
        ) : suggestion ? (
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => update(suggestion.family, suggestion.unit)}
            data-testid={`unit-suggest-${row.unitId}`}
          >
            Use {suggestion.family} {suggestion.unit}
          </Button>
        ) : (
          <Badge color="red">Missing</Badge>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

interface Props {
  units: readonly MetricUnitRow[];
  unitMap: Readonly<Record<string, AkeneoUnit>>;
  release: EtimRelease;
  onChange: (unitId: string, mapping: AkeneoUnit | null) => void;
}

/** ETIM unit to Akeneo measurement family and unit, for every unit of a metric attribute. */
export function UnitMappingPanel({ units, unitMap, release, onChange }: Props) {
  const missing = units.filter((u) => !u.mapped).length;
  return (
    <>
      {units.length === 0 ? (
        <Text size="sm" c="dimmed" data-testid="unit-mapping-empty">
          No feature is set up as metric, nothing to map.
        </Text>
      ) : (
        <>
          {missing > 0 && (
            <Alert color="red" variant="light" mb="sm" data-testid="unit-missing">
              {missing === 1 ? '1 unit has' : `${missing} units have`} no mapping yet.
            </Alert>
          )}
          <Table withTableBorder verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={110}>ETIM unit</Table.Th>
                <Table.Th>Label</Table.Th>
                <Table.Th w={90} ta="right">
                  Features
                </Table.Th>
                <Table.Th w={200}>Akeneo family</Table.Th>
                <Table.Th w={200}>Akeneo unit</Table.Th>
                <Table.Th w={220}>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {units.map((row) => (
                <UnitMappingRow
                  key={row.unitId}
                  row={row}
                  saved={unitMap[row.unitId]}
                  etimLabels={Object.values(release.units[row.unitId]?.labels ?? {})}
                  onChange={(mapping) => onChange(row.unitId, mapping)}
                />
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </>
  );
}
