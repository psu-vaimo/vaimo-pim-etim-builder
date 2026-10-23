import { Button, FileButton, Group, TextInput } from '@mantine/core';
import { useState } from 'react';
import { parseProjectFile, projectFileName, serializeProject } from '@akeneo-etim/core';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { SettingsPanel } from './settings/SettingsPanel.js';

/** `loaded` means a project file was read into the app. */
export type ProjectNotice = { kind: 'loaded' | 'loadFailed'; color: 'red' | 'green'; message: string };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Project name, settings, and save and load of the project JSON file. */
export function ProjectBar({ onNotice }: { onNotice: (notice: ProjectNotice) => void }) {
  const { project } = useAppState();
  const dispatch = useAppDispatch();
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function load(file: File | null) {
    if (!file) return;
    const result = parseProjectFile(await file.text());
    if (!result.ok) {
      onNotice({ kind: 'loadFailed', color: 'red', message: `${file.name} could not be loaded. ${result.error}` });
      return;
    }
    dispatch({ type: 'projectLoaded', project: result.project });
    onNotice({ kind: 'loaded', color: 'green', message: `Loaded project ${result.project.name || file.name}.` });
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
      <Button size="xs" variant="default" onClick={() => setSettingsOpen(true)} data-testid="open-settings">
        Settings
      </Button>
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
      <SettingsPanel opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Group>
  );
}
