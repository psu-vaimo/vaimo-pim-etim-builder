import { Alert, Button, Code, Group, Text } from '@mantine/core';
import { useMemo } from 'react';
import { missingClassIds, missingLocales } from '@akeneo-etim/core';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';

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
          <Text size="sm" mt={4}>
            {missing.slice(0, MAX_LISTED).map((id) => (
              <Code key={id} mr={4}>
                {id}
              </Code>
            ))}
            {missing.length > MAX_LISTED && `and ${missing.length - MAX_LISTED} more`}
          </Text>
        </>
      )}
      {locales.length > 0 && (
        <Text size="sm" mt={missing.length > 0 ? 'xs' : 0}>
          Project locales without ETIM labels: {locales.join(', ')}. Add these languages in step 1, or deselect them
          in step 2.
        </Text>
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
