import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import StorageIcon from '@mui/icons-material/Storage';
import type { Plan } from '../types';
import { brochureLimitLabel, formatBytes, storageLimitOf } from '../utils';

interface PlansGridProps {
  plans: Plan[];
  loading?: boolean;
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

export default function PlansGrid({ plans, loading }: PlansGridProps) {
  if (loading) {
    return (
      <Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          Plan
        </Typography>
        <Card sx={{ borderRadius: 2, p: 2.5, maxWidth: 360 }}>
          <Skeleton variant="text" width="50%" height={32} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="text" sx={{ mt: 1 }} />
          ))}
        </Card>
      </Box>
    );
  }

  if (!plans.length) {
    return (
      <Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          Plan
        </Typography>
        <Typography color="text.secondary">VSPH Plan not configured. Run migration 007 / npm run apply:vsph-plan.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Plan
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={2}>
        {plans.map((p, i) => {
          const fileMb = (Number(p.max_file_bytes || 0) / (1024 * 1024)).toFixed(0);
          return (
            <Card
              key={i}
              sx={{
                borderRadius: 2,
                p: 2.5,
                minWidth: 280,
                maxWidth: 360,
                flex: '1 1 280px',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <WorkspacePremiumIcon fontSize="small" color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  {p.name}
                </Typography>
              </Stack>
              <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                <Metric icon={<DescriptionIcon fontSize="small" />} label="Brochures" value={brochureLimitLabel(p)} />
                <Metric icon={<InsertDriveFileIcon fontSize="small" />} label="Max file" value={`${fileMb} MB`} />
                <Metric icon={<StorageIcon fontSize="small" />} label="Storage" value={formatBytes(storageLimitOf(p))} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Single plan for all organizations.
              </Typography>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
