import type { OrgAnalytics, Quota } from '../types';
import { formatBytes, pct } from '../utils';

interface StatsRowProps {
  quota: Quota | null;
  orgAnalytics: OrgAnalytics | null;
  orgAnalyticsError: boolean;
}

export default function StatsRow({ quota, orgAnalytics, orgAnalyticsError }: StatsRowProps) {
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? null;

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-label">Active brochures</div>
        <div className="stat-value">
          <span>{used}</span> / <span>{limit == null ? 'Unlimited' : limit}</span>
        </div>
        <div className="meter">
          <span style={{ width: `${pct(used, limit)}%` }} />
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Storage used</div>
        <div className="stat-value">{formatBytes(quota?.storage_used)}</div>
        <div className="stat-sub">
          {quota?.max_storage_bytes == null ? 'Custom storage limit' : `of ${formatBytes(quota.max_storage_bytes)}`}
        </div>
        <div className="meter">
          <span
            style={{
              width: quota?.max_storage_bytes == null ? '0%' : `${pct(quota?.storage_used ?? 0, quota.max_storage_bytes)}%`,
            }}
          />
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Opens (30d)</div>
        <div className="stat-value">{orgAnalyticsError ? '—' : orgAnalytics?.total ?? '—'}</div>
        <div className="stat-sub">
          {orgAnalyticsError
            ? 'Run analytics migration to enable'
            : orgAnalytics
              ? `${orgAnalytics.unique_visitors || 0} unique (approx)`
              : '—'}
        </div>
      </div>
    </div>
  );
}
