import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './state/AuthContext.jsx';
import { PrefsProvider } from './state/PrefsContext.jsx';
import './index.css';

const container = document.getElementById('root');
createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PrefsProvider>
          <App />
        </PrefsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
