import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/newsreader/opsz.css';
import './i18n';
import './styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { UpdatePrompt } from './features/shell/UpdatePrompt';
import { applyTheme, readTheme } from './lib/theme';
import { createAppRouter } from './router';

applyTheme(readTheme());

const queryClient = new QueryClient();
const router = createAppRouter(queryClient);

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element missing');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.PROD && <UpdatePrompt />}
    </QueryClientProvider>
  </StrictMode>,
);
