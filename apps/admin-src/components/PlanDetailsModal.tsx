import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import StorageIcon from '@mui/icons-material/Storage';
import type { Organization } from '../types';
import { brochureLimitLabel, formatBytes, storageLimitOf } from '../utils';

interface PlanDetailsModalProps {
  open: boolean;
  onClose: () => void;
  org: Organization | null;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
      <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function PlanDetailsModal({ open, onClose, org }: PlanDetailsModalProps) {
  const plan = org?.plans;
  const fileMb = plan?.max_file_bytes ? (Number(plan.max_file_bytes) / (1024 * 1024)).toFixed(0) : '—';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{org ? `${org.name} · Plan` : 'Plan'}</DialogTitle>
      <DialogContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <WorkspacePremiumIcon fontSize="small" color="primary" />
          <Typography variant="h6" fontWeight={700}>
            {plan?.name || 'VSPH'}
          </Typography>
        </Stack>
        <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' } }}>
          <Metric icon={<DescriptionIcon fontSize="small" />} label="Brochures" value={brochureLimitLabel(plan)} />
          <Metric icon={<InsertDriveFileIcon fontSize="small" />} label="Max file" value={`${fileMb} MB`} />
          <Metric icon={<StorageIcon fontSize="small" />} label="Storage" value={formatBytes(storageLimitOf(plan))} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          VSPH is currently the only plan offered — every organization is on it automatically, so there's nothing to switch here
          yet.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="outlined" disableElevation color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
