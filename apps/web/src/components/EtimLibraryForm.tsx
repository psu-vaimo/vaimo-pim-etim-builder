import { Button, Checkbox, Divider, Group, LoadingOverlay, Select, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { defaultBaseLocale, fetchEtimLibrary, type EtimLibrary, type LibraryLocale } from '../etim/library.js';

interface Props {
  busy: boolean;
  /** Imports `base` and then adds `translations`, all from `release`. */
  onSubmit: (release: string, base: LibraryLocale, translations: LibraryLocale[]) => void;
}

/** Pick a pre-loaded ETIM export from `apps/web/etim-files`. Renders nothing when the folder is empty or not served. */
export function EtimLibraryForm({ busy, onSubmit }: Props) {
  const [library, setLibrary] = useState<EtimLibrary | undefined>();
  const [releaseName, setReleaseName] = useState<string | null>(null);
  const [baseLocale, setBaseLocale] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void fetchEtimLibrary().then((lib) => active && setLibrary(lib));
    return () => {
      active = false;
    };
  }, []);

  const release = library?.releases.find((r) => r.name === releaseName);
  const pickRelease = (name: string | null) => {
    const r = library?.releases.find((x) => x.name === name);
    setReleaseName(name);
    const base = r ? (defaultBaseLocale(r) ?? null) : null;
    setBaseLocale(base);
    setExtra(r ? r.locales.map((l) => l.locale).filter((l) => l !== base) : []);
  };

  if (!library || library.releases.length === 0) return null;

  const base = release?.locales.find((l) => l.locale === baseLocale);
  const others = release?.locales.filter((l) => l.locale !== baseLocale) ?? [];

  return (
    <Stack gap="sm" pos="relative" mb="sm" data-testid="etim-library">
      <Text size="sm" c="dimmed">
        Pick a pre-loaded ETIM export from the app's etim-files folder.
      </Text>
      <LoadingOverlay visible={busy} overlayProps={{ blur: 1 }} loaderProps={{ children: <Text fw={600}>Reading ETIM files...</Text> }} />
      <Group align="flex-end" gap="sm">
        <Select
          label="Release"
          placeholder="Pick a release"
          data={library.releases.map((r) => r.name)}
          value={releaseName}
          onChange={pickRelease}
          w={260}
          data-testid="library-release"
        />
        {release && (
          <Select
            label="Main language"
            data={release.locales.map((l) => l.locale)}
            value={baseLocale}
            onChange={(v) => {
              setBaseLocale(v);
              setExtra((list) => [...new Set([...list.filter((l) => l !== v), ...(baseLocale && baseLocale !== v ? [baseLocale] : [])])]);
            }}
            allowDeselect={false}
            w={160}
            data-testid="library-base-locale"
          />
        )}
      </Group>
      {others.length > 0 && (
        <Checkbox.Group label="Also add languages" value={extra} onChange={setExtra}>
          <Group gap="md" mt={4}>
            {others.map((l) => (
              <Checkbox key={l.locale} value={l.locale} label={l.locale} />
            ))}
          </Group>
        </Checkbox.Group>
      )}
      <Group>
        <Button
          disabled={!release || !base}
          onClick={() => release && base && onSubmit(release.name, base, others.filter((l) => extra.includes(l.locale)))}
          data-testid="library-submit"
        >
          Load ETIM export
        </Button>
      </Group>
      <Divider label="Or upload files" labelPosition="left" />
    </Stack>
  );
}
