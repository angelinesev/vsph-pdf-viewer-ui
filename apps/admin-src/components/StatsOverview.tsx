import type { Organization, Plan } from '../types';
import { brochureLimitLabel, formatBytes, storageLimitOf } from '../utils';

interface StatsOverviewProps {
  orgs: Organization[];
  plan: Plan | undefined;
}

export default function StatsOverview({ orgs, plan }: StatsOverviewProps) {
  const totalBrochures = orgs.reduce((sum, o) => sum + (o.active_brochures ?? o.usage_this_month ?? 0), 0);

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-label">Organizations</div>
        <div className="stat-value">{orgs.length}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Active brochures</div>
        <div className="stat-value">{totalBrochures}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Plan</div>
        <div className="stat-value">{plan ? plan.name : 'VSPH'}</div>
        <div className="stat-sub">{plan ? `${brochureLimitLabel(plan)} brochures · ${formatBytes(storageLimitOf(plan))}` : '—'}</div>
      </div>
    </div>
  );
}
