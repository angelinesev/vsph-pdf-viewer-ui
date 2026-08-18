import type { Plan } from '../types';
import { brochureLimitLabel, formatBytes, storageLimitOf } from '../utils';

interface PlansGridProps {
  plans: Plan[];
}

export default function PlansGrid({ plans }: PlansGridProps) {
  if (!plans.length) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Plan</h2>
        </div>
        <div className="empty-state">VSPH Plan not configured. Run migration 007 / npm run apply:vsph-plan.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Plan</h2>
      </div>
      <div className="plan-grid">
        {plans.map((p, i) => {
          const fileMb = (Number(p.max_file_bytes || 0) / (1024 * 1024)).toFixed(0);
          return (
            <div className="plan-card featured" key={i}>
              <h3>{p.name}</h3>
              <div className="plan-metrics">
                <div>
                  <span className="muted">Brochures</span>
                  <strong>{brochureLimitLabel(p)}</strong>
                </div>
                <div>
                  <span className="muted">Max file</span>
                  <strong>{fileMb} MB</strong>
                </div>
                <div>
                  <span className="muted">Storage</span>
                  <strong>{formatBytes(storageLimitOf(p))}</strong>
                </div>
              </div>
              <p className="muted" style={{ margin: '0.75rem 0 0' }}>
                Single plan for all organizations.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
