import { Button, FileButton, Group, TextInput } from '@mantine/core';
import { parseProjectFile, projectFileName, serializeProject } from '@akeneo-etim/core';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';

export type ProjectNotice = { color: 'red' | 'green'; message: string };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Project name plus save and load of the project JSON file. */
export function ProjectBar({ onNotice }: { onNotice: (notice: ProjectNotice) => void }) {
  const { project } = useAppState();
  const dispatch = useAppDispatch();

  async function load(file: File | null) {
    if (!file) return;
    const result = parseProjectFile(await file.text());
    if (!result.ok) {
      onNotice({ color: 'red', message: `${file.name} could not be loaded. ${result.error}` });
      return;
    }
    dispatch({ type: 'projectLoaded', project: result.project });
    onNotice({ color: 'green', message: `Loaded project ${result.project.name || file.name}.` });
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput
        placeholder="Project name"
        aria-label="Project name"
        value={project.name}
        onChange={(e) => dispatch({ type: 'setProjectName', name: e.currentTarget.value })}
        size="xs"
        w={220}
      />
      <FileButton onChange={(f) => void load(f)} accept="application/json,.json">
        {(props) => (
          <Button {...props} size="xs" variant="default" data-testid="load-project">
            Load project
          </Button>
        )}
      </FileButton>
      <Button size="xs" onClick={() => download(projectFileName(project), serializeProject(project))} data-testid="save-project">
        Save project
      </Button>
    </Group>
  );
}
