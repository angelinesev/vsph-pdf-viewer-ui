import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { OrgAnalytics, Quota } from '../types';
import { formatBytes, pct } from '../utils';
import { colors } from '../../shared/colors';

interface StatsRowProps {
  quota: Quota | null;
  orgAnalytics: OrgAnalytics | null;
  orgAnalyticsError: boolean;
}

const CARD_TEXT = colors.text;
const CARD_MUTED = colors.secondary;

function StatLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant="overline" sx={{ color: CARD_MUTED }} fontWeight={500} lineHeight={1.4}>
        {children}
      </Typography>
      {tooltip && (
        <Tooltip title={tooltip} arrow>
          <InfoOutlinedIcon sx={{ fontSize: 14, color: CARD_MUTED, cursor: 'help' }} />
        </Tooltip>
      )}
    </Stack>
  );
}

export default function StatsRow({ quota, orgAnalytics, orgAnalyticsError }: StatsRowProps) {
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? null;

  const storageUsed = quota?.storage_used ?? 0;
  const storageLimit = quota?.max_storage_bytes ?? null;
  const storagePct = storageLimit == null ? 0 : pct(storageUsed, storageLimit);
  const storageRemaining = storageLimit == null ? null : Math.max(0, storageLimit - storageUsed);

  if (!quota) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 1.5,
          mb: 2,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Card key={i} sx={{ p: 2, borderRadius: 2, bgcolor: colors.surfaceAlt }}>
            <Skeleton variant="text" width="55%" height={20} />
            <Skeleton variant="text" width="40%" height={32} sx={{ mt: 0.5 }} />
            <Skeleton variant="rounded" height={6} sx={{ mt: 1, borderRadius: 999 }} />
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Box
      data-tour="tour-stats"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 1.5,
        mb: 2,
      }}
    >
      <Card sx={{ p: 2, borderRadius: 2, bgcolor: colors.surfaceAlt }}>
        <StatLabel>Active brochures</StatLabel>
        <Typography variant="h5" sx={{ mt: 0.5, color: CARD_TEXT }}>
          {used} / {limit == null ? 'Unlimited' : limit}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: CARD_MUTED }}>
          {limit == null ? 'Unlimited brochures' : `${limit} brochure limit`}
        </Typography>
        <LinearProgress variant="determinate" value={pct(used, limit)} sx={{ mt: 1 }} />
        <Typography variant="body2" sx={{ mt: 0.5, color: CARD_MUTED }}>
          {limit == null ? 'Unlimited uploads available' : `${Math.max(0, limit - used)} brochure uploads remaining`}
        </Typography>
      </Card>

      <Card sx={{ p: 2, borderRadius: 2, bgcolor: colors.surfaceAlt }}>
        <StatLabel>Storage used</StatLabel>
        <Typography variant="h5" sx={{ mt: 0.5, color: CARD_TEXT }}>
          {formatBytes(quota?.storage_used)}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: CARD_MUTED }}>
          {storageLimit == null ? 'Custom storage limit' : `of ${formatBytes(storageLimit)} · ${storagePct}% used`}
        </Typography>
        <LinearProgress variant="determinate" value={storagePct} sx={{ mt: 1 }} />
        {storageRemaining != null && (
          <Typography variant="body2" sx={{ mt: 0.5, color: CARD_MUTED }}>
            {formatBytes(storageRemaining)} remaining
          </Typography>
        )}
      </Card>

      <Card sx={{ p: 2, borderRadius: 2, bgcolor: colors.surfaceAlt }}>
        <StatLabel tooltip="Opens: total times your flipbooks were opened by visitors in the last 30 days, including repeat visits.">
          Opens (30d)
        </StatLabel>
        <Typography variant="h5" sx={{ mt: 0.5, color: CARD_TEXT }}>
          {orgAnalyticsError ? '—' : orgAnalytics?.total ?? '—'}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: CARD_MUTED }}>
          {orgAnalyticsError ? (
            'Run analytics migration to enable'
          ) : orgAnalytics ? (
            <Tooltip
              title="Unique: an approximate count of distinct visitors, based on IP address and device — repeat opens from the same visitor aren't counted twice."
              arrow
            >
              <span>{orgAnalytics.unique_visitors || 0} unique visitors (approx)</span>
            </Tooltip>
          ) : (
            '—'
          )}
        </Typography>
      </Card>
    </Box>
  );
}
