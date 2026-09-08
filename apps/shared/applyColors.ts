// Pushes colors.ts onto :root as CSS custom properties, so portal.css's
// var(--x) rules stay in sync with the MUI theme without duplicating hex
// values in a second place. Import this once as a side effect before the
// app renders (see main.tsx) — the values in portal.css's :root block are
// just startup fallbacks in case this hasn't run yet.
import { colors } from './colors';

const toCssVarName = (key: string) => `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

for (const [key, value] of Object.entries(colors)) {
  document.documentElement.style.setProperty(toCssVarName(key), value);
}
