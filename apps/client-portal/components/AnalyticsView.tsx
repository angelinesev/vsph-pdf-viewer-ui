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
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import PublicIcon from '@mui/icons-material/Public';
import type { AnalyticsPayload, AnalyticsRange, BrochureAnalyticsRow, ChartGranularity } from '../../shared/analytics';
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
} from '../../shared/analytics';

type ChartMetric = 'opens' | 'unique';
type BrochureSort = 'opens' | 'last_opened';

const CHART_COLORS = ['#0362fc', '#5b8def', '#8fb8ff', '#0f9f6e', '#d97706', '#dd3d56', '#57606f'];

interface AnalyticsViewProps {
  data: AnalyticsPayload | null;
  loading?: boolean;
  error?: string;
  days: AnalyticsRange;
  onDaysChange: (days: AnalyticsRange) => void;
  onExport: (opts: { days: number; countryFilter?: string | null }) => void;
  exportDisabled?: boolean;
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

export default function AnalyticsView({
  data,
  loading,
  error,
  days,
  onDaysChange,
  onExport,
  exportDisabled,
}: AnalyticsViewProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>('opens');
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('days');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [brochureSearch, setBrochureSearch] = useState('');
  const [brochureSort, setBrochureSort] = useState<BrochureSort>('opens');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);

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

  function handleCountrySelect(code: string | null) {
    setSelectedCountry((cur) => (cur === code ? null : code));
    setPage(0);
  }

  return (
    <Stack spacing={2}>
      {/* Consolidated header: one title, controls right-aligned, no duplicate page titles */}
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Box sx={{ mr: 'auto' }}>
            <Typography variant="h6" fontWeight={700}>
              Analytics
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last {windowDays} days{data?.organization?.name ? ` · ${data.organization.name}` : ''}
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
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<DownloadIcon fontSize="small" />}
            disabled={exportDisabled || !data || loading}
            onClick={() => onExport({ days: windowDays, countryFilter: selectedCountry })}
          >
            Export PDF
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="info">{error}</Alert>}

      {!error && (
        <>
          {/* KPI Overview Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            {!data ? (
              <Stack direction="row" spacing={4} flexWrap="wrap">
                {[0, 1, 2, 3].map((i) => (
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
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
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
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Geographic breakdown
            </Typography>
            {selectedCountry && (
              <Chip
                size="small"
                icon={<PublicIcon fontSize="small" />}
                label={`Filtered: ${countryLabel(countries.find((c) => c.country === selectedCountry) || selectedCountry)}`}
                onDelete={() => handleCountrySelect(selectedCountry)}
                color="primary"
                variant="outlined"
                sx={{ mb: 1.5 }}
              />
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr' }, gap: 3 }}>
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
                        valueFormatter: (item) => `${item.value} opens (${formatShare(item.value, total)})`,
                      },
                    ]}
                    height={220}
                    width={220}
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
                    {countries.map((c, i) => {
                      const pct = c.share ?? (total ? (c.count / total) * 100 : 0);
                      const active = selectedCountry === c.country;
                      return (
                        <TableRow
                          key={`${c.country || c.country_name}-${i}`}
                          hover
                          onClick={() => handleCountrySelect(c.country || null)}
                          sx={{ cursor: 'pointer', bgcolor: active ? 'primary.light' : undefined }}
                        >
                          <TableCell>{i + 1}</TableCell>
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
              </TableContainer>
            </Box>
          </Paper>

          {/* Brochure Performance Card */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Brochure performance
            </Typography>

            {projects.length > 0 && (
              <>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Projects ranked
                </Typography>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
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
                        <TableCell sx={{ fontWeight: 700 }} width={140}>
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
              <Typography variant="subtitle2" fontWeight={700} sx={{ mr: 'auto' }}>
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
              />
              <TextField
                size="small"
                select
                value={brochureSort}
                onChange={(e) => setBrochureSort(e.target.value as BrochureSort)}
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="opens">Sort by opens</MenuItem>
                <MenuItem value="last_opened">Sort by last opened</MenuItem>
              </TextField>
            </Stack>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
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
                    <TableCell sx={{ fontWeight: 700 }} width={140}>
                      Share
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Last opened</TableCell>
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
                            <Typography variant="body2" fontWeight={600} noWrap>
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
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                              {formatShare(r.total || 0, filteredTotal, share)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
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
