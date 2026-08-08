import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { ISSUER } from '../lib/schema.js';

const MESSAGES = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'That is not a valid email address.',
  'auth/user-not-found': 'No account exists for that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error — check your connection.',
};

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(MESSAGES[err.code] || 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <div className="login-wrap">
        <div className="brand-block">
          <h1>WORKSHOPS</h1>
          <div className="org">{ISSUER.unitLine}</div>
        </div>
        <div className="rule" />

        <form onSubmit={submit}>
          <div className="field">
            <div className="lab"><label htmlFor="email">Email</label></div>
            <input
              id="email" type="email" autoComplete="username" required autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <div className="lab"><label htmlFor="password">Password</label></div>
            <input
              id="password" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="notice warn" role="alert">{error}</div>}

          <button className="primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="hint" style={{ marginTop: 18, textAlign: 'center' }}>
          Accounts are created by an administrator. There is no self sign-up.
        </p>
      </div>
    </main>
  );
}
