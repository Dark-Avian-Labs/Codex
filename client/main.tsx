import '@fontsource-variable/inter';
import '../packages/core/src/input.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element "#root" was not found in the document.');
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
