import { useCallback, useEffect, useMemo, useState } from 'react';
import { callApi } from '../../shared/api';
import { formatShare } from '../../shared/analytics';
import type { AnalyticsRange } from '../../shared/analytics';
import type { AnalyticsOverview, OrgAnalyticsDetail, OrgAnalyticsRow } from '../types';
import { formatCountryStat } from '../utils';
import { exportAnalyticsPdf } from '../../shared/printAnalytics';
import AnalyticsDashboard from '../../shared/AnalyticsDashboard';
import { ShareBar } from '../../shared/charts';

interface AnalyticsPanelProps {
  jwt: string;
  version: number;
}

function filterOrgRows(rows: OrgAnalyticsRow[], query: string): OrgAnalyticsRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const name = (row.organization?.name || '').toLowerCase();
    const slug = (row.organization?.slug || '').toLowerCase();
    const id = (row.org_id || '').toLowerCase();
    return name.includes(q) || slug.includes(q) || id.includes(q);
  });
}

export default function AnalyticsPanel({ jwt, version }: AnalyticsPanelProps) {
  const [days, setDays] = useState<AnalyticsRange>(30);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrgAnalyticsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');

  const loadOverview = useCallback(async (range: AnalyticsRange) => {
    setLoading(true);
    setError('');
    try {
      const res = await callApi<AnalyticsOverview>(`admin-analytics?days=${range}`, { adminJwt: jwt });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Analytics unavailable until migration 005 is applied.');
    } finally {
      setLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    loadOverview(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, days]);

  useEffect(() => {
    if (!detailOrgId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setError('');
    callApi<{ detail: OrgAnalyticsDetail; window_days?: number }>(
      `admin-analytics?org_id=${encodeURIComponent(detailOrgId)}&days=${days}`,
      { adminJwt: jwt },
    )
      .then((res) => {
        if (cancelled) return;
        if (!res.detail) {
          setDetail(null);
          return;
        }
        setDetail({ ...res.detail, window_days: res.window_days || res.detail.window_days || days });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setDetail(null);
        setError(err.message || 'Could not load organization analytics');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailOrgId, days, jwt]);

  async function exportOrg(orgId: string, opts: { days: number; countryFilter?: string | null }) {
    setError('');
    try {
      const res = await callApi<{ detail: OrgAnalyticsDetail; window_days?: number }>(
        `admin-analytics?org_id=${encodeURIComponent(orgId)}&days=${opts.days}`,
        { adminJwt: jwt },
      );
      if (!res.detail) throw new Error('No analytics for this organization');
      const popupError = exportAnalyticsPdf(
        res.detail,
        res.window_days || opts.days,
        opts,
      );
      if (popupError) setError(popupError);
    } catch (err: any) {
      setError(err.message || 'Could not export analytics');
    }
  }

  const platformTotal = data?.total || 0;
  const rows = useMemo(() => filterOrgRows(data?.organizations || [], orgSearch), [data?.organizations, orgSearch]);

  function openOrgDetail(orgId: string) {
    setDetailOrgId(orgId);
  }

  function backToPlatform() {
    setDetailOrgId(null);
    setDetail(null);
  }

  if (detailOrgId) {
    const orgName = detail?.organization?.name || detailOrgId;
    return (
      <>
        {error && <p className="err">{error}</p>}
        <AnalyticsDashboard
          title={orgName}
          subtitle={`Last ${detail?.window_days || days} days · ${detail?.organization?.slug || detailOrgId}`}
          data={detail}
          loading={detailLoading}
          days={days}
          onDaysChange={setDays}
          onExport={(opts) => exportOrg(detailOrgId, opts)}
          leadingActions={(
            <button className="secondary inline analytics-back-btn" type="button" onClick={backToPlatform}>
              Back to platform
            </button>
          )}
        />
      </>
    );
  }

  return (
    <>
      {error && <p className="err">{error}</p>}
      <AnalyticsDashboard
        layout="ga"
        title="Platform analytics"
        subtitle={`Active organizations only · last ${days} days`}
        data={data}
        loading={loading}
        days={days}
        onDaysChange={setDays}
        showBrochures={false}
        showProjects={false}
        orgCount={data?.organizations?.length ?? 0}
        extra={(
          <>
            <div className="analytics-section-head analytics-org-tools">
              <h3 className="analytics-section-title">Organizations ranked by opens</h3>
              <input
                type="search"
                className="analytics-search"
                placeholder="Search organizations…"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                aria-label="Search organizations"
              />
            </div>
            <div className="table-wrap">
              <table className="analytics-table-interactive">
                <thead>
                  <tr>
                    <th className="analytics-rank-col">#</th>
                    <th>Organization</th>
                    <th>Brochures</th>
                    <th>Opens</th>
                    <th>Unique</th>
                    <th>Share</th>
                    <th>Top country</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="analytics-empty">
                        {orgSearch.trim()
                          ? 'No organizations match your search.'
                          : 'No opens recorded in this window.'}
                      </td>
                    </tr>
                  )}
                  {rows.map((row, i) => {
                    const opens = row.total || 0;
                    const sharePct = platformTotal ? (opens / platformTotal) * 100 : 0;
                    return (
                      <tr
                        key={row.org_id}
                        className="clickable"
                        onClick={() => openOrgDetail(row.org_id)}
                      >
                        <td className="analytics-rank-col">{i + 1}</td>
                        <td>
                          <strong>{row.organization?.name || row.org_id}</strong>
                          <div className="muted">{row.organization?.slug || ''}</div>
                        </td>
                        <td>{row.brochure_count || 0}</td>
                        <td>{opens}</td>
                        <td>{row.unique_visitors || 0}</td>
                        <td className="analytics-org-share">
                          <span className="analytics-share-text">{formatShare(opens, platformTotal)}</span>
                          <ShareBar pct={sharePct} />
                        </td>
                        <td>{row.countries && row.countries[0] ? formatCountryStat(row.countries[0]) : '—'}</td>
                        <td>
                          <div className="analytics-row-actions">
                            <button
                              className="secondary inline"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrgDetail(row.org_id);
                              }}
                            >
                              Details
                            </button>
                            <button
                              className="secondary inline"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                exportOrg(row.org_id, { days });
                              }}
                            >
                              Export PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      />
    </>
  );
}
