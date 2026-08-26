import { createTheme } from '@mui/material/styles';

// Palette and shape values pulled from app.flipsnack.com's actual computed
// styles (their real dashboard, not a screenshot approximation): primary
// blue #0362fc, 8px button radius, MUI's stock 4px/rgba(0,0,0,0.23) input
// border, #d5d5d5 neutral borders, and flat surfaces — no gradients, no
// button shadows.
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0362fc', dark: '#0250d1', light: '#e8f0fe', contrastText: '#ffffff' },
    success: { main: '#0f9f6e', light: '#ebfff5' },
    error: { main: '#dd3d56', light: '#fff1f3' },
    warning: { main: '#d97706', light: '#fff7ed' },
    // secondary is darkened from a typical #6b7280 (~3.55:1 on white, fails
    // WCAG AA) to #57606f (~6.35:1) so muted text/dates/axis labels stay
    // legible without losing the cool gray tone.
    text: { primary: '#131416', secondary: '#57606f' },
    divider: '#e5e5e5',
    background: { default: '#f7f7f7', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500, boxShadow: 'none' },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        outlined: { borderColor: '#d5d5d5' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', boxShadow: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { border: '1px solid #e5e5e5', boxShadow: 'none' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 4 },
        notchedOutline: { borderColor: 'rgba(0, 0, 0, 0.23)' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #e5e5e5' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none' },
      },
    },
  },
});
