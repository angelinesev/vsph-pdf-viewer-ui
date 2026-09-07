import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import DescriptionIcon from '@mui/icons-material/Description';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import type { Organization, Plan } from '../types';
import { brochureLimitLabel, formatBytes, storageLimitOf } from '../utils';

interface StatsOverviewProps {
  orgs: Organization[];
  plan: Plan | undefined;
  loading?: boolean;
}

function StatLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Typography variant="overline" color="text.secondary" fontWeight={600} lineHeight={1.4}>
        {children}
      </Typography>
    </Stack>
  );
}

export default function StatsOverview({ orgs, plan, loading }: StatsOverviewProps) {
  const totalBrochures = orgs.reduce((sum, o) => sum + (o.active_brochures ?? o.usage_this_month ?? 0), 0);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} sx={{ p: 2, borderRadius: 2 }}>
            <Skeleton variant="text" width="55%" height={20} />
            <Skeleton variant="text" width="40%" height={32} sx={{ mt: 0.5 }} />
            <Skeleton variant="text" width="70%" sx={{ mt: 0.5 }} />
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
      <Card sx={{ p: 2, borderRadius: 2 }}>
        <StatLabel icon={<CorporateFareIcon fontSize="small" />}>Organizations</StatLabel>
        <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
          {orgs.length}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          with active plans
        </Typography>
      </Card>

      <Card sx={{ p: 2, borderRadius: 2 }}>
        <StatLabel icon={<DescriptionIcon fontSize="small" />}>Active brochures</StatLabel>
        <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
          {totalBrochures}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          across all organizations
        </Typography>
      </Card>

      <Card sx={{ p: 2, borderRadius: 2 }}>
        <StatLabel icon={<WorkspacePremiumIcon fontSize="small" />}>Plan</StatLabel>
        <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
          {plan ? plan.name : 'VSPH'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {plan ? `${brochureLimitLabel(plan)} brochures · ${formatBytes(storageLimitOf(plan))}` : '—'}
        </Typography>
      </Card>
    </Box>
  );
}
