import { useEffect, useRef, useState } from 'react';
import { callApi } from '../../shared/api';
import type { AccessCode, Organization } from '../types';

interface AccessCodePanelProps {
  jwt: string;
  orgs: Organization[];
  selectedOrgId: string;
  onSelectOrg: (id: string) => void;
  onRevoked: () => void;
  scrollSignal: number;
}

export default function AccessCodePanel({ jwt, orgs, selectedOrgId, onSelectOrg, onRevoked, scrollSignal }: AccessCodePanelProps) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadCodes() {
    if (!selectedOrgId) return;
    const res = await callApi<{ codes: AccessCode[] }>(`admin-orgs?action=codes&org_id=${encodeURIComponent(selectedOrgId)}`, {
      adminJwt: jwt,
    });
    setCodes(res.codes || []);
  }

  useEffect(() => {
    loadCodes().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  useEffect(() => {
    if (scrollSignal > 0) {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollSignal]);

  async function handleCreate() {
    setMessage('');
    setError('');
    try {
      const res = await callApi<{ code: AccessCode }>('admin-orgs?action=create-code', {
        method: 'POST',
        adminJwt: jwt,
        body: { org_id: selectedOrgId, code, password },
      });
      setMessage(`Created code ${res.code.code}`);
      setCode('');
      setPassword('');
      loadCodes();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRotate() {
    setMessage('');
    setError('');
    try {
      const res = await callApi<{ code: AccessCode }>('admin-orgs?action=rotate-code', {
        method: 'POST',
        adminJwt: jwt,
        body: { org_id: selectedOrgId, code, password },
      });
      setMessage(`Rotated to code ${res.code.code}`);
      setCode('');
      setPassword('');
      loadCodes();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRevoke(id: string) {
    const ok = window.confirm(
      'Revoke this code and set the organization to Plan stop?\n\nIt will move to Archived. All PDFs and share links for this org will stop working.',
    );
    if (!ok) return;
    setError('');
    try {
      await callApi('admin-orgs?action=revoke-code', { method: 'POST', adminJwt: jwt, body: { id } });
      setMessage('Organization moved to Archived (Plan stop). PDFs locked.');
      onRevoked();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="panel" ref={containerRef}>
      <div className="panel-head">
        <h2>Access code</h2>
      </div>
      <p className="muted">
        One login per organization. Use <strong>Rotate code</strong> to replace credentials. <strong>Revoke</strong> sets status to
        Plan stop, moves the org to Archived, and makes all of its PDFs inaccessible.
      </p>
      <div className="row">
        <div>
          <label>Organization</label>
          <select value={selectedOrgId} onChange={(e) => onSelectOrg(e.target.value)}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Code</label>
          <input placeholder="ACME-DEV" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ marginTop: '0.75rem', gap: '0.5rem' }}>
        <button type="button" onClick={handleCreate}>
          Create access code
        </button>
        <button className="secondary" type="button" onClick={handleRotate}>
          Rotate code
        </button>
      </div>
      <p className={error ? 'err' : 'ok'}>{error || message}</p>
      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
                  No access code for this org.
                </td>
              </tr>
            )}
            {codes.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.code}</strong>
                </td>
                <td>
                  <span className={`badge ${c.active ? 'success' : 'muted'}`}>{c.active ? 'Active' : 'Revoked'}</span>
                </td>
                <td>{new Date(c.created_at).toLocaleString()}</td>
                <td>
                  {c.active && (
                    <button className="danger inline" type="button" onClick={() => handleRevoke(c.id)}>
                      Revoke &amp; archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
