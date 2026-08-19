import { useEffect, useState } from 'react';
import { callApi } from '../../shared/api';
import type { AnalyticsOverview, OrgAnalyticsDetail } from '../types';
import { formatCountryStat } from '../utils';
import { exportAnalyticsPdf } from '../printExport';

interface AnalyticsPanelProps {
  jwt: string;
  version: number;
}

export default function AnalyticsPanel({ jwt, version }: AnalyticsPanelProps) {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrgAnalyticsDetail | null>(null);
  const [windowDays, setWindowDays] = useState(30);

  useEffect(() => {
    callApi<AnalyticsOverview>('admin-analytics', { adminJwt: jwt })
      .then((res) => {
        setData(res);
        setHint('Active organizations only.');
      })
      .catch((err) => setHint(err.message || 'Analytics unavailable until migration 005 is applied.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  async function loadOrgAnalytics(orgId: string) {
    const res = await callApi<{ detail: OrgAnalyticsDetail; window_days?: number }>(
      `admin-analytics?org_id=${encodeURIComponent(orgId)}`,
      { adminJwt: jwt },
    );
    if (!res.detail) return;
    setDetailOrgId(orgId);
    setDetail(res.detail);
    setWindowDays(res.window_days || 30);
  }

  async function exportOrg(orgId: string) {
    setError('');
    try {
      const res = await callApi<{ detail: OrgAnalyticsDetail; window_days?: number }>(
        `admin-analytics?org_id=${encodeURIComponent(orgId)}`,
        { adminJwt: jwt },
      );
      if (!res.detail) throw new Error('No analytics for this organization');
      const popupError = exportAnalyticsPdf(res.detail, res.window_days || 30);
      if (popupError) setError(popupError);
    } catch (err: any) {
      setError(err.message || 'Could not export analytics');
    }
  }

  const rows = data?.organizations || [];

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Analytics (30 days)</h2>
      </div>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total opens</div>
          <div className="stat-value">{data?.total ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique (approx)</div>
          <div className="stat-value">{data?.unique_visitors ?? '—'}</div>
        </div>
      </div>
      <h2>By organization</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Brochures</th>
              <th>Opens</th>
              <th>Unique</th>
              <th>Top country</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
                  No opens recorded yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.org_id}>
                <td>
                  <strong>{row.organization?.name || row.org_id}</strong>
                  <div className="muted">{row.organization?.slug || ''}</div>
                </td>
                <td>{row.brochure_count || 0}</td>
                <td>{row.total || 0}</td>
                <td>{row.unique_visitors || 0}</td>
                <td>{row.countries && row.countries[0] ? formatCountryStat(row.countries[0]) : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="secondary inline" type="button" onClick={() => loadOrgAnalytics(row.org_id)}>
                      Details
                    </button>
                    <button className="secondary inline" type="button" onClick={() => exportOrg(row.org_id)}>
                      Export PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && detailOrgId && (
        <div style={{ marginTop: '1rem' }}>
          <div className="panel-head">
            <h2>
              Detail — {detail.organization?.name || detailOrgId} ({detail.total || 0} opens)
            </h2>
            <button className="secondary inline" type="button" onClick={() => exportOrg(detailOrgId)}>
              Export PDF
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PDF</th>
                  <th>Opens</th>
                  <th>Unique</th>
                  <th>Top country</th>
                </tr>
              </thead>
              <tbody>
                {(detail.by_brochure || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No brochures in this organization
                    </td>
                  </tr>
                )}
                {(detail.by_brochure || []).map((r, i) => {
                  const title = r.title || r.filename || r.brochure_id || 'Untitled';
                  const extras = [r.project_name, r.filename !== title ? r.filename : null].filter(Boolean);
                  const top = r.countries && r.countries[0] ? formatCountryStat(r.countries[0]) : '—';
                  return (
                    <tr key={i}>
                      <td>
                        <strong>{title}</strong>
                        {extras.length > 0 && <div className="muted">{extras.join(' · ')}</div>}
                      </td>
                      <td>{r.total || 0}</td>
                      <td>{r.unique_visitors || 0}</td>
                      <td>{top}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="err">{error}</p>
      <p className="muted">{hint}</p>
    </div>
  );
}
