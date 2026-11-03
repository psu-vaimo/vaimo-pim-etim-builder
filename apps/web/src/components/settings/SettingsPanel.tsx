import { validateSettings, type LabelTexts } from '@akeneo-etim/core';
import {
  Alert,
  Badge,
  Button,
  Code,
  Drawer,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { CODE_FIELDS, GROUP_FIELDS, LABEL_FIELDS, codeExamples, errorsByField, labelTextsFor } from '../../settings/settingsFields.js';
import { useAppDispatch, useAppState } from '../../state/AppStateContext.js';

const MONO = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } };

/**
 * Project settings that change generated codes and labels: code prefixes and
 * entity codes, attribute groups, label words per locale and the rule
 * priority. Changes apply right away, invalid values show inline and block
 * nothing but the export (it reports them as errors).
 */
export function SettingsPanel({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { project } = useAppState();
  const dispatch = useAppDispatch();
  const { settings } = project;
  const [confirmReset, setConfirmReset] = useState(false);
  const issues = useMemo(() => validateSettings(settings), [settings]);
  const errors = errorsByField(issues);
  const examples = codeExamples(settings);
  // Label words for every project locale, en_US when the project has none yet.
  const locales = project.locales.length > 0 ? project.locales : ['en_US'];

  const setLabel = (locale: string, key: keyof LabelTexts, value: string) =>
    dispatch({ type: 'updateSettings', patch: { labelTexts: { [locale]: { [key]: value } } } });

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="xl" title={<Title order={3}>Project settings</Title>}>
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          These settings change generated codes and labels. Defaults follow the prototype, change them only when the client needs other
          codes.
        </Text>

        {issues.length > 0 && (
          <Alert color="red" title={`${issues.length} invalid ${issues.length === 1 ? 'setting' : 'settings'}`} data-testid="settings-errors">
            The export reports these as errors until they are fixed.
          </Alert>
        )}

        <Stack gap="xs">
          <Title order={4}>Codes</Title>
          <Text size="sm" c="dimmed">
            Akeneo codes use letters, digits and underscores only.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {CODE_FIELDS.map((f) => (
              <TextInput
                key={f.key}
                label={f.label}
                description={f.description}
                value={settings.codes[f.key]}
                error={errors[`codes.${f.key}`]}
                onChange={(e) => dispatch({ type: 'updateSettings', patch: { codes: { [f.key]: e.currentTarget.value } } })}
                styles={MONO}
                data-testid={`setting-codes-${f.key}`}
              />
            ))}
          </SimpleGrid>
          <Group gap="xs" mt="xs" data-testid="code-examples">
            {examples.map((e) => (
              <Badge key={e.label} variant="light" color="gray" tt="none" size="lg">
                {e.label} <Code>{e.code}</Code>
              </Badge>
            ))}
          </Group>
        </Stack>

        <Stack gap="xs">
          <Title order={4}>Attribute groups</Title>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {GROUP_FIELDS.map((f) => (
              <TextInput
                key={f.key}
                label={f.label}
                description={f.description}
                value={settings.groups[f.key]}
                error={errors[`groups.${f.key}`]}
                onChange={(e) => dispatch({ type: 'updateSettings', patch: { groups: { [f.key]: e.currentTarget.value } } })}
                styles={MONO}
                data-testid={`setting-groups-${f.key}`}
              />
            ))}
          </SimpleGrid>
        </Stack>

        <Stack gap="xs">
          <Title order={4}>Rules</Title>
          <NumberInput
            label="Rule priority"
            description="Priority of every generated rule"
            value={settings.rulePriority}
            min={0}
            allowDecimal={false}
            allowNegative={false}
            error={errors.rulePriority}
            onChange={(v) => typeof v === 'number' && dispatch({ type: 'updateSettings', patch: { rulePriority: v } })}
            maw={360}
            data-testid="setting-rulePriority"
          />
        </Stack>

        <Stack gap="xs">
          <Title order={4}>Label words</Title>
          <Text size="sm" c="dimmed">
            Words used in generated labels, per project language. Languages without their own words use en_US.
          </Text>
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Word</Table.Th>
                  {locales.map((l) => (
                    <Table.Th key={l}>{l}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {LABEL_FIELDS.map((f) => (
                  <Table.Tr key={f.key}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {f.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {f.description}
                      </Text>
                    </Table.Td>
                    {locales.map((l) => (
                      <Table.Td key={l}>
                        <TextInput
                          size="xs"
                          aria-label={`${f.label} ${l}`}
                          value={labelTextsFor(settings, l)?.[f.key] ?? ''}
                          onChange={(e) => setLabel(l, f.key, e.currentTarget.value)}
                          data-testid={`setting-label-${l}-${f.key}`}
                        />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>

        <Group>
          {confirmReset ? (
            <>
              <Text size="sm">Reset codes, groups, label words and rule priority to the defaults?</Text>
              <Button
                color="red"
                size="xs"
                onClick={() => {
                  dispatch({ type: 'resetNamingSettings' });
                  setConfirmReset(false);
                }}
                data-testid="settings-reset-confirm"
              >
                Reset
              </Button>
              <Button variant="default" size="xs" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="default" size="xs" onClick={() => setConfirmReset(true)} data-testid="settings-reset">
              Reset to defaults
            </Button>
          )}
          <Text size="xs" c="dimmed">
            Number and range defaults and unit mappings are kept, change those in step 3, Configure Features.
          </Text>
        </Group>
      </Stack>
    </Drawer>
  );
}
