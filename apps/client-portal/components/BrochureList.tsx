import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { callApi } from '../../shared/api';
import type { Brochure, LinkResult } from '../types';
import Icon from './Icon';

interface BrochureListProps {
  token: string;
  projectId: string;
  searchTerm: string;
  onShare: (link: LinkResult) => void;
  onError: (message: string) => void;
  onDeleted: () => void;
}

export interface BrochureListHandle {
  refresh: () => void;
}

const BrochureList = forwardRef<BrochureListHandle, BrochureListProps>(function BrochureList(
  { token, projectId, searchTerm, onShare, onError, onDeleted },
  ref,
) {
  const [brochures, setBrochures] = useState<Brochure[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const list = await callApi<{ brochures: Brochure[] }>(`brochures-list?project_id=${encodeURIComponent(projectId)}`, {
      token,
    });
    setBrochures(list.brochures || []);
    setLoaded(true);
  }

  useImperativeHandle(ref, () => ({ refresh }));

  useEffect(() => {
    refresh().catch((err) => onError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleShare(id: string) {
    onError('');
    try {
      const link = await callApi<LinkResult>('links-create', { method: 'POST', token, body: { brochure_id: id } });
      onShare(link);
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleOpen(id: string) {
    onError('');
    try {
      const link = await callApi<LinkResult>('links-create', { method: 'POST', token, body: { brochure_id: id } });
      const url = link.vanity_url || link.token_url || link.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleDelete(id: string, title: string) {
    const ok = window.confirm(`Delete "${title}"?\n\nShare links will stop working and the file will be removed from storage.`);
    if (!ok) return;
    onError('');
    try {
      await callApi('brochures-delete', { method: 'POST', token, body: { brochure_id: id } });
      await refresh();
      onDeleted();
    } catch (err: any) {
      onError(err.message);
    }
  }

  const term = searchTerm.trim().toLowerCase();
  const visible = term
    ? brochures.filter((b) => (b.title || b.filename).toLowerCase().includes(term))
    : brochures;

  return (
    <div>
      <h2>Brochures &amp; history</h2>
      <div className="brochure-list">
        {loaded && brochures.length === 0 && <div className="empty-state">No brochures yet. Upload your first PDF.</div>}
        {loaded && brochures.length > 0 && visible.length === 0 && (
          <div className="empty-state">No flipbooks match "{searchTerm}".</div>
        )}
        {visible.map((b) => {
          const title = b.title || b.filename;
          return (
            <div className="brochure-item" key={b.id}>
              <div className="brochure-thumb">
                <Icon name={b.view_type === 'flyer' ? 'insert_drive_file' : 'description'} />
              </div>
              <div className="brochure-item-info">
                <div className="brochure-item-name">{title}</div>
                <div className="brochure-item-meta">
                  <span className="badge">{b.view_type}</span>
                  &nbsp;{new Date(b.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                <button className="icon-btn" type="button" aria-label="Share" title="Share" onClick={() => handleShare(b.id)}>
                  <Icon name="ios_share" />
                </button>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Open flipbook"
                  title="Open flipbook"
                  onClick={() => handleOpen(b.id)}
                >
                  <Icon name="visibility" />
                </button>
                <button
                  className="icon-btn icon-btn-danger"
                  type="button"
                  aria-label="Delete"
                  title="Delete"
                  onClick={() => handleDelete(b.id, title)}
                >
                  <Icon name="delete" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default BrochureList;
