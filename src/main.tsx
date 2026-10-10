import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { migrateLegacyKeys } from './lib/storage';
import './styles/global.css';

migrateLegacyKeys();

// HashRouter keeps routing client-side (#/play), so the built site works on any static host.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AuthProvider>
  </StrictMode>,
);
