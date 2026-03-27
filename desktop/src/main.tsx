import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    ) : (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto' }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Missing Clerk Publishable Key</h1>
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.4 }}>
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>desktop/.env.local</code> and restart the dev server.
        </p>
      </div>
    )}
  </StrictMode>,
);
