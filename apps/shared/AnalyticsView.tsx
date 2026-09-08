import { useMemo, useState, type ReactNode } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import LinearProgress from '@mui/material/LinearProgress';
import { colors } from './colors';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import PublicIcon from '@mui/icons-material/Public';
import type { AnalyticsPayload, AnalyticsRange, BrochureAnalyticsRow, ChartGranularity } from './analytics';
import {
  ANALYTICS_RANGES,
  buildChartSeries,
  brochureMatchesCountry,
  countryLabel,
  formatDayLabel,
  formatDelta,
  formatLastOpened,
  formatSeriesLabel,
  formatShare,
} from './analytics';

type ChartMetric = 'opens' | 'unique';
type BrochureSort = 'opens' | 'last_opened';

// Deep Obsidian (primary) → Muted Slate (secondary) → Soft Gray-Taupe
// (tertiary), cycled across categorical series/slices.
const CHART_COLORS = ['#1A1917', '#475569', '#64748B'];

// 4-up grid of KPI tiles with subtle vertical dividers between columns
// (falling back to horizontal dividers when tiles stack on narrow screens).
// Divider placement is driven by nth-of-type so it stays correct at every
// breakpoint's column count, rather than hard-coding "first item" in JS.
const KPI_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
  '& > div': { borderTop: '1px solid rgba(0, 0, 0, 0.08)' },
  '& > div:first-of-type': { borderTop: 'none' },
  '@media (min-width: 600px)': {
    '& > div': { borderTop: 'none', borderLeft: '1px solid rgba(0, 0, 0, 0.08)' },
    '& > div:nth-of-type(2n+1)': { borderLeft: 'none' },
    '& > div:nth-of-type(n+3)': { borderTop: '1px solid rgba(0, 0, 0, 0.08)' },
  },
  '@media (min-width: 900px)': {
    // These two resets must match the specificity (and come after, in
    // source order) of the sm-only rules above — a plain "& > div" reset
    // here is a lower-specificity selector, so the sm rules would still win
    // and leak a stray divider stub into the 4-column desktop layout.
    '& > div:nth-of-type(n+3)': { borderTop: 'none' },
    '& > div:nth-of-type(4n+1)': { borderLeft: 'none' },
    '& > div:not(:nth-of-type(4n+1))': { borderLeft: '1px solid rgba(0, 0, 0, 0.08)' },
  },
} as const;

interface AnalyticsViewProps {
  data: AnalyticsPayload | null;
  loading?: boolean;
  error?: string;
  days: AnalyticsRange;
  onDaysChange: (days: AnalyticsRange) => void;
  onExport: (opts: { days: number; countryFilter?: string | null }) => void;
  exportDisabled?: boolean;
  title?: string;
  subtitle?: string;
  leadingActions?: ReactNode;
}

// Strips the .pdf extension for display; the full original name is still
// shown via a Tooltip on hover, so nothing is actually lost.
function cleanTitle(raw: string): string {
  return raw.replace(/\.pdf$/i, '').trim();
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

export default function AnalyticsView({
  data,
  loading,
  error,
  days,
  onDaysChange,
  onExport,
  exportDisabled,
  title = 'Analytics',
  subtitle,
  leadingActions,
}: AnalyticsViewProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>('opens');
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('days');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [brochureSearch, setBrochureSearch] = useState('');
  const [brochureSort, setBrochureSort] = useState<BrochureSort>('opens');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [countryPage, setCountryPage] = useState(0);
  const COUNTRY_ROWS_PER_PAGE = 5;

  const total = data?.total || 0;
  const countries = data?.countries || [];
  const allBrochures = data?.by_brochure || [];
  const projects = data?.by_project || [];
  const rawSeries = data?.series || [];
  const topCountry = countries[0];
  const delta = data?.delta;
  const peak = data?.peak;
  const weekday = data?.weekday || [];
  const windowDays = data?.window_days || days;

  const chartSeries = useMemo(() => buildChartSeries(rawSeries, chartGranularity), [rawSeries, chartGranularity]);
  const chartDataset = useMemo(
    () => chartSeries.map((p) => ({ ...p, label: formatSeriesLabel(p.date, chartGranularity) })),
    [chartSeries, chartGranularity],
  );
  const weekdayDataset = useMemo(() => weekday.map((w) => ({ label: w.label, opens: w.opens })), [weekday]);

  const filteredBrochures = useMemo(() => {
    let rows = allBrochures.filter((r) => brochureMatchesCountry(r, selectedCountry));
    const q = brochureSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const titleText = (r.title || r.filename || '').toLowerCase();
        const project = (r.project_name || '').toLowerCase();
        return titleText.includes(q) || project.includes(q);
      });
    }
    rows = [...rows];
    if (brochureSort === 'last_opened') {
      rows.sort((a, b) => String(b.last_opened_at || '').localeCompare(String(a.last_opened_at || '')));
    } else {
      rows.sort((a, b) => (b.total || 0) - (a.total || 0));
    }
    return rows;
  }, [allBrochures, selectedCountry, brochureSearch, brochureSort]);

  const filteredTotal = filteredBrochures.reduce((sum, r) => sum + (r.total || 0), 0);
  const pageBrochures = filteredBrochures.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const pageCountries = countries.slice(countryPage * COUNTRY_ROWS_PER_PAGE, countryPage * COUNTRY_ROWS_PER_PAGE + COUNTRY_ROWS_PER_PAGE);

  function handleCountrySelect(code: string | null) {
    setSelectedCountry((cur) => (cur === code ? null : code));
    setPage(0);
  }

  const defaultSubtitle = `Last ${windowDays} days${data?.organization?.name ? ` · ${data.organization.name}` : ''}`;

  return (
    <Stack spacing={2}>
      {/* Consolidated header: one title, controls right-aligned, no duplicate page titles */}
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5 },
          bgcolor: colors.surface,
          color: '#1C1816',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Box sx={{ mr: 'auto' }}>
            <Typography variant="h6">
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: '#2C2A29' }}>
              {subtitle ?? defaultSubtitle}
              {loading ? ' · Loading…' : ''}
            </Typography>
          </Box>
          {leadingActions}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={days}
            disabled={loading}
            onChange={(_e, v) => v && onDaysChange(v)}
            sx={{
              color: '#1C1816',
              '& .MuiToggleButton-root': { color: '#1C1816', borderColor: '#C3B8A7' },
              '& .MuiToggleButton-root.Mui-selected': { bgcolor: '#28303B', color: '#FFFFFF' },
              '& .MuiToggleButton-root.Mui-selected:hover': { bgcolor: '#28303B' },
            }}
          >
            {ANALYTICS_RANGES.map((r) => (
              <ToggleButton key={r} value={r} sx={{ px: 2 }}>
                {r}d
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            disableElevation
            color="inherit"
            startIcon={<DownloadIcon fontSize="small" />}
            disabled={exportDisabled || !data || loading}
            onClick={() => onExport({ days: windowDays, countryFilter: selectedCountry })}
            sx={{
              bgcolor: '#1C1816',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 999,
              '&:hover': { bgcolor: '#2E2B28', color: '#FFFFFF', border: 'none', borderRadius: 999 },
            }}
          >
            Export PDF
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="info">{error}</Alert>}

      {!error && (
        <>
          {/* KPI Overview Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
            {!data ? (
              <Box sx={KPI_GRID_SX}>
                {[0, 1, 2, 3].map((i) => (
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
                  // Bar labels sit above the bars (not on the fill), so they
                  // need a dark, high-contrast ink rather than the bar's own color.
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
            {selectedCountry && (
              <Chip
                size="small"
                icon={<PublicIcon fontSize="small" />}
                label={`Filtered: ${countryLabel(countries.find((c) => c.country === selectedCountry) || selectedCountry)}`}
                onDelete={() => handleCountrySelect(selectedCountry)}
                color="info"
                variant="outlined"
                sx={{ mb: 1.5 }}
              />
            )}
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
                    {pageCountries.map((c, i) => {
                      const pct = c.share ?? (total ? (c.count / total) * 100 : 0);
                      const active = selectedCountry === c.country;
                      return (
                        <TableRow
                          key={`${c.country || c.country_name}-${i}`}
                          hover
                          onClick={() => handleCountrySelect(c.country || null)}
                          sx={{ cursor: 'pointer', bgcolor: active ? 'primary.light' : undefined }}
                        >
                          <TableCell>{countryPage * COUNTRY_ROWS_PER_PAGE + i + 1}</TableCell>
                          <TableCell>{countryLabel(c)}</TableCell>
                          <TableCell align="right">{c.count}</TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{ flex: 1, height: 6, borderRadius: 999 }}
                              />
                              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                                {formatShare(c.count, total, c.share)}
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {countries.length > 0 && (
                  <TablePagination
                    component="div"
                    count={countries.length}
                    page={countryPage}
                    onPageChange={(_e, newPage) => setCountryPage(newPage)}
                    rowsPerPage={COUNTRY_ROWS_PER_PAGE}
                    rowsPerPageOptions={[COUNTRY_ROWS_PER_PAGE]}
                    labelDisplayedRows={({ from, to, count }) => `Showing ${from}–${to} of ${count} countries`}
                  />
                )}
              </TableContainer>
            </Box>
          </Paper>

          {/* Brochure Performance Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Brochure performance
            </Typography>

            {projects.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Projects ranked
                </Typography>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3, bgcolor: colors.surface }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }} width={40}>
                          #
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Opens
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Unique
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right" width={140}>
                          Share
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {projects.map((p, i) => (
                        <TableRow key={p.project_id || `none-${i}`}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{p.project_name || '—'}</TableCell>
                          <TableCell align="right">{p.total || 0}</TableCell>
                          <TableCell align="right">{p.unique_visitors || 0}</TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <LinearProgress
                                variant="determinate"
                                value={p.share ?? 0}
                                sx={{ flex: 1, height: 6, borderRadius: 999 }}
                              />
                              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                                {formatShare(p.total || 0, total, p.share)}
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mr: 'auto' }}>
                Most opened brochures
              </Typography>
              <TextField
                size="small"
                placeholder="Search brochures…"
                value={brochureSearch}
                onChange={(e) => {
                  setBrochureSearch(e.target.value);
                  setPage(0);
                }}
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
              <TextField
                size="small"
                select
                value={brochureSort}
                onChange={(e) => setBrochureSort(e.target.value as BrochureSort)}
                sx={{ minWidth: 170, bgcolor: colors.surface, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
              >
                <MenuItem value="opens">Sort by opens</MenuItem>
                <MenuItem value="last_opened">Sort by last opened</MenuItem>
              </TextField>
            </Stack>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: colors.surface }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }} width={40}>
                      #
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Brochure</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Opens
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Unique
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right" width={140}>
                      Share
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Last opened
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageBrochures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                        No brochure opens in this window
                      </TableCell>
                    </TableRow>
                  )}
                  {pageBrochures.map((r: BrochureAnalyticsRow, i: number) => {
                    const rawTitle = r.title || r.filename || 'Untitled';
                    const display = cleanTitle(rawTitle);
                    const share = r.share ?? (filteredTotal ? ((r.total || 0) / filteredTotal) * 100 : 0);
                    return (
                      <TableRow key={r.brochure_id || `${rawTitle}-${i}`} hover>
                        <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Tooltip title={rawTitle} arrow>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ letterSpacing: '-0.1px' }}>
                              {display}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>{r.project_name || '—'}</TableCell>
                        <TableCell align="right">{r.total || 0}</TableCell>
                        <TableCell align="right">{r.unique_visitors || 0}</TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <LinearProgress
                              variant="determinate"
                              value={share}
                              sx={{ flex: 1, height: 6, borderRadius: 999 }}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40, fontSize: '13px' }}>
                              {formatShare(r.total || 0, filteredTotal, share)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '13px' }}>
                            {formatLastOpened(r.last_opened_at)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredBrochures.length}
                page={page}
                onPageChange={(_e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[8, 15, 25]}
                labelDisplayedRows={({ from, to, count }) => `Showing ${from}–${to} of ${count} brochures`}
              />
            </TableContainer>
          </Paper>
        </>
      )}
    </Stack>
  );
}
