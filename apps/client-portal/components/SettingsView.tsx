import { useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { colors } from '../../shared/colors';

interface SettingsViewProps {
  orgName: string;
  planName: string;
  onLogout: () => void;
  onHelp: () => void;
}

export default function SettingsView({ orgName, planName, onLogout, onHelp }: SettingsViewProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, bgcolor: colors.surface }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Account details for this organization.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          label="Organization"
          value={orgName}
          disabled
          fullWidth
          sx={{ bgcolor: '#EEE8DE' }}
        />
        <TextField
          label="Plan"
          value={planName}
          disabled
          fullWidth
          sx={{ bgcolor: '#EEE8DE' }}
        />
      </Stack>
      <Button
        variant="outlined"
        disableElevation
        color="error"
        onClick={() => setConfirmOpen(true)}
        sx={{ borderRadius: 999 }}
      >
        Sign out
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        slotProps={{
          backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)' } },
          paper: { sx: { border: '1px solid rgba(0, 0, 0, 0.08)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' } },
        }}
      >
        <DialogTitle>Sign out?</DialogTitle>
        <DialogContent>
          <DialogContentText>You'll need to sign in again to access your account.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" disableElevation color="inherit" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" disableElevation color="error" onClick={onLogout}>
            Sign out
          </Button>
        </DialogActions>
      </Dialog>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
        Help
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        New here? Take a quick tour of folders, analytics, usage, and uploads.
      </Typography>
      <Button
        variant="outlined"
        disableElevation
        color="inherit"
        startIcon={<HelpOutlineIcon fontSize="small" />}
        onClick={onHelp}
        sx={{
          bgcolor: '#1C1816',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 999,
          '&:hover': { bgcolor: '#2E2B28', color: '#FFFFFF', border: 'none', borderRadius: 999 },
        }}
      >
        Show me around
      </Button>
    </Paper>
  );
}
