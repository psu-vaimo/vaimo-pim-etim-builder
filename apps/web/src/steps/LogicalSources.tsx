import {
  collectLogicalSources,
  labelFor,
  parseAkeneoOptionExport,
  type EtimRelease,
  type LogicalSourceOption,
  type LogicalSourcePlan,
  type Project,
} from '@akeneo-etim/core';
import { ActionIcon, Alert, Badge, Button, Checkbox, Group, Pagination, Paper, ScrollArea, Stack, Table, Text, TextInput, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { memo, useDeferredValue, useMemo, useState, type Dispatch } from 'react';
import { codeError } from '../mapping/sourceMappings.js';
import { SubStep } from '../components/SubStep.js';
import { SUB_STEPS } from '../workspace/sections.js';
import type { AppAction } from '../state/appState.js';
import { TEXT_COLORS } from '../theme.js';
import { providesText } from '../format/sourceEntityText.js';

type AppDispatch = Dispatch<AppAction>;

const PAGE_SIZE = 25;

/** What an option export upload did, shown above the sources. */
interface UploadNote {
  color: 'red' | 'yellow' | 'blue';
  message: string;
}

interface Props {
  release: EtimRelease;
  project: Project;
  locale: string | undefined;
  dispatch: AppDispatch;
}

/** The client attributes providing L features: per source value, whether it means yes for each feature. */
export function LogicalSources({ release, project, locale, dispatch }: Props) {
  const plans = useMemo(() => collectLogicalSources(release, project), [release, project]);
  const [uploadNotes, setUploadNotes] = useState<UploadNote[]>([]);

  async function upload(file: File) {
    const parsed = parseAkeneoOptionExport(new Uint8Array(await file.arrayBuffer()), file.name);
    const used = Object.fromEntries(Object.entries(parsed.options).filter(([attribute]) => plans.some((p) => p.attribute === attribute)));
    const count = Object.keys(used).length;
    const notes: UploadNote[] = parsed.issues.map((i) => ({ color: i.severity === 'error' ? 'red' : 'yellow', message: i.message }));
    if (Object.keys(parsed.options).length > 0) {
      notes.push(
        count === 0
          ? { color: 'yellow', message: `${file.name} has no options for the sources of L features (${plans.map((p) => p.attribute).join(', ')})` }
          : { color: 'blue', message: `Values read for ${count === 1 ? '1 source' : `${count} sources`}: ${Object.keys(used).join(', ')}` },
      );
    }
    setUploadNotes(notes);
    if (count > 0) dispatch({ type: 'replaceSourceOptions', options: used });
  }

  return (
    <SubStep
      step={SUB_STEPS.sourceValues}
      description="A client attribute provides L (logical) features: a Yes/No attribute is copied, for another attribute, such as a simple select, tick the values meaning yes per feature. Any other value sets the feature to false, an empty source leaves it empty. Upload the Akeneo attribute option export to list the values, or add them by hand. Click a source attribute to open it."
      testId="logical-sources"
    >
      {plans.length === 0 ? (
        <Alert color="gray" data-testid="logical-empty">
          No source attribute provides an L feature yet. Map L features in step 4.2, Map features.
        </Alert>
      ) : (
        <>
          <Dropzone
            onDrop={(files) => files[0] && void upload(files[0])}
            multiple={false}
            accept={['.xlsx', '.csv', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']}
            p="xs"
            data-testid="options-dropzone"
          >
            <Text ta="center" size="sm" fw={600} style={{ pointerEvents: 'none' }}>
              Drop the Akeneo attribute option export (XLSX or CSV) to list the values of these sources, or click to choose. It replaces
              the listed values of the attributes in the file, ticked yes values are kept.
            </Text>
          </Dropzone>
          {uploadNotes.map((note, i) => (
            <Alert key={i} color={note.color} p="xs">
              <Text size="sm">{note.message}</Text>
            </Alert>
          ))}
          {plans.map((plan) => (
            <SourcePanel key={plan.attribute} plan={plan} release={release} locale={locale} dispatch={dispatch} />
          ))}
        </>
      )}
    </SubStep>
  );
}

interface PanelProps {
  plan: LogicalSourcePlan;
  release: EtimRelease;
  locale: string | undefined;
  dispatch: AppDispatch;
}

const valuesText = (n: number) => (n === 1 ? '1 value' : `${n.toLocaleString('en-US')} values`);

/** One source attribute, collapsed by default: its values and a yes tick per value and feature. */
const SourcePanel = memo(function SourcePanel({ plan, release, locale, dispatch }: PanelProps) {
  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const typedBoolean = plan.type === 'pim_catalog_boolean';
  const openFeatures = plan.boolean ? 0 : plan.features.filter((f) => f.yesValues.length === 0).length;

  const filtered = useMemo(() => {
    const words = deferredSearch.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return plan.options;
    return plan.options.filter((o) => {
      const text = [o.code, ...Object.values(o.labels)].join('\n').toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [plan.options, deferredSearch]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const newCodeTrimmed = newCode.trim();
  const newCodeError =
    codeError(newCodeTrimmed) ?? (plan.options.some((o) => o.code === newCodeTrimmed) ? `${newCodeTrimmed} already exists` : undefined);
  function addValue() {
    if (newCodeTrimmed === '' || newCodeError) return;
    dispatch({ type: 'addSourceOption', attribute: plan.attribute, option: { code: newCodeTrimmed, labels: {} } });
    setNewCode('');
  }

  return (
    <Paper withBorder p="md" data-testid={`logical-${plan.attribute}`}>
      <Stack gap="sm">
        <UnstyledButton onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`logical-toggle-${plan.attribute}`}>
          <Group gap="xs">
            <Text c="dimmed" w={14} aria-hidden>
              {open ? '▾' : '▸'}
            </Text>
            <Title order={4} ff="monospace">
              {plan.attribute}
            </Title>
            {plan.type && (
              <Badge variant="light" color="gray">
                {plan.type}
              </Badge>
            )}
            <Badge variant="light" color={plan.boolean ? 'gray' : 'blue'} data-testid="logical-values">
              {plan.boolean ? 'copied as Yes/No' : valuesText(plan.options.length)}
            </Badge>
            <Badge variant="light" color={openFeatures === 0 ? 'teal' : 'orange'} data-testid="logical-provides">
              {providesText(plan.features.length)}
            </Badge>
          </Group>
        </UnstyledButton>
        {open && (
          <>
            {typedBoolean ? (
              <Text size="sm" data-testid="logical-boolean">
                A Yes/No attribute, copied as is to {plan.features.map((f) => f.key.toLowerCase()).join(', ')}.
              </Text>
            ) : (
              <>
                {plan.boolean && (
                  <Alert color="gray" p="xs" data-testid="logical-no-values">
                    <Text size="sm">
                      No values listed, so the source is copied as a Yes/No attribute. If it is a select or text attribute, upload the
                      attribute option export or add its values, and tick the ones meaning yes.
                    </Text>
                  </Alert>
                )}
                {openFeatures > 0 && (
                  <Text size="sm" c={TEXT_COLORS.warning}>
                    Tick at least one yes value for each feature, without one the source is copied as if it were a Yes/No attribute.
                  </Text>
                )}
                <Group align="flex-end" gap="sm">
                  <TextInput
                    label="Add value"
                    placeholder="option_code"
                    value={newCode}
                    error={newCodeTrimmed !== '' ? newCodeError : undefined}
                    onChange={(e) => setNewCode(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addValue()}
                    w={200}
                    data-testid="option-new-code"
                  />
                  <Button variant="light" onClick={addValue} disabled={newCodeTrimmed === '' || newCodeError !== undefined} data-testid="option-add">
                    Add
                  </Button>
                  {plan.options.length > PAGE_SIZE && (
                    <TextInput
                      placeholder="Search values"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.currentTarget.value);
                        setPage(1);
                      }}
                      w={260}
                      ml="auto"
                      data-testid="options-search"
                    />
                  )}
                </Group>
                {plan.options.length > 0 && (
                  <>
                    <ScrollArea type="auto">
                      <Table withTableBorder verticalSpacing={4} data-testid="options-table">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th miw={180}>Source value</Table.Th>
                            {plan.features.map((f) => (
                              <Table.Th key={f.key} miw={180}>
                                <Text size="sm" fw={600} ff="monospace">
                                  {f.key}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {labelFor(release.features[f.featureId]?.labels ?? {}, locale)}
                                </Text>
                                <Text size="xs" c={f.yesValues.length > 0 ? TEXT_COLORS.ok : TEXT_COLORS.warning} data-testid={`yes-count-${f.key}`}>
                                  {f.yesValues.length === 0 ? 'No yes value' : `${f.yesValues.length.toLocaleString('en-US')} yes, others false`}
                                </Text>
                              </Table.Th>
                            ))}
                            <Table.Th w={40} />
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rows.map((option) => (
                            <OptionRow key={option.code} option={option} plan={plan} locale={locale} dispatch={dispatch} />
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                    {totalPages > 1 && <Pagination total={totalPages} value={currentPage} onChange={setPage} size="sm" />}
                  </>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
});

interface RowProps {
  option: LogicalSourceOption;
  plan: LogicalSourcePlan;
  locale: string | undefined;
  dispatch: AppDispatch;
}

function OptionRow({ option, plan, locale, dispatch }: RowProps) {
  return (
    <Table.Tr data-testid={`option-${option.code}`}>
      <Table.Td>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" ff="monospace">
            {option.code}
          </Text>
          {!option.listed && (
            <Tooltip label="A yes value that is not in the listed values of the attribute">
              <Badge size="xs" variant="light" color="orange">
                not listed
              </Badge>
            </Tooltip>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {labelFor(option.labels, locale)}
        </Text>
      </Table.Td>
      {plan.features.map((f) => (
        <Table.Td key={f.key}>
          <Checkbox
            label="Yes"
            size="xs"
            checked={f.yesValues.includes(option.code)}
            onChange={(e) => dispatch({ type: 'setYesValue', key: f.key, value: option.code, yes: e.currentTarget.checked })}
            data-testid={`yes-${option.code}-${f.key}`}
          />
        </Table.Td>
      ))}
      <Table.Td>
        <Tooltip label="Remove value">
          <ActionIcon
            variant="default"
            aria-label="Remove value"
            onClick={() => dispatch({ type: 'removeSourceOption', attribute: plan.attribute, code: option.code })}
            data-testid={`option-remove-${option.code}`}
          >
            ×
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );
}
