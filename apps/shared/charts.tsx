import { useMemo, useState } from 'react';
import type { ChartGranularity, CountryStat, SeriesPoint } from './analytics';
import { countryLabel, formatSeriesLabel } from './analytics';

const DONUT_COLORS = [
  'var(--accent)',
  '#60a5fa',
  'var(--success)',
  '#fbbf24',
  '#f472b6',
  'var(--muted)',
];

export type ChartMetric = 'opens' | 'unique';

interface AreaChartProps {
  series: SeriesPoint[];
  metric?: ChartMetric;
  granularity?: ChartGranularity;
}

interface TooltipState {
  x: number;
  y: number;
  date: string;
  opens: number;
  unique: number;
}

export function AreaChart({ series, metric = 'opens', granularity = 'days' }: AreaChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const width = 640;
  const height = 150;
  const padL = 22;
  const padT = 8;
  const padB = 22;
  const points = series.length ? series : [{ date: '', opens: 0, unique: 0 }];
  const values = points.map((p) => (metric === 'unique' ? (p.unique || 0) : p.opens));
  const max = Math.max(1, ...values);
  const plotLeft = padL;
  const plotRight = width;
  const innerW = plotRight - plotLeft;
  const innerH = height - padT - padB;
  const coords = points.map((p, i) => {
    const val = metric === 'unique' ? (p.unique || 0) : p.opens;
    const x = plotLeft + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padT + innerH - (val / max) * innerH;
    return { x, y, ...p, val };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${plotLeft},${padT + innerH} ${line} ${plotRight},${padT + innerH}`;
  const yTicks = [0, Math.round(max / 2), max];
  const xLabels = [coords[0], coords[Math.floor(coords.length / 2)], coords[coords.length - 1]].filter(Boolean);
  const metricLabel = metric === 'unique' ? 'Unique visitors' : 'Opens';

  return (
    <div className="analytics-chart-wrap">
      <svg
        className="analytics-area"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${metricLabel} over time`}
        onMouseLeave={() => setTooltip(null)}
      >
        {yTicks.map((tick) => {
          const y = padT + innerH - (tick / max) * innerH;
          return (
            <g key={tick}>
              <line
                x1={0}
                x2={width}
                y1={y}
                y2={y}
                className="analytics-grid"
                vectorEffect="non-scaling-stroke"
              />
              {tick !== 0 && (
                <text x={padL - 5} y={y + 2} className="analytics-axis-y" textAnchor="end">{tick}</text>
              )}
            </g>
          );
        })}
        <polygon points={area} className="analytics-area-fill" />
        <polyline points={line} className="analytics-area-line" vectorEffect="non-scaling-stroke" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r="3"
            className="analytics-area-dot analytics-area-hit"
            onMouseEnter={() => setTooltip({
              x: c.x,
              y: c.y,
              date: c.date,
              opens: c.opens,
              unique: c.unique || 0,
            })}
            onFocus={() => setTooltip({
              x: c.x,
              y: c.y,
              date: c.date,
              opens: c.opens,
              unique: c.unique || 0,
            })}
            tabIndex={0}
          />
        ))}
        {xLabels.map((c, i) => {
          const anchor = i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle';
          return (
            <text
              key={`${c.date}-${i}`}
              x={c.x}
              y={height - 3}
              className="analytics-axis-x"
              textAnchor={anchor}
            >
              {c.date ? formatSeriesLabel(c.date, granularity) : ''}
            </text>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="analytics-tooltip"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100}%`,
          }}
        >
          <strong>{formatSeriesLabel(tooltip.date, granularity)}</strong>
          <span>{tooltip.opens} opens · {tooltip.unique} unique</span>
        </div>
      )}
    </div>
  );
}

interface CountryDonutProps {
  countries: CountryStat[];
  total: number;
  selectedCountry?: string | null;
  onSelectCountry?: (code: string | null) => void;
}

export function CountryDonut({
  countries,
  total,
  selectedCountry = null,
  onSelectCountry,
}: CountryDonutProps) {
  const size = 200;
  const cx = 100;
  const cy = 100;
  const r = 56;
  const stroke = 18;
  const slices = useMemo(() => buildSlices(countries, total), [countries, total]);
  const circ = 2 * Math.PI * r;
  let offset = 0;

  if (!total) {
    return (
      <div className="analytics-donut-empty">
        <svg viewBox={`0 0 ${size} ${size}`} className="analytics-donut" aria-hidden="true">
          <circle cx={cx} cy={cy} r={r} fill="none" className="analytics-donut-track" strokeWidth={stroke} />
        </svg>
        <p className="muted">No country data yet</p>
      </div>
    );
  }

  return (
    <div className="analytics-donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="analytics-donut" role="img" aria-label="Opens by country">
        <circle cx={cx} cy={cy} r={r} fill="none" className="analytics-donut-track" strokeWidth={stroke} />
        {slices.map((slice, i) => {
          const dash = (slice.count / total) * circ;
          const active = !selectedCountry || selectedCountry === slice.code;
          const el = (
            <circle
              key={slice.code || slice.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              className={`analytics-donut-slice${active ? '' : ' dimmed'}${onSelectCountry ? ' clickable' : ''}`}
              onClick={() => onSelectCountry?.(selectedCountry === slice.code ? null : slice.code)}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 2} className="analytics-donut-total" textAnchor="middle">{total}</text>
        <text x={cx} y={cy + 14} className="analytics-donut-caption" textAnchor="middle">opens</text>
      </svg>
      <ul className="analytics-legend">
        {slices.map((slice, i) => (
          <li
            key={slice.code || slice.label}
            className={`${onSelectCountry ? 'clickable' : ''}${selectedCountry === slice.code ? ' active' : ''}`}
            onClick={() => onSelectCountry?.(selectedCountry === slice.code ? null : slice.code)}
          >
            <span className="analytics-swatch" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span>{slice.label}</span>
            <strong>{Math.round((slice.count / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeekdayStrip({ weekday }: { weekday: { label: string; opens: number }[] }) {
  const max = Math.max(1, ...(weekday || []).map((d) => d.opens));
  return (
    <div className="analytics-weekday">
      <p className="analytics-weekday-title">When people open</p>
      <div className="analytics-weekday-bars">
        {(weekday || []).map((d) => (
          <div
            key={d.label}
            className={`analytics-weekday-col${d.opens ? '' : ' muted-day'}`}
            title={`${d.label}: ${d.opens} opens`}
          >
            <div
              className="analytics-weekday-bar"
              style={{ height: `${Math.max(3, (d.opens / max) * 100)}%` }}
            />
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildSlices(countries: CountryStat[], total: number) {
  const top = (countries || []).slice(0, 5);
  const used = top.reduce((sum, c) => sum + (c.count || 0), 0);
  const slices = top.map((c) => ({
    code: c.country || '',
    label: countryLabel(c),
    count: c.count || 0,
  }));
  if (total > used) slices.push({ code: '__other__', label: 'Other', count: total - used });
  return slices.filter((s) => s.count > 0);
}

export function ShareBar({ pct }: { pct: number }) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className="analytics-share-bar" aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 120;
  const height = 28;
  const pad = 2;
  const nums = values.length ? values : [0];
  const max = Math.max(1, ...nums);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const line = nums.map((v, i) => {
    const x = pad + (nums.length === 1 ? innerW / 2 : (i / (nums.length - 1)) * innerW);
    const y = pad + innerH - (v / max) * innerH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg
      className={className ? `analytics-ga-sparkline ${className}` : 'analytics-ga-sparkline'}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polyline points={line} className="analytics-ga-sparkline-line" />
    </svg>
  );
}

interface CountryPieProps {
  countries: CountryStat[];
  total: number;
  selectedCountry?: string | null;
  onSelectCountry?: (code: string | null) => void;
}

export function CountryPie({
  countries,
  total,
  selectedCountry = null,
  onSelectCountry,
}: CountryPieProps) {
  const size = 200;
  const cx = 100;
  const cy = 100;
  const r = 72;
  const slices = useMemo(() => buildSlices(countries, total), [countries, total]);

  if (!total) {
    return (
      <div className="analytics-ga-pie-empty">
        <p className="muted">No country data yet</p>
      </div>
    );
  }

  let angle = 0;
  const arcs = slices.map((slice, i) => {
    const pct = slice.count / total;
    const sweep = pct * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const color = DONUT_COLORS[i % DONUT_COLORS.length];
    const active = !selectedCountry || selectedCountry === slice.code;
    const mid = start + sweep / 2;
    const labelPos = polarToCartesian(cx, cy, r * 0.55, mid);
    const showLabel = pct >= 0.08;
    return {
      ...slice,
      pct,
      color,
      active,
      d: describePieSlice(cx, cy, r, start, end),
      labelPos,
      showLabel,
      pctLabel: `${Math.round(pct * 100)}%`,
    };
  });

  return (
    <div className="analytics-ga-pie-wrap">
      <ul className="analytics-ga-legend-top">
        {arcs.map((slice) => (
          <li
            key={slice.code || slice.label}
            className={`${onSelectCountry ? 'clickable' : ''}${selectedCountry === slice.code ? ' active' : ''}`}
            onClick={() => onSelectCountry?.(selectedCountry === slice.code ? null : slice.code)}
          >
            <span className="analytics-swatch" style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <strong>{slice.pctLabel}</strong>
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${size} ${size}`} className="analytics-ga-pie" role="img" aria-label="Opens by country">
        {arcs.map((slice) => (
          <g key={slice.code || slice.label}>
            <path
              d={slice.d}
              fill={slice.color}
              className={`analytics-ga-pie-slice${slice.active ? '' : ' dimmed'}${onSelectCountry ? ' clickable' : ''}`}
              onClick={() => onSelectCountry?.(selectedCountry === slice.code ? null : slice.code)}
            />
            {slice.showLabel && (
              <text
                x={slice.labelPos.x}
                y={slice.labelPos.y}
                className="analytics-ga-pie-label"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {slice.pctLabel}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describePieSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  if (endAngle - startAngle >= 359.99) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}
