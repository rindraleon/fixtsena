import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/query-client';
import { installChunkRecovery } from './lib/chunk-recovery';
import './index.css';

installChunkRecovery();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Élément racine #root introuvable dans index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
