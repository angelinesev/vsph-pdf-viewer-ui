import { useMemo, useState, type ReactNode } from 'react';
import type { AnalyticsPayload, AnalyticsRange, BrochureAnalyticsRow } from './analytics';
import {
  ANALYTICS_RANGES,
  buildChartSeries,
  brochureMatchesCountry,
  countryLabel,
  formatCountryStat,
  formatDayLabel,
  formatDelta,
  formatLastOpened,
  formatShare,
  type ChartGranularity,
} from './analytics';
import { AreaChart, CountryDonut, ShareBar, WeekdayStrip, type ChartMetric } from './charts';
import AnalyticsGaOverview from './AnalyticsGaOverview';

export interface AnalyticsExportOptions {
  days: number;
  countryFilter?: string | null;
}

interface AnalyticsDashboardProps {
  title: string;
  subtitle?: string;
  data: AnalyticsPayload | null;
  error?: string;
  loading?: boolean;
  days?: AnalyticsRange;
  onDaysChange?: (days: AnalyticsRange) => void;
  onExport?: (opts: AnalyticsExportOptions) => void;
  leadingActions?: ReactNode;
  extra?: ReactNode;
  showBrochures?: boolean;
  showProjects?: boolean;
  orgCount?: number;
  layout?: 'default' | 'ga';
}

type BrochureSort = 'opens' | 'last_opened';

function SegmentControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="analytics-segment" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="analytics-delta-badge neutral">—</span>;
  const up = pct >= 0;
  return (
    <span className={`analytics-delta-badge${up ? ' up' : ' down'}`}>
      {formatDelta(pct)}
    </span>
  );
}

export default function AnalyticsDashboard({
  title,
  subtitle,
  data,
  error,
  loading,
  days = 30,
  onDaysChange,
  onExport,
  leadingActions,
  extra,
  showBrochures = true,
  showProjects = true,
  orgCount,
  layout = 'default',
}: AnalyticsDashboardProps) {
  const windowDays = data?.window_days || days;
  const total = data?.total || 0;
  const countries = data?.countries || [];
  const allBrochures = data?.by_brochure || [];
  const projects = data?.by_project || [];
  const rawSeries = data?.series || [];
  const topCountry = countries[0];
  const delta = data?.delta;
  const peak = data?.peak;
  const weekday = data?.weekday || [];

  const [chartMetric, setChartMetric] = useState<ChartMetric>('opens');
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('days');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedBrochure, setSelectedBrochure] = useState<string | null>(null);
  const [brochureSearch, setBrochureSearch] = useState('');
  const [brochureSort, setBrochureSort] = useState<BrochureSort>('opens');

  const chartSeries = useMemo(
    () => buildChartSeries(rawSeries, chartGranularity),
    [rawSeries, chartGranularity],
  );

  const filteredBrochures = useMemo(() => {
    let rows = allBrochures.filter((r) => brochureMatchesCountry(r, selectedCountry));
    if (selectedProject) {
      rows = rows.filter((r) => r.project_id === selectedProject);
    }
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
  }, [allBrochures, selectedCountry, selectedProject, brochureSearch, brochureSort]);

  const filteredTotal = filteredBrochures.reduce((sum, r) => sum + (r.total || 0), 0);
  const selectedBrochureRow = allBrochures.find((r) => r.brochure_id === selectedBrochure) || null;

  function clearFilters() {
    setSelectedCountry(null);
    setSelectedProject(null);
    setSelectedBrochure(null);
  }

  function handleCountrySelect(code: string | null) {
    if (code === '__other__') return;
    setSelectedCountry(code);
    setSelectedBrochure(null);
  }

  function handleProjectSelect(projectId: string | null) {
    setSelectedProject(projectId);
    setSelectedBrochure(null);
  }

  return (
    <div className={`analytics-page${layout === 'ga' ? ' analytics-page--ga' : ''}`}>
      <header className="analytics-toolbar">
        <div className="analytics-toolbar-copy">
          <h2>{title}</h2>
          <p className="muted">
            {subtitle ?? (
              <>
                Last {windowDays} days
                {data?.organization?.name ? ` · ${data.organization.name}` : ''}
              </>
            )}
            {loading ? ' · Loading…' : ''}
          </p>
        </div>
        <div className="analytics-toolbar-actions">
          {leadingActions}
          {onDaysChange && (
            <SegmentControl
              label="Date range"
              value={days}
              disabled={loading}
              options={ANALYTICS_RANGES.map((range) => ({ value: range, label: `${range}d` }))}
              onChange={onDaysChange}
            />
          )}
          {onExport && (
            <button
              className="secondary inline analytics-export-btn"
              type="button"
              onClick={() => onExport({ days: windowDays, countryFilter: selectedCountry })}
              disabled={!data || loading}
            >
              Export PDF
            </button>
          )}
        </div>
      </header>

      {(selectedCountry || selectedProject) && (
        <div className="analytics-filter-bar">
          {selectedCountry && (
            <button type="button" className="analytics-filter-chip" onClick={() => setSelectedCountry(null)}>
              {countryLabel(countries.find((c) => c.country === selectedCountry) || selectedCountry)}
              <span aria-hidden="true">×</span>
            </button>
          )}
          {selectedProject && (
            <button type="button" className="analytics-filter-chip" onClick={() => setSelectedProject(null)}>
              {projects.find((p) => p.project_id === selectedProject)?.project_name || 'Project'}
              <span aria-hidden="true">×</span>
            </button>
          )}
          <button type="button" className="analytics-filter-clear" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      {error && <p className="muted">{error}</p>}

      {!error && (
        <>
          {layout === 'ga' && data ? (
            <AnalyticsGaOverview
              data={data}
              orgCount={orgCount}
              chartMetric={chartMetric}
              chartGranularity={chartGranularity}
              chartSeries={chartSeries}
              onChartMetricChange={setChartMetric}
              onChartGranularityChange={setChartGranularity}
              selectedCountry={selectedCountry}
              onSelectCountry={handleCountrySelect}
            />
          ) : layout === 'ga' ? null : (
            <>
          <section className="analytics-section analytics-section-chart">
            <div className="analytics-section-head">
              <h3 className="analytics-section-title">Traffic over time</h3>
              <div className="analytics-chart-controls">
                <SegmentControl
                  label="Chart metric"
                  value={chartMetric}
                  options={[
                    { value: 'opens', label: 'Opens' },
                    { value: 'unique', label: 'Unique' },
                  ]}
                  onChange={setChartMetric}
                />
                <SegmentControl
                  label="Chart granularity"
                  value={chartGranularity}
                  options={[
                    { value: 'days', label: 'Days (7 days)' },
                    { value: 'weeks', label: 'Weeks' },
                    { value: 'months', label: 'Months' },
                  ]}
                  onChange={setChartGranularity}
                />
              </div>
            </div>
            <AreaChart series={chartSeries} metric={chartMetric} granularity={chartGranularity} />
            {weekday.length > 0 && <WeekdayStrip weekday={weekday} />}
          </section>

          <div className="analytics-kpi-primary">
            <div className="analytics-kpi-card">
              <div className="analytics-kpi-label">Opens</div>
              <div className="analytics-kpi-value-row">
                <span className="analytics-kpi-value">{total.toLocaleString()}</span>
                <DeltaBadge pct={delta?.opens_pct} />
              </div>
            </div>
            <div className="analytics-kpi-card">
              <div className="analytics-kpi-label">Unique visitors</div>
              <div className="analytics-kpi-value-row">
                <span className="analytics-kpi-value">{(data?.unique_visitors || 0).toLocaleString()}</span>
                <DeltaBadge pct={delta?.unique_pct} />
              </div>
            </div>
            <div className="analytics-kpi-card">
              <div className="analytics-kpi-label">Peak day</div>
              <div className="analytics-kpi-value">{peak ? formatDayLabel(peak.date) : '—'}</div>
              <div className="analytics-kpi-meta">{peak ? `${peak.opens} opens` : 'No traffic yet'}</div>
            </div>
            <div className="analytics-kpi-card">
              <div className="analytics-kpi-label">Top country</div>
              <div className="analytics-kpi-value analytics-kpi-value-sm">
                {topCountry ? countryLabel(topCountry) : '—'}
              </div>
              <div className="analytics-kpi-meta">
                {topCountry
                  ? `${formatShare(topCountry.count, total, topCountry.share)} · ${topCountry.count} opens`
                  : 'No visits yet'}
              </div>
            </div>
          </div>

          <div className="analytics-kpi-secondary">
            <span>
              <strong>{showBrochures ? allBrochures.length : (orgCount ?? 0)}</strong>
              {' '}
              {showBrochures ? 'brochures opened' : 'organizations with traffic'}
            </span>
            {showBrochures && data?.brochure_count != null && (
              <span className="muted">· {data.brochure_count} in library</span>
            )}
            <span className="muted">·</span>
            <span>
              <strong>{data?.opens_per_unique ?? '—'}</strong>
              {' opens per unique'}
            </span>
          </div>

          <div className="analytics-split">
            <section className="analytics-section">
              <h3 className="analytics-section-title">Countries visited</h3>
              <CountryDonut
                countries={countries}
                total={total}
                selectedCountry={selectedCountry}
                onSelectCountry={handleCountrySelect}
              />
            </section>
            <section className="analytics-section">
              <h3 className="analytics-section-title">Ranked countries</h3>
              <div className="table-wrap">
                <table className="analytics-table-interactive">
                  <thead>
                    <tr>
                      <th className="analytics-rank-col">#</th>
                      <th>Country</th>
                      <th>Opens</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.length === 0 && (
                      <tr><td colSpan={4} className="analytics-empty">No opens yet</td></tr>
                    )}
                    {countries.map((c, i) => (
                      <tr
                        key={`${c.country || c.country_name}-${i}`}
                        className={`clickable${selectedCountry === c.country ? ' active' : ''}`}
                        onClick={() => handleCountrySelect(selectedCountry === c.country ? null : (c.country || null))}
                      >
                        <td className="analytics-rank-col">{i + 1}</td>
                        <td>{countryLabel(c)}</td>
                        <td>{c.count}</td>
                        <td>
                          <span className="analytics-share-text">{formatShare(c.count, total, c.share)}</span>
                          <ShareBar pct={c.share ?? ((total ? (c.count / total) * 100 : 0))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {showProjects && projects.length > 0 && (
            <section className="analytics-section">
              <h3 className="analytics-section-title">Projects ranked</h3>
              <div className="table-wrap">
                <table className="analytics-table-interactive">
                  <thead>
                    <tr>
                      <th className="analytics-rank-col">#</th>
                      <th>Project</th>
                      <th>Opens</th>
                      <th>Unique</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p, i) => (
                      <tr
                        key={p.project_id || `none-${i}`}
                        className={`clickable${selectedProject === p.project_id ? ' active' : ''}`}
                        onClick={() => handleProjectSelect(
                          selectedProject === p.project_id ? null : (p.project_id || null),
                        )}
                      >
                        <td className="analytics-rank-col">{i + 1}</td>
                        <td>{p.project_name || '—'}</td>
                        <td>{p.total || 0}</td>
                        <td>{p.unique_visitors || 0}</td>
                        <td>
                          <span className="analytics-share-text">{formatShare(p.total || 0, total, p.share)}</span>
                          <ShareBar pct={p.share ?? 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {showBrochures && (
            <section className="analytics-section">
              <div className="analytics-section-head">
                <h3 className="analytics-section-title">Most opened brochures</h3>
                <div className="analytics-table-tools">
                  <input
                    type="search"
                    className="analytics-search"
                    placeholder="Search brochures…"
                    value={brochureSearch}
                    onChange={(e) => setBrochureSearch(e.target.value)}
                  />
                  <select
                    className="analytics-sort"
                    value={brochureSort}
                    onChange={(e) => setBrochureSort(e.target.value as BrochureSort)}
                    aria-label="Sort brochures"
                  >
                    <option value="opens">Sort by opens</option>
                    <option value="last_opened">Sort by last opened</option>
                  </select>
                </div>
              </div>
              {selectedBrochureRow && (
                <p className="analytics-selection-sub">
                  <strong>{selectedBrochureRow.title || selectedBrochureRow.filename}</strong>
                  {' · '}
                  {selectedBrochureRow.total || 0} opens · {selectedBrochureRow.unique_visitors || 0} unique
                  {' · last opened '}
                  {formatLastOpened(selectedBrochureRow.last_opened_at)}
                </p>
              )}
              <div className="table-wrap">
                <table className="analytics-table-interactive">
                  <thead>
                    <tr>
                      <th className="analytics-rank-col">#</th>
                      <th>Brochure</th>
                      <th>Project</th>
                      <th>Opens</th>
                      <th>Unique</th>
                      <th>Share</th>
                      <th>Top country</th>
                      <th>Last opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBrochures.length === 0 && (
                      <tr><td colSpan={8} className="analytics-empty">No brochure opens in this window</td></tr>
                    )}
                    {filteredBrochures.map((r, i) => renderBrochureRow(
                      r,
                      i,
                      filteredTotal,
                      selectedBrochure,
                      setSelectedBrochure,
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
            </>
          )}
        </>
      )}

      {extra && <section className="analytics-section analytics-section-extra">{extra}</section>}
    </div>
  );
}

function renderBrochureRow(
  r: BrochureAnalyticsRow,
  i: number,
  filteredTotal: number,
  selectedBrochure: string | null,
  setSelectedBrochure: (id: string | null) => void,
) {
  const title = r.title || r.filename || 'Untitled';
  const share = r.share ?? (filteredTotal ? ((r.total || 0) / filteredTotal) * 100 : 0);
  return (
    <tr
      key={r.brochure_id || `${title}-${i}`}
      className={`clickable${selectedBrochure === r.brochure_id ? ' active' : ''}`}
      onClick={() => setSelectedBrochure(selectedBrochure === r.brochure_id ? null : (r.brochure_id || null))}
    >
      <td className="analytics-rank-col">{i + 1}</td>
      <td className="analytics-title-col">
        <strong className="analytics-title-truncate" title={title}>{title}</strong>
        {r.filename && r.filename !== title && (
          <div className="muted analytics-filename-truncate" title={r.filename}>{r.filename}</div>
        )}
      </td>
      <td>{r.project_name || '—'}</td>
      <td>{r.total || 0}</td>
      <td>{r.unique_visitors || 0}</td>
      <td>
        <span className="analytics-share-text">{formatShare(r.total || 0, filteredTotal, share)}</span>
        <ShareBar pct={share} />
      </td>
      <td>{r.countries && r.countries[0] ? formatCountryStat(r.countries[0]) : '—'}</td>
      <td className="analytics-date-col">{formatLastOpened(r.last_opened_at)}</td>
    </tr>
  );
}
