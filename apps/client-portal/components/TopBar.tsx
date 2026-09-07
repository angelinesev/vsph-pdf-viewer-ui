import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import logoUrl from '../../shared/VS-Logo.png';

const SUPPORT_EMAIL = 'support@virtualstudios.com';

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
      sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ py: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
          <Box component="img" src={logoUrl} alt="Virtual Studios" sx={{ height: 22, width: 'auto', display: 'block' }} />
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
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
          >
            Contact Us
          </Button>
          {planName && <Chip label={planName} color="primary" variant="outlined" size="small" />}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
