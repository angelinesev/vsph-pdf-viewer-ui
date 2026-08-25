import { useState } from 'react';
import { callApi } from '../../shared/api';
import Icon from './Icon';

interface LoginPanelProps {
  onLogin: (token: string) => void;
}

export default function LoginPanel({ onLogin }: LoginPanelProps) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    try {
      const data = await callApi<{ token: string }>('developer-login', {
        method: 'POST',
        body: { code, password },
      });
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Client sign in</h1>
        <p className="lead">Use the access code provided by your admin</p>
        <label htmlFor="code">Access codes</label>
        <input 
          id="code"
          autoComplete="username"
          placeholder="ORG-CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <label htmlFor="password">Password</label>
        <div className="password-field">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
          >
            <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
          </button>
        </div>
        <button type="button" onClick={handleLogin}>
          Sign in
        </button>
        <p className="err">{error}</p>
      </div>
    </div>
  );
}
