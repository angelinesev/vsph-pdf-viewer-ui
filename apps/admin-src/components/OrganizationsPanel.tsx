import { useState } from 'react';
import { callApi } from '../../shared/api';
import type { Organization } from '../types';
import { brochureLimitLabel, formatBytes, storageLimitOf } from '../utils';

interface OrganizationsPanelProps {
  jwt: string;
  orgs: Organization[];
  archivedOrgs: Organization[];
  orgTab: 'active' | 'archived';
  onTabChange: (tab: 'active' | 'archived') => void;
  onManageCode: (orgId: string) => void;
  onRefresh: () => void;
}

function statusLabel(status: string) {
  return status === 'active' ? { text: 'Active', cls: 'success' } : { text: 'Plan stop', cls: 'warn' };
}

export default function OrganizationsPanel({
  jwt,
  orgs,
  archivedOrgs,
  orgTab,
  onTabChange,
  onManageCode,
  onRefresh,
}: OrganizationsPanelProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');

  async function handleCreate() {
    setError('');
    try {
      await callApi('admin-orgs?action=create', {
        method: 'POST',
        adminJwt: jwt,
        body: { name, slug: slug || undefined },
      });
      setName('');
      setSlug('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const list = orgTab === 'archived' ? archivedOrgs : orgs;
  const archived = orgTab === 'archived';

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Organizations</h2>
        <div className="segment" role="tablist" aria-label="Organization lists">
          <button
            className={`tab-btn${orgTab === 'active' ? ' active' : ''}`}
            type="button"
            onClick={() => onTabChange('active')}
          >
            Active
          </button>
          <button
            className={`tab-btn${orgTab === 'archived' ? ' active' : ''}`}
            type="button"
            onClick={() => onTabChange('archived')}
          >
            {archivedOrgs.length ? `Archived (${archivedOrgs.length})` : 'Archived'}
          </button>
        </div>
      </div>

      {!archived && (
        <div>
          <div className="row">
            <div>
              <label>Name</label>
              <input placeholder="Ayala Land Estate" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label>Slug (for links)</label>
              <input placeholder="ALE" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
          </div>
          <button type="button" onClick={handleCreate}>
            Create organization
          </button>
          <p className="err">{error}</p>
        </div>
      )}
      {archived && (
        <p className="muted">Revoked organizations (Plan stop). Their PDFs and share links are no longer accessible.</p>
      )}

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Plan</th>
              <th>Brochures</th>
              <th>Storage</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  {archived ? 'No archived organizations.' : 'No active organizations yet.'}
                </td>
              </tr>
            )}
            {list.map((o) => {
              const planName = o.plans?.name || o.plan_id;
              const limit = brochureLimitLabel(o.plans);
              const active = o.active_brochures ?? o.usage_this_month ?? 0;
              const storage = formatBytes(o.storage_used_bytes || 0);
              const storageCap = formatBytes(storageLimitOf(o.plans));
              const badge = statusLabel(o.status);
              return (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                    <div className="muted">{o.slug}</div>
                  </td>
                  <td>{planName}</td>
                  <td>
                    {active} / {limit}
                  </td>
                  <td>
                    {storage} / {storageCap}
                  </td>
                  <td>
                    <span className={`badge ${badge.cls}`}>{badge.text}</span>
                  </td>
                  <td>
                    {archived ? (
                      <span className="muted">PDFs locked</span>
                    ) : (
                      <button className="secondary inline" type="button" onClick={() => onManageCode(o.id)}>
                        Manage code
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
