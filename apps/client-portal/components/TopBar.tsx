import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import logoUrl from '../../shared/brown-bg.png';
import { colors } from '../../shared/colors';

const SUPPORT_EMAIL = 'hello@virtualstudios.ph';

interface TopBarProps {
  headerSub: string;
  planName: string;
}

export default function TopBar({ headerSub, planName }: TopBarProps) {
  const subject = `Contact request from ${headerSub}`;
  const body = `Company: ${headerSub}\n\n`;
  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: colors.brandDark, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ py: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
          <Box component="img" src={logoUrl} alt="Virtual Studios" sx={{ height: 22, width: 'auto', display: 'block' }} />
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          <Typography variant="body2" fontWeight={500} sx={{ color: colors.accent }}>
            {headerSub}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<MailOutlineIcon fontSize="small" />}
            href={mailtoHref}
            sx={{
              // Outlined-only at rest — the blanket "buttons are filled
              // taupe" theme default is for in-content actions; nav-bar
              // chrome stays light until you actually interact with it.
              bgcolor: colors.primaryLight,
              color: colors.text,
              border: 'none',
              borderRadius: 999,
              '&:hover': {
                bgcolor: colors.highlight,
                color: colors.text,
                border: 'none',
                borderRadius: 999,
              },
            }}
          >
            Contact Us
          </Button>
          {planName && (
            <Chip
              label={planName}
              variant="outlined"
              size="small"
              sx={{ borderColor: colors.accent, color: colors.accent }}
            />
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
