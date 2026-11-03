import { Alert, Button, Group, Text } from '@mantine/core';
import { useMemo } from 'react';
import { missingClassIds, missingLocales } from '@akeneo-etim/core';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { CodeList } from './CodeList.js';

const MAX_LISTED = 50;

/** Warns about project classes and locales that the loaded release does not have. */
export function MissingClassesAlert() {
  const { project, release } = useAppState();
  const dispatch = useAppDispatch();
  const missing = useMemo(() => (release ? missingClassIds(project, release) : []), [project, release]);
  const locales = useMemo(() => (release ? missingLocales(project, release) : []), [project, release]);
  if (!release || (missing.length === 0 && locales.length === 0)) return null;

  return (
    <Alert color="yellow" title="The project does not match the ETIM release" data-testid="missing-alert">
      {missing.length > 0 && (
        <>
          <Text size="sm">
            {missing.length === 1 ? '1 selected class is' : `${missing.length} selected classes are`} not in the
            release:
          </Text>
          <CodeList items={missing.slice(0, MAX_LISTED)} more={Math.max(0, missing.length - MAX_LISTED)} columnWidth={14} mt={4} />
        </>
      )}
      {locales.length > 0 && (
        <Text size="sm" mt={missing.length > 0 ? 'xs' : 0}>
          Project locales without ETIM labels, add these languages in step 1, Setup ETIM versions, or deselect them in step 2, Select Classes:
        </Text>
      )}
      {locales.length > 0 && (
        <CodeList items={locales} mt={2} />
      )}
      {missing.length > 0 && (
        <Group mt="xs">
          <Button
            size="xs"
            variant="light"
            color="yellow"
            onClick={() => dispatch({ type: 'setClassesSelected', ids: missing, selected: false })}
          >
            Remove missing classes from the project
          </Button>
        </Group>
      )}
    </Alert>
  );
}
