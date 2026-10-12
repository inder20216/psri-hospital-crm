import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './auth/msalConfig'
import './index.css'
import App from './App.jsx'

// Azure only has http://localhost:5200/ registered as a redirect URI, so a
// visit via 127.0.0.1 would fail sign-in with AADSTS50011. Bounce to localhost.
if (window.location.hostname === '127.0.0.1') {
  window.location.replace(window.location.href.replace('//127.0.0.1', '//localhost'));
} else msalInstance.initialize().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  );
});
