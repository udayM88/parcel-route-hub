import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import ClerkAuthProvider from './integrations/clerk/ClerkAuthProvider.tsx'
import './index.css'
import './i18n/i18n'

createRoot(document.getElementById("root")!).render(
  <ClerkAuthProvider>
    <HelmetProvider><App /></HelmetProvider>
  </ClerkAuthProvider>
);
