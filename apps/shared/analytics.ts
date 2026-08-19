export interface CountryStat {
  country?: string;
  country_name?: string;
  count: number;
  share?: number;
}

export interface SeriesPoint {
  date: string;
  opens: number;
  unique?: number;
}

export interface AnalyticsDelta {
  opens_pct: number | null;
  unique_pct: number | null;
}

export interface PeakDay {
  date: string;
  opens: number;
}

export interface WeekdayStat {
  dow: number;
  label: string;
  opens: number;
}

export interface ProjectAnalyticsRow {
  project_id?: string | null;
  project_name?: string;
  total?: number;
  unique_visitors?: number;
  share?: number;
}

export interface BrochureAnalyticsRow {
  brochure_id?: string;
  title?: string;
  filename?: string;
  project_id?: string | null;
  project_name?: string;
  total?: number;
  unique_visitors?: number;
  share?: number;
  last_opened_at?: string | null;
  countries?: CountryStat[];
}

export interface AnalyticsPayload {
  total?: number;
  unique_visitors?: number;
  brochure_count?: number;
  window_days?: number;
  countries?: CountryStat[];
  by_brochure?: BrochureAnalyticsRow[];
  by_project?: ProjectAnalyticsRow[];
  series?: SeriesPoint[];
  delta?: AnalyticsDelta;
  peak?: PeakDay | null;
  opens_per_unique?: number;
  weekday?: WeekdayStat[];
  organization?: { name?: string; slug?: string };
}

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = typeof ANALYTICS_RANGES[number];

export type ChartGranularity = 'days' | 'weeks' | 'months';

export const DEFAULT_COUNTRY = 'PH';
export const DEFAULT_COUNTRY_NAME = 'Philippines';

const UNKNOWN_COUNTRY_CODES = new Set(['XX', 'T1', 'A1', 'A2', 'O1', '']);

function isUnknownCountryCode(code: string | null | undefined): boolean {
  if (!code) return true;
  return UNKNOWN_COUNTRY_CODES.has(String(code).trim().toUpperCase());
}

export function countryLabel(entry: CountryStat | string | null | undefined): string {
  if (!entry) return DEFAULT_COUNTRY_NAME;
  if (typeof entry === 'object' && entry.country_name) {
    if (entry.country_name === 'Unknown' || isUnknownCountryCode(entry.country)) {
      return DEFAULT_COUNTRY_NAME;
    }
    return entry.country_name;
  }
  const code = typeof entry === 'object' ? entry.country : entry;
  if (isUnknownCountryCode(code)) return DEFAULT_COUNTRY_NAME;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code!) || code!;
  } catch {
    return code || DEFAULT_COUNTRY_NAME;
  }
}

export function formatCountryStat(entry: CountryStat | undefined | null): string {
  if (!entry) return '—';
  return `${countryLabel(entry)} (${entry.count})`;
}

export function formatDayLabel(isoDate: string): string {
  const parts = String(isoDate || '').split('-');
  if (parts.length !== 3) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(parts[1]) - 1] || parts[1];
  return `${month} ${Number(parts[2])}`;
}

export function formatWeekLabel(isoDate: string): string {
  return formatDayLabel(isoDate);
}

export function formatMonthLabel(isoDate: string): string {
  const parts = String(isoDate || '').split('-');
  if (parts.length < 2) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(parts[1]) - 1] || parts[1];
  return `${month} ${parts[0]}`;
}

export function formatSeriesLabel(isoDate: string, granularity: ChartGranularity = 'days'): string {
  if (!isoDate) return '';
  if (granularity === 'months') return formatMonthLabel(isoDate);
  if (granularity === 'weeks') return formatWeekLabel(isoDate);
  return formatDayLabel(isoDate);
}

export function formatDelta(pct: number | null | undefined): string {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

export function formatShare(count: number, total: number, explicit?: number): string {
  const pct = explicit != null ? explicit : (total ? (count / total) * 100 : 0);
  return `${Math.round(pct * 10) / 10}%`;
}

export function formatLastOpened(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function bucketSeriesByWeek(series: SeriesPoint[]): SeriesPoint[] {
  if (!series.length) return [];
  const buckets = new Map<string, { date: string; opens: number; unique: number }>();
  series.forEach((point) => {
    const d = new Date(`${point.date}T00:00:00Z`);
    const day = d.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - diff);
    const key = monday.toISOString().slice(0, 10);
    const row = buckets.get(key) || { date: key, opens: 0, unique: 0 };
    row.opens += point.opens || 0;
    row.unique += point.unique || 0;
    buckets.set(key, row);
  });
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function bucketSeriesByMonth(series: SeriesPoint[]): SeriesPoint[] {
  if (!series.length) return [];
  const buckets = new Map<string, { date: string; opens: number; unique: number }>();
  series.forEach((point) => {
    const key = String(point.date || '').slice(0, 7);
    if (!key) return;
    const row = buckets.get(key) || { date: `${key}-01`, opens: 0, unique: 0 };
    row.opens += point.opens || 0;
    row.unique += point.unique || 0;
    buckets.set(key, row);
  });
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildChartSeries(
  rawSeries: SeriesPoint[],
  granularity: ChartGranularity,
): SeriesPoint[] {
  if (!rawSeries.length) return [];
  if (granularity === 'days') return rawSeries.slice(-7);
  if (granularity === 'weeks') return bucketSeriesByWeek(rawSeries);
  return bucketSeriesByMonth(rawSeries);
}

export function brochureMatchesCountry(
  row: BrochureAnalyticsRow,
  countryCode: string | null,
): boolean {
  if (!countryCode) return true;
  return (row.countries || []).some((c) => c.country === countryCode);
}
