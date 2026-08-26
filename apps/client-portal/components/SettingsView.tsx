import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

interface SettingsViewProps {
  orgName: string;
  planName: string;
  onLogout: () => void;
}

export default function SettingsView({ orgName, planName, onLogout }: SettingsViewProps) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Account details for this organization.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField label="Organization" value={orgName} disabled fullWidth />
        <TextField label="Plan" value={planName} disabled fullWidth />
      </Stack>
      <Button variant="outlined" disableElevation color="error" onClick={onLogout}>
        Sign out
      </Button>
    </Paper>
  );
}
