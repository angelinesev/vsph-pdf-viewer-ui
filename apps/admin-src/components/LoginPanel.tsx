import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callApi } from '../../shared/api';

interface LoginPanelProps {
  supabase: SupabaseClient;
  onLogin: (jwt: string) => void;
}

export default function LoginPanel({ supabase, onLogin }: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function handleLogin() {
    setError('');
    setOk('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message);
      return;
    }
    const jwt = data.session!.access_token;
    try {
      await callApi('admin-me', { adminJwt: jwt });
      onLogin(jwt);
    } catch (err: any) {
      setError(err.message + ' — use Bootstrap or add user to platform_admins.');
    }
  }

  async function handleBootstrap() {
    setError('');
    setOk('');
    try {
      await callApi('admin-bootstrap', {
        method: 'POST',
        body: { email: email.trim(), password, bootstrap_secret: bootstrapSecret },
      });
      setOk('Admin created. Click Sign in.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Admin sign in</h1>
        <p className="lead">Manage the VSPH plan, organizations, and client access codes.</p>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" onClick={handleLogin}>
          Sign in
        </button>
        <details>
          <summary>First-time setup</summary>
          <label htmlFor="bootstrapSecret">Bootstrap secret</label>
          <input
            id="bootstrapSecret"
            type="password"
            placeholder="BOOTSTRAP_SECRET"
            value={bootstrapSecret}
            onChange={(e) => setBootstrapSecret(e.target.value)}
          />
          <button className="secondary" type="button" onClick={handleBootstrap}>
            Create first admin
          </button>
        </details>
        <p className={ok ? 'ok' : 'err'}>{ok || error}</p>
        <p className="muted" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <a href="/">Back to home</a>
        </p>
      </div>
    </div>
  );
}
