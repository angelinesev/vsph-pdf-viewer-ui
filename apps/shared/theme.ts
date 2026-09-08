import { createTheme } from '@mui/material/styles';
import { colors, withAlpha } from './colors';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: colors.primaryMain, dark: colors.text, light: colors.primaryLight, contrastText: colors.white },
    secondary: { main: colors.bg, contrastText: colors.surface },
    info: { main: colors.info, contrastText: colors.white },
    success: { main: colors.success, light: colors.successSoft },
    error: { main: colors.danger, light: colors.dangerSoft },
    warning: { main: colors.warning, light: colors.warningSoft },
    text: { primary: colors.text, secondary: colors.secondary },
    divider: colors.border,
    background: { default: colors.bg, paper: colors.paper },
    action: { hover: withAlpha(colors.border, 0.08), hoverOpacity: 0.08 },
  },
  shape: { borderRadius: 8 },
  // Global typography scale. h1-h3 are intentionally absent: nothing in
  // either app renders variant="h1/h2/h3" — the plain-HTML page title (the
  // actual "H1/Page title") is styled in portal.css instead.
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    // Page title (the "Sign in" heading) — portal.css's bare `h2` rule
    // covers the same role for plain-HTML page headers.
    h4: { fontSize: '22px', fontWeight: 600 },
    // KPI number (StatsRow/StatsOverview cards, analytics KPI tiles).
    h5: { fontSize: '26px', letterSpacing: '-0.5px', fontWeight: 700 },
    // Section title ("Brochures & history", "Organizations", panel headings).
    h6: { letterSpacing: '-0.3px', fontWeight: 600 },
    // Card title (nested card/section headers inside a panel).
    subtitle1: { fontSize: '16px', fontWeight: 600 },
    subtitle2: { fontSize: '15px', fontWeight: 600 },
    // KPI label (the small caps label above a KPI number).
    overline: { fontSize: '11px', letterSpacing: '0.8px', fontWeight: 500 },
    body2: { fontSize: '14px', letterSpacing: 0 },
    // Sidebar/nav item labels.
    caption: { fontSize: '11px', letterSpacing: 0, fontWeight: 500 },
    button: { textTransform: 'none', fontSize: '13px', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999 },
        // Primary actions use the dark brand color, light text.
        containedPrimary: {
          backgroundColor: colors.brandDark,
          color: colors.white,
          '&:hover': { backgroundColor: colors.createBtnHover, color: colors.white },
        },
        outlinedPrimary: {
          backgroundColor: colors.brandDark,
          color: colors.white,
          borderColor: colors.brandDark,
          '&:hover': { backgroundColor: colors.createBtnHover, color: colors.white, borderColor: colors.createBtnHover },
        },
        outlinedInherit: {
          backgroundColor: colors.accent,
          color: colors.text,
          borderColor: colors.accent,
          '&:hover': { backgroundColor: colors.highlight, color: colors.text, borderColor: colors.highlight },
        },
        textPrimary: {
          backgroundColor: colors.brandDark,
          color: colors.white,
          '&:hover': { backgroundColor: colors.createBtnHover, color: colors.white },
        },
        textInherit: {
          backgroundColor: colors.accent,
          color: colors.text,
          '&:hover': { backgroundColor: colors.highlight, color: colors.text },
        },
        // Default desktop button height ~40px; header/compact buttons ~36px.
        sizeMedium: { height: 40, paddingLeft: 20, paddingRight: 20 },
        sizeSmall: { height: 36, paddingLeft: 16, paddingRight: 16 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 999 } },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          // Restrained lift — hierarchy comes mainly from the surface-color
          // step (bg vs surface), not from shadow weight.
          boxShadow: `0 1px 2px ${withAlpha(colors.text, 0.04)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundColor: colors.paper, border: `1px solid ${colors.border}` },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 20, backgroundColor: colors.bg },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.bg },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12 },
        notchedOutline: { borderColor: colors.border },
        input: { '&::placeholder': { color: colors.muted, opacity: 1 } },
      },
    },
    // Metadata pills (file-type, status) — quiet rounded rectangles, not
    // full pills, so they read as metadata rather than a prominent tag.
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, letterSpacing: '0.01em', borderRadius: 10 },
      },
    },
    // Monochrome warm tones on every progress/usage bar, regardless of the
    // `color` prop passed at the call site — urgency is still communicated
    // by the label/number next to it, not by bar color.
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 999, backgroundColor: colors.border },
        colorPrimary: { backgroundColor: colors.border },
        colorSecondary: { backgroundColor: colors.border },
        bar: { backgroundColor: colors.brandDark },
        barColorPrimary: { backgroundColor: colors.brandDark },
        barColorSecondary: { backgroundColor: colors.brandDark },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${colors.border}` },
        head: {
          textTransform: 'uppercase',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: colors.muted,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: `0 8px 24px ${withAlpha(colors.text, 0.05)}`,
          borderBottom: `1px solid ${colors.border}`,
        },
      },
    },
    // "Rows per page" / "1–10 of 23" — MUI's own default color here isn't
    // guaranteed to land on a value we've contrast-checked.
    MuiTablePagination: {
      styleOverrides: {
        selectLabel: { color: colors.muted },
        displayedRows: { color: colors.muted },
      },
    },
  },
});
