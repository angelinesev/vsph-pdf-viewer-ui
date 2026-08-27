import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
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
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              bgcolor: 'primary.main',
            }}
          >
            V
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              Admin portals
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Organizations & access
            </Typography>
          </Box>
        </Stack>
        {loggedIn && <Chip label="Admin" color="primary" variant="outlined" size="small" />}
      </Toolbar>
    </AppBar>
  );
}
