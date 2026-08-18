// Side-effect imports: config.js sets window.BROCHURE_SAAS, portal.css is the
// existing shared stylesheet. Importing them (instead of <script>/<link> tags)
// lets Vite bundle them correctly in both dev and the production build.
import '../shared/config.js';
import '../shared/portal.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
