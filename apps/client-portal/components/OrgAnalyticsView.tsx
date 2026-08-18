import type { OrgAnalytics } from '../types';

interface OrgAnalyticsViewProps {
  orgAnalytics: OrgAnalytics | null;
  orgAnalyticsError: boolean;
}

export default function OrgAnalyticsView({ orgAnalytics, orgAnalyticsError }: OrgAnalyticsViewProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Analytics</h2>
      </div>
      {orgAnalyticsError ? (
        <p className="muted">Run analytics migration to enable.</p>
      ) : (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Opens (30d)</div>
            <div className="stat-value">{orgAnalytics?.total ?? '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Unique (approx)</div>
            <div className="stat-value">{orgAnalytics?.unique_visitors ?? '—'}</div>
          </div>
        </div>
      )}
      <p className="muted" style={{ marginTop: '1rem' }}>
        For per-brochure analytics, open a project in Folders and click Stats on a brochure.
      </p>
    </div>
  );
}
