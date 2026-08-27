import logoUrl from '../../shared/VS-Logo.png';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

interface TopBarProps {
  loggedIn: boolean;
}

export default function TopBar({ loggedIn }: TopBarProps) {
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
            Organizations & access
          </Typography>
        </Stack>
        {loggedIn && <Chip label="Admin" color="primary" variant="outlined" size="small" />}
      </Toolbar>
    </AppBar>
  );
}
