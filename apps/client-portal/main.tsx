// Side-effect imports: config.js sets window.BROCHURE_SAAS, portal.css is the
// shared stylesheet still used by the analytics dashboard (shared with
// admin-src) and by anything not yet migrated to MUI. mui-reset.css cancels
// the handful of portal.css bare-tag properties (button/input defaults) that
// otherwise leak onto MUI's own native elements. fonts/inter.css self-hosts
// Inter (latin subset only) so the font renders even if Google Fonts is
// blocked, and without @fontsource's full unicode-range bundle.
import '../shared/config.js';
import '../shared/portal.css';
import './mui-reset.css';
import './fonts/inter.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
