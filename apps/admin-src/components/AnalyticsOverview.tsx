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

type ChartMetric = 'opens' | 'unique';

const CHART_COLORS = ['#0362fc', '#5b8def', '#8fb8ff', '#0f9f6e', '#d97706', '#dd3d56', '#57606f'];

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
        bgcolor: up ? 'success.light' : 'error.light',
        color: up ? 'success.main' : 'error.main',
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
    <Box sx={{ flex: 1, minWidth: 140 }}>
      <Typography variant="overline" color="text.secondary" fontWeight={600} lineHeight={1.4}>
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
        <Typography variant="h5" fontWeight={700}>
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
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Box sx={{ mr: 'auto' }}>
            <Typography variant="h6" fontWeight={700}>
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
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            {!data ? (
              <Stack direction="row" spacing={4} flexWrap="wrap">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Box key={i} sx={{ flex: 1, minWidth: 140 }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" height={32} />
                  </Box>
                ))}
              </Stack>
            ) : (
              <Stack direction="row" spacing={4} flexWrap="wrap" rowGap={2}>
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
              </Stack>
            )}
          </Paper>

          {/* Traffic Trends Card */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 'auto' }}>
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
                    color: '#0362fc',
                    area: true,
                    showMark: chartDataset.length <= 14,
                  },
                ]}
                grid={{ horizontal: true, vertical: true }}
                height={240}
                margin={{ left: 44, right: 16, top: 16, bottom: 30 }}
                sx={{
                  '& .MuiAreaElement-root': { fillOpacity: 0.12 },
                  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: '#c9cfd8' },
                  '& .MuiChartsAxis-tickLabel': { fill: '#57606f' },
                  '& .MuiChartsGrid-line': { stroke: '#eef0f3' },
                }}
              />
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
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
                series={[{ dataKey: 'opens', label: 'Opens', color: '#0362fc' }]}
                barLabel="value"
                grid={{ horizontal: true }}
                height={180}
                margin={{ left: 44, right: 16, top: 24, bottom: 30 }}
                sx={{
                  '& .MuiBarLabel-root': { fill: '#131416', fontWeight: 600, fontSize: 12 },
                  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: '#c9cfd8' },
                  '& .MuiChartsAxis-tickLabel': { fill: '#57606f' },
                  '& .MuiChartsGrid-line': { stroke: '#eef0f3' },
                }}
              />
            )}
          </Paper>

          {/* Geographic Breakdown Card */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
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
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
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
                      <TableCell sx={{ fontWeight: 700 }} width={160}>
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
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 'auto' }}>
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
              />
            </Stack>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
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
                    <TableCell sx={{ fontWeight: 700 }} width={140}>
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
                        <Typography variant="body2" fontWeight={600}>
                          {row.organization?.name || row.org_id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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
