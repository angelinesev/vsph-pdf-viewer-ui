// Side-effect imports: config.js sets window.BROCHURE_SAAS, portal.css is the
// existing shared stylesheet (still used by the panel components below,
// which aren't migrated to MUI — only the nav shell and login are).
// mui-reset.css cancels the handful of portal.css bare-tag properties that
// otherwise leak onto MUI's own native elements, and fonts/inter.css
// self-hosts Inter so the admin app matches the client portal's typography.
import '../shared/config.js';
import '../shared/portal.css';
import '../shared/mui-reset.css';
import '../shared/fonts/inter.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '../shared/theme';
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
