import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import './fonts/fonts.css';
import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { cssVariablesResolver, theme } from './theme.js';
import './theme.css';
import { AppStateProvider } from './state/AppStateContext.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MantineProvider>
  </StrictMode>,
);
