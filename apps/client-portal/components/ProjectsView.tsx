import { useEffect, useState } from 'react';
import { callApi } from '../../shared/api';
import type { OrgAnalytics, Project, Quota } from '../types';
import StatsRow from './StatsRow';
import DeleteFolderModal from './DeleteFolderModal';
import Icon from './Icon';

interface ProjectsViewProps {
  token: string;
  quota: Quota | null;
  orgAnalytics: OrgAnalytics | null;
  orgAnalyticsError: boolean;
  onOpenProject: (project: Project) => void;
  onQuotaChange: () => void;
}

export default function ProjectsView({
  token,
  quota,
  orgAnalytics,
  orgAnalyticsError,
  onOpenProject,
  onQuotaChange,
}: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refreshProjects() {
    setError('');
    const res = await callApi<{ projects: Project[] }>('projects-list', { token });
    setProjects(res.projects || []);
    setLoaded(true);
  }

  useEffect(() => {
    refreshProjects().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setError('');
    try {
      await callApi('projects-create', { method: 'POST', token, body: { name } });
      setName('');
      await refreshProjects();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await callApi('projects-delete', {
        method: 'POST',
        token,
        body: { project_id: deleteTarget.id },
      });
      setDeleteTarget(null);
      await refreshProjects();
      onQuotaChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <StatsRow quota={quota} orgAnalytics={orgAnalytics} orgAnalyticsError={orgAnalyticsError} />

      <div className="panel">
        <div className="panel-head">
          <h2>Projects</h2>
        </div>
        <p className="muted">Folders for estates / developments (e.g. Miravera). Upload brochures inside each project.</p>
        <div className="row">
          <div>
            <label>New project name</label>
            <input placeholder="Miravera" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <button type="button" onClick={handleCreate}>
          Create project
        </button>
        <p className="err">{error}</p>
        <div className="plan-grid" style={{ marginTop: '1rem' }}>
          {loaded && projects.length === 0 && <div className="empty-state">No projects yet. Create one for your estate.</div>}
          {projects.map((p) => (
            <div key={p.id} className="folder-card-wrap">
              <button
                type="button"
                className="plan-card folder-card"
                onClick={() => onOpenProject(p)}
              >
                <h3>{p.name}</h3>
                <div className="plan-price-line">/{p.slug}</div>
                <div className="plan-metrics">
                  <div>
                    <span className="muted">Brochures</span>
                    <strong>{p.brochure_count || 0}</strong>
                  </div>
                  <div>
                    <span className="muted">Last upload</span>
                    <strong>{p.last_upload_at ? new Date(p.last_upload_at).toLocaleString() : '—'}</strong>
                  </div>
                </div>
              </button>
              {p.slug !== 'uncategorized' && (
                <button
                  type="button"
                  className="folder-card-delete icon-btn icon-btn-danger"
                  aria-label={`Delete folder ${p.name}`}
                  title="Delete folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(p);
                  }}
                >
                  <Icon name="delete" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {deleteTarget && (
        <DeleteFolderModal
          project={deleteTarget}
          deleting={deleting}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
