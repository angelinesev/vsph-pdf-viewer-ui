import type { AnalyticsPayload, ChartGranularity, CountryStat, SeriesPoint } from './analytics';
import {
  countryLabel,
  formatDayLabel,
  formatDelta,
  formatShare,
} from './analytics';
import {
  AreaChart,
  CountryPie,
  Sparkline,
  type ChartMetric,
} from './charts';

interface AnalyticsGaOverviewProps {
  data: AnalyticsPayload;
  orgCount?: number;
  chartMetric: ChartMetric;
  chartGranularity: ChartGranularity;
  chartSeries: SeriesPoint[];
  onChartMetricChange: (metric: ChartMetric) => void;
  onChartGranularityChange: (granularity: ChartGranularity) => void;
  selectedCountry: string | null;
  onSelectCountry: (code: string | null) => void;
}

function SegmentControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="analytics-segment" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span className={`analytics-delta-badge${up ? ' up' : ' down'}`}>
      {formatDelta(pct)}
    </span>
  );
}

function MetricTile({
  label,
  value,
  meta,
  delta,
  sparkline,
}: {
  label: string;
  value: string;
  meta?: string;
  delta?: number | null;
  sparkline: number[];
}) {
  return (
    <div className="analytics-ga-metric">
      <div className="analytics-ga-metric-label">{label}</div>
      <div className="analytics-ga-metric-value-row">
        <span className="analytics-ga-metric-value">{value}</span>
        <DeltaBadge pct={delta} />
      </div>
      {meta && <div className="analytics-ga-metric-meta">{meta}</div>}
      <Sparkline values={sparkline} />
    </div>
  );
}

export default function AnalyticsGaOverview({
  data,
  orgCount,
  chartMetric,
  chartGranularity,
  chartSeries,
  onChartMetricChange,
  onChartGranularityChange,
  selectedCountry,
  onSelectCountry,
}: AnalyticsGaOverviewProps) {
  const total = data.total || 0;
  const countries = data.countries || [];
  const topCountry = countries[0] as CountryStat | undefined;
  const peak = data.peak;
  const delta = data.delta;
  const opensSeries = (data.series || []).map((p) => p.opens);
  const uniqueSeries = (data.series || []).map((p) => p.unique || 0);
  const flatSpark = opensSeries.length ? opensSeries : [0];

  const metricLabel = chartMetric === 'unique' ? 'Unique visitors' : 'Opens';

  return (
    <>
      <section className="analytics-ga-chart-panel">
        <div className="analytics-ga-chart-bar">
          <div className="analytics-ga-metric-select">
            <span className="analytics-ga-metric-select-label">{metricLabel}</span>
          </div>
          <div className="analytics-ga-chart-controls">
            <SegmentControl
              label="Chart metric"
              value={chartMetric}
              options={[
                { value: 'opens', label: 'Opens' },
                { value: 'unique', label: 'Unique' },
              ]}
              onChange={onChartMetricChange}
            />
            <SegmentControl
              label="Chart granularity"
              value={chartGranularity}
              options={[
                { value: 'days', label: 'Days (7 days)' },
                { value: 'weeks', label: 'Weeks' },
                { value: 'months', label: 'Months' },
              ]}
              onChange={onChartGranularityChange}
            />
          </div>
        </div>
        <AreaChart series={chartSeries} metric={chartMetric} granularity={chartGranularity} />
      </section>

      <div className="analytics-ga-band">
        <div className="analytics-ga-metrics">
          <MetricTile
            label="Opens"
            value={total.toLocaleString()}
            delta={delta?.opens_pct}
            sparkline={opensSeries}
          />
          <MetricTile
            label="Unique visitors"
            value={(data.unique_visitors || 0).toLocaleString()}
            delta={delta?.unique_pct}
            sparkline={uniqueSeries}
          />
          <MetricTile
            label="Peak day"
            value={peak ? formatDayLabel(peak.date) : '—'}
            meta={peak ? `${peak.opens} opens` : 'No traffic yet'}
            sparkline={opensSeries}
          />
          <MetricTile
            label="Opens per unique"
            value={String(data.opens_per_unique ?? '—')}
            sparkline={opensSeries}
          />
          <MetricTile
            label="Organizations"
            value={String(orgCount ?? 0)}
            meta="with traffic"
            sparkline={flatSpark}
          />
          <MetricTile
            label="Top country"
            value={topCountry ? countryLabel(topCountry) : '—'}
            meta={topCountry
              ? `${formatShare(topCountry.count, total, topCountry.share)} · ${topCountry.count} opens`
              : undefined}
            sparkline={flatSpark}
          />
          <MetricTile
            label="Change vs prior"
            value={delta?.opens_pct != null ? formatDelta(delta.opens_pct) : '—'}
            meta="opens vs previous period"
            sparkline={flatSpark}
          />
        </div>

        <section className="analytics-ga-pie-panel">
          <h3 className="analytics-section-title">Countries visited</h3>
          <CountryPie
            countries={countries}
            total={total}
            selectedCountry={selectedCountry}
            onSelectCountry={onSelectCountry}
          />
        </section>
      </div>
    </>
  );
}
