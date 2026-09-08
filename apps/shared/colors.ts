const palette = {
  // Page canvas.
  bg: '#EEE8DE',
  // A touch deeper than `bg` — not currently used by any rule, kept for
  // parity with the CSS custom-property list in portal.css's fallback block.
  bgStrong: '#E9E1D3',
  // Primary card surfaces (panels, tables, the login card, modals) — a
  // step lighter than the page canvas, so cards read as floating above it.
  surface: '#F5F1E9',
  // Sidebar / secondary surfaces — a step down from `surface`.
  surfaceAlt: '#E9E1D3',
  // MUI `background.paper` — used by MuiCard and the plan/folder cards.
  paper: '#F5F1E9',
  // Primary ink.
  text: '#211F1C',
  // Secondary text — captions, helper text, table headers. This is what
  // MUI's `text.secondary` resolves to app-wide.
  secondary: '#5F5A52',
  // Muted/tertiary text — the quietest tier (icons-on-chrome, placeholder
  // text, timestamps in fine print). Sits close to the WCAG AA line on
  // these beige surfaces (~4.6:1) — fine for large text and non-text UI,
  // not for body copy, which should use `secondary` instead.
  muted: '#817A70',
  border: '#D3CBBE',
  highlight: '#B5AC9A',
  accent: '#C3B8A7',
  accentHover: '#C3B8A7',
  accentStrong: '#211F1C',
  accentSoft: '#FFFFFF',
  white: '#FFFFFF',
  // Dark brand color — header, primary actions. Also MUI `primary.main`.
  brandDark: '#100E0C',
  primaryMain: '#100E0C',
  primaryLight: '#E3DAC8',
  info: '#5B7088',
  success: '#0f9f6e',
  successSoft: '#ebfff5',
  danger: '#dd3d56',
  dangerSoft: '#fff1f3',
  dangerLight: '#f87171',
  warning: '#d97706',
  // Gradient endpoint for the "warning" meter fill.
  warningLight: '#f59e0b',
  warningSoft: '#fff7ed',
  warningSoftText: '#c2410c',
  createBtnHover: '#1F1D1D',
  socialLinkedin: '#0a66c2',
  socialFacebook: '#1877f2',
  socialWhatsapp: '#25d366',
  sidebarActive: '#D8CEBD',
} as const;

export const colors = {
  ...palette,
  textOnBg: palette.text,
} as const;

export type ColorToken = keyof typeof colors;

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
