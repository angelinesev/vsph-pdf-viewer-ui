import logoUrl from '../../shared/brown-bg.png';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { colors } from '../../shared/colors';

interface TopBarProps {
  loggedIn: boolean;
}

export default function TopBar({ loggedIn }: TopBarProps) {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{ bgcolor: colors.brandDark, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ py: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
          <Box component="img" src={logoUrl} alt="Virtual Studios" sx={{ height: 22, width: 'auto', display: 'block' }} />
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          {/* text.secondary is tuned for light surfaces — on this dark bar
              it drops to ~3.4:1, under the 4.5:1 AA text minimum. */}
          <Typography variant="body2" fontWeight={500} sx={{ color: colors.accent }}>
            Organizations & access
          </Typography>
        </Stack>
        {loggedIn && (
          <Chip
            label="Admin"
            variant="outlined"
            size="small"
            sx={{ borderColor: colors.accent, color: colors.accent }}
          />
        )}
      </Toolbar>
    </AppBar>
  );
}
