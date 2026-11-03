import { Button, FileButton, Group, TextInput } from '@mantine/core';
import { useState } from 'react';
import { parseProjectFile, projectFileName, serializeProject } from '@akeneo-etim/core';
import { importLibraryRelease, planEtimReload } from '../etim/importLibrary.js';
import { fetchEtimLibrary } from '../etim/library.js';
import { useAppDispatch, useAppState } from '../state/AppStateContext.js';
import { SettingsPanel } from './settings/SettingsPanel.js';

/** `loaded` means a project file was read into the app, `importing` that its ETIM export is being imported. */
export type ProjectNotice = { kind: 'loaded' | 'importing' | 'loadFailed'; color: 'red' | 'green' | 'blue' | 'orange'; message: string };

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
  const state = useAppState();
  const { project } = state;
  const dispatch = useAppDispatch();
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function load(file: File | null) {
    if (!file) return;
    const result = parseProjectFile(await file.text());
    if (!result.ok) {
      onNotice({ kind: 'loadFailed', color: 'red', message: `${file.name} could not be loaded. ${result.error}` });
      return;
    }
    const name = result.project.name || file.name;
    const loaded = state.release ? state.project.etimSource : undefined;
    dispatch({ type: 'projectLoaded', project: result.project });

    // The project file holds no ETIM data, import the export it was built on.
    const plan = planEtimReload(result.project.etimSource, loaded, result.project.etimSource?.library ? await fetchEtimLibrary() : { releases: [] });
    if (plan.kind === 'none') {
      const hint = state.release || result.project.etimSource ? '' : ' The file does not say which ETIM export it uses, import one to continue.';
      onNotice({ kind: 'loaded', color: hint ? 'orange' : 'green', message: `Loaded project ${name}.${hint}` });
      return;
    }
    if (plan.kind === 'manual') {
      onNotice({ kind: 'loaded', color: 'orange', message: `Loaded project ${name}. ${plan.reason}` });
      return;
    }
    const locales = [plan.base, ...plan.translations].map((l) => l.locale).join(', ');
    onNotice({ kind: 'importing', color: 'blue', message: `Loaded project ${name}, importing ETIM export ${plan.release} (${locales})...` });
    try {
      const ok = await importLibraryRelease(dispatch, plan.release, plan.base, plan.translations);
      const missing = plan.missing.length > 0 ? ` ${plan.missing.join(', ')} ${plan.missing.length === 1 ? 'is' : 'are'} not in the etim-files folder, add ${plan.missing.length === 1 ? 'it' : 'them'} in step 1, Setup ETIM versions.` : '';
      onNotice(
        ok
          ? { kind: 'loaded', color: missing ? 'orange' : 'green', message: `Loaded project ${name} with ETIM export ${plan.release} (${locales}).${missing}` }
          : { kind: 'loaded', color: 'red', message: `Loaded project ${name}, but ETIM export ${plan.release} has errors. See step 1, Setup ETIM versions.` },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      onNotice({ kind: 'loaded', color: 'red', message: `Loaded project ${name}, but ETIM export ${plan.release} could not be imported. ${reason}` });
    }
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
