import { useMemo, useState } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { AnalyticsRange, ChartGranularity } from '../../shared/analytics';
import {
  ANALYTICS_RANGES,
  buildChartSeries,
  countryLabel,
  formatDayLabel,
  formatDelta,
  formatSeriesLabel,
  formatShare,
} from '../../shared/analytics';
import type { AnalyticsOverview, OrgAnalyticsRow } from '../types';
import { formatCountryStat } from '../utils';
import { colors } from '../../shared/colors';

type ChartMetric = 'opens' | 'unique';

// Deep Obsidian (primary) → Muted Slate (secondary) → Soft Gray-Taupe
// (tertiary), cycled across categorical series/slices.
const CHART_COLORS = ['#1A1917', '#475569', '#64748B'];

interface AnalyticsOverviewProps {
  data: AnalyticsOverview | null;
  loading?: boolean;
  error?: string;
  days: AnalyticsRange;
  onDaysChange: (days: AnalyticsRange) => void;
  orgSearch: string;
  onOrgSearchChange: (q: string) => void;
  onOpenOrg: (orgId: string) => void;
  onExportOrg: (orgId: string) => void;
}

function DeltaChip({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <Chip
      size="small"
      label={formatDelta(pct)}
      sx={{
        // Deep Forest Green for growth, Warm Terracotta Rust for decline —
        // kept distinct from the app's general success/error red so trend
        // indicators read as their own semantic channel.
        bgcolor: up ? 'rgba(22, 101, 52, 0.1)' : 'rgba(154, 52, 18, 0.1)',
        color: up ? '#166534' : '#9A3412',
        fontWeight: 600,
      }}
    />
  );
}

function KpiTile({
  label,
  value,
  meta,
  delta,
}: {
  label: string;
  value: string;
  meta?: string;
  delta?: number | null;
}) {
  return (
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1, sm: 0 } }}>
      <Typography variant="overline" sx={{ color: 'rgba(0, 0, 0, 0.65)' }} lineHeight={1.4}>
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
        <Typography variant="h5" fontWeight={700} sx={{ color: '#1A1917' }}>
          {value}
        </Typography>
        <DeltaChip pct={delta} />
      </Stack>
      {meta && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {meta}
        </Typography>
      )}
    </Box>
  );
}

// 5-up grid of KPI tiles with subtle dividers between columns (falling back
// to horizontal dividers when tiles stack on narrow screens). Divider
// placement uses nth-of-type so it stays correct at every breakpoint's
// column count, rather than hard-coding "first item" in JS.
const KPI_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
  '& > div': { borderTop: '1px solid rgba(0, 0, 0, 0.08)' },
  '& > div:first-of-type': { borderTop: 'none' },
  '@media (min-width: 600px)': {
    '& > div': { borderTop: 'none', borderLeft: '1px solid rgba(0, 0, 0, 0.08)' },
    '& > div:nth-of-type(2n+1)': { borderLeft: 'none' },
    '& > div:nth-of-type(n+3)': { borderTop: '1px solid rgba(0, 0, 0, 0.08)' },
  },
  '@media (min-width: 900px)': {
    // These resets must match the specificity (and come after, in source
    // order) of the sm-only rules above — a plain "& > div" reset here is a
    // lower-specificity selector, so the sm rules would still win and leak
    // a stray divider stub into the 5-column desktop layout.
    '& > div:nth-of-type(n+3)': { borderTop: 'none' },
    '& > div:nth-of-type(5n+1)': { borderLeft: 'none' },
    '& > div:not(:nth-of-type(5n+1))': { borderLeft: '1px solid rgba(0, 0, 0, 0.08)' },
  },
} as const;

function orgSharePct(row: OrgAnalyticsRow, platformTotal: number) {
  const opens = row.total || 0;
  return platformTotal ? (opens / platformTotal) * 100 : 0;
}

export default function AnalyticsOverview({
  data,
  loading,
  error,
  days,
  onDaysChange,
  orgSearch,
  onOrgSearchChange,
  onOpenOrg,
  onExportOrg,
}: AnalyticsOverviewProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>('opens');
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('days');

  const total = data?.total || 0;
  const countries = data?.countries || [];
  const rawSeries = data?.series || [];
  const topCountry = countries[0];
  const delta = data?.delta;
  const peak = data?.peak;
  const weekday = data?.weekday || [];
  const windowDays = data?.window_days || days;
  const orgRows = data?.organizations || [];
  const orgCount = orgRows.length;

  const chartSeries = useMemo(() => buildChartSeries(rawSeries, chartGranularity), [rawSeries, chartGranularity]);
  const chartDataset = useMemo(
    () => chartSeries.map((p) => ({ ...p, label: formatSeriesLabel(p.date, chartGranularity) })),
    [chartSeries, chartGranularity],
  );
  const weekdayDataset = useMemo(() => weekday.map((w) => ({ label: w.label, opens: w.opens })), [weekday]);

  const q = orgSearch.trim().toLowerCase();
  const filteredOrgs = q
    ? orgRows.filter((row) => {
        const name = (row.organization?.name || '').toLowerCase();
        const slug = (row.organization?.slug || '').toLowerCase();
        return name.includes(q) || slug.includes(q) || row.org_id.toLowerCase().includes(q);
      })
    : orgRows;

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5 },
          bgcolor: colors.surface,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Box sx={{ mr: 'auto' }}>
            <Typography variant="h6">
              Platform analytics
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active organizations only · last {windowDays} days
              {loading ? ' · Loading…' : ''}
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={days}
            disabled={loading}
            onChange={(_e, v) => v && onDaysChange(v)}
          >
            {ANALYTICS_RANGES.map((r) => (
              <ToggleButton key={r} value={r} sx={{ px: 2 }}>
                {r}d
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {error && <Alert severity="info">{error}</Alert>}

      {!error && (
        <>
          {/* KPI Overview Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
            {!data ? (
              <Box sx={KPI_GRID_SX}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Box key={i} sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1, sm: 0 } }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" height={32} />
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ ...KPI_GRID_SX, rowGap: 2 }}>
                <KpiTile label="Opens" value={total.toLocaleString()} delta={delta?.opens_pct} />
                <KpiTile
                  label="Unique visitors"
                  value={(data.unique_visitors || 0).toLocaleString()}
                  delta={delta?.unique_pct}
                />
                <KpiTile label="Organizations" value={String(orgCount)} meta="with traffic" />
                <KpiTile
                  label="Peak day"
                  value={peak ? formatDayLabel(peak.date) : '—'}
                  meta={peak ? `${peak.opens} opens` : 'No traffic yet'}
                />
                <KpiTile
                  label="Top country"
                  value={topCountry ? countryLabel(topCountry) : '—'}
                  meta={
                    topCountry
                      ? `${formatShare(topCountry.count, total, topCountry.share)} · ${topCountry.count} opens`
                      : 'No visits yet'
                  }
                />
              </Box>
            )}
          </Paper>

          {/* Traffic Trends Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.bg }}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ mr: 'auto' }}>
                Traffic over time
              </Typography>
              <ToggleButtonGroup exclusive size="small" value={chartMetric} onChange={(_e, v) => v && setChartMetric(v)}>
                <ToggleButton value="opens" sx={{ px: 2 }}>
                  Opens
                </ToggleButton>
                <ToggleButton value="unique" sx={{ px: 2 }}>
                  Unique
                </ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={chartGranularity}
                onChange={(_e, v) => v && setChartGranularity(v)}
              >
                <ToggleButton value="days" sx={{ px: 2 }}>
                  Days
                </ToggleButton>
                <ToggleButton value="weeks" sx={{ px: 2 }}>
                  Weeks
                </ToggleButton>
                <ToggleButton value="months" sx={{ px: 2 }}>
                  Months
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {chartDataset.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">No traffic in this window yet.</Typography>
              </Box>
            ) : (
              <LineChart
                dataset={chartDataset}
                xAxis={[{ dataKey: 'label', scaleType: 'point' }]}
                series={[
                  {
                    dataKey: chartMetric,
                    label: chartMetric === 'opens' ? 'Opens' : 'Unique visitors',
                    color: '#1A1917',
                    area: true,
                    showMark: chartDataset.length <= 14,
                  },
                ]}
                grid={{ horizontal: true, vertical: true }}
                height={240}
                margin={{ left: 44, right: 16, top: 16, bottom: 30 }}
                sx={{
                  '& .MuiAreaElement-root': { fillOpacity: 0.12 },
                  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: '#C3B8A7' },
                  '& .MuiChartsAxis-tickLabel': { fill: '#2C2A29' },
                  '& .MuiChartsGrid-line': { stroke: '#EAE3D9' },
                }}
              />
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              When people open
            </Typography>
            {weekdayDataset.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Not enough data yet.
              </Typography>
            ) : (
              <BarChart
                dataset={weekdayDataset}
                xAxis={[{ dataKey: 'label', scaleType: 'band' }]}
                series={[{ dataKey: 'opens', label: 'Opens', color: '#475569' }]}
                barLabel="value"
                grid={{ horizontal: true }}
                height={180}
                margin={{ left: 44, right: 16, top: 24, bottom: 30 }}
                sx={{
                  // Bar labels sit above the bars, so they need a dark,
                  // high-contrast ink rather than the bar's own color.
                  '& .MuiBarLabel-root': { fill: '#1A1917', fontWeight: 600, fontSize: 12 },
                  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: '#C3B8A7' },
                  '& .MuiChartsAxis-tickLabel': { fill: '#2C2A29' },
                  '& .MuiChartsGrid-line': { stroke: '#EAE3D9' },
                }}
              />
            )}
          </Paper>

          {/* Geographic Breakdown Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Geographic breakdown
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr' }, gap: 3, alignItems: 'start' }}>
              <Box sx={{ display: 'grid', placeItems: 'center' }}>
                {countries.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No opens yet
                  </Typography>
                ) : (
                  <PieChart
                    series={[
                      {
                        data: countries.slice(0, 6).map((c, i) => ({
                          id: i,
                          value: c.count,
                          label: countryLabel(c),
                          color: CHART_COLORS[i % CHART_COLORS.length],
                        })),
                        innerRadius: 48,
                        outerRadius: 90,
                        paddingAngle: 3,
                        cornerRadius: 3,
                        cx: 110,
                        cy: 110,
                        valueFormatter: (item) => `${item.value} opens (${formatShare(item.value, total)})`,
                      },
                    ]}
                    height={220}
                    width={220}
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    slotProps={{ legend: { hidden: true } }}
                  />
                )}
              </Box>
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }} width={40}>
                        #
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Country</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        Opens
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right" width={160}>
                        Share
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {countries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                          No opens yet
                        </TableCell>
                      </TableRow>
                    )}
                    {countries.map((c, i) => (
                      <TableRow key={`${c.country || c.country_name}-${i}`}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{countryLabel(c)}</TableCell>
                        <TableCell align="right">{c.count}</TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <LinearProgress
                              variant="determinate"
                              value={c.share ?? (total ? (c.count / total) * 100 : 0)}
                              sx={{ flex: 1, height: 6, borderRadius: 999 }}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                              {formatShare(c.count, total, c.share)}
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Paper>

          {/* Organizations Ranked Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ mr: 'auto' }}>
                Organizations ranked by opens
              </Typography>
              <TextField
                size="small"
                placeholder="Search organizations…"
                value={orgSearch}
                onChange={(e) => onOrgSearchChange(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ bgcolor: colors.bg, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
              />
            </Stack>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }} width={40}>
                      #
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Organization</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Brochures
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Opens
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Unique
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right" width={140}>
                      Share
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Top country</TableCell>
                    <TableCell width={44} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOrgs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                        {orgSearch.trim() ? 'No organizations match your search.' : 'No opens recorded in this window.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredOrgs.map((row, i) => (
                    <TableRow
                      key={row.org_id}
                      hover
                      onClick={() => onOpenOrg(row.org_id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ letterSpacing: '-0.1px' }}>
                          {row.organization?.name || row.org_id}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '13px' }}>
                          {row.organization?.slug || ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{row.brochure_count || 0}</TableCell>
                      <TableCell align="right">{row.total || 0}</TableCell>
                      <TableCell align="right">{row.unique_visitors || 0}</TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <LinearProgress
                            variant="determinate"
                            value={orgSharePct(row, total)}
                            sx={{ flex: 1, height: 6, borderRadius: 999 }}
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                            {formatShare(row.total || 0, total)}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{row.countries && row.countries[0] ? formatCountryStat(row.countries[0]) : '—'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            title="Export PDF"
                            aria-label="Export PDF"
                            onClick={() => onExportOrg(row.org_id)}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" title="Details" aria-label="Details" onClick={() => onOpenOrg(row.org_id)}>
                            <ChevronRightIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Stack>
  );
}
