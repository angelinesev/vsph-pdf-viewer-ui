import { useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import LogoutIcon from '@mui/icons-material/Logout';
import type { Plan } from '../types';
import PlansGrid from './PlansGrid';

interface SettingsPanelProps {
  plans: Plan[];
  onLogout: () => void;
  loading?: boolean;
}

export default function SettingsPanel({ plans, onLogout, loading }: SettingsPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Plan details for this account, and session controls.
      </Typography>
      <PlansGrid plans={plans} loading={loading} />
      <br></br>
      <Button
        variant="outlined"
        disableElevation
        color="error" 
        startIcon={<LogoutIcon fontSize="small" />}
        onClick={() => setConfirmOpen(true)}
        sx={{ mt: 3 }}
      >
        Sign out
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Sign out?</DialogTitle>
        <DialogContent>
          <DialogContentText>You'll need to sign in again to access the admin portal.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" disableElevation color="inherit" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="outlined" disableElevation color="error" onClick={onLogout}>
            Sign out
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
