import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/source-serif-4/opsz.css';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
