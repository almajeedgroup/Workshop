import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { ISSUER, BOOTSTRAP_ADMIN_EMAIL } from '../lib/schema.js';

const MESSAGES = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'That is not a valid email address.',
  'auth/user-not-found': 'No account exists for that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-disabled': 'That account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error — check your connection.',

  // Google sign-in
  'auth/popup-closed-by-user': 'The Google window was closed before sign-in finished.',
  'auth/cancelled-popup-request': 'The Google window was closed before sign-in finished.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/operation-not-allowed': 'Google sign-in is not enabled for this project yet.',
  'auth/unauthorized-domain': 'This address is not on the project’s list of authorised domains. Add it in Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/internal-error':
    'Google sign-in could not start. Usually this means the Google window was blocked, or this address is not on the project’s authorised domains list.',
  'auth/account-exists-with-different-credential':
    'An account already exists for that email with a password. Sign in with the password instead.',
  'app/not-the-owner': `Google sign-in is only for ${BOOTSTRAP_ADMIN_EMAIL}. Other administrators sign in with an email and password.`,
};

export default function LoginPage() {
  const { user, login, loginWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  if (loading) return <main><p className="count">Loading…</p></main>;
  // The console answers "what needs me today", which is what somebody
  // signing in wants before a list of every course ever run.
  if (user) return <Navigate to="/console" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('password');
    try {
      await login(email, password);
    } catch (err) {
      setError(MESSAGES[err.code] || 'Sign-in failed. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const google = async () => {
    setError('');
    setBusy('google');
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(MESSAGES[err.code] || err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setBusy('');
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

        <button
          type="button"
          onClick={google}
          disabled={Boolean(busy)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none' }}>
            <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.7" />
            <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.7 5.2-.1.3C7.9 41 15.4 46 24 46" />
            <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-.3l-6.8-5.3-.2.1C3 17 2.2 20.4 2.2 24s.8 7 2.3 9.9z" />
            <path fill="#EA4335" d="M24 10.3c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.1 29.9 2 24 2 15.4 2 7.9 7 4.5 14.1l7 5.5c1.8-5.3 6.7-9.3 12.5-9.3" />
          </svg>
          {busy === 'google' ? 'Opening Google…' : 'Sign in with Google'}
        </button>

        <div
          className="hint"
          style={{ textAlign: 'center', margin: '14px 0', letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 10 }}
        >
          or with a password
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <div className="lab"><label htmlFor="email">Email</label></div>
            <input
              id="email" type="email" autoComplete="username" required
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

          <button className="primary" type="submit" disabled={Boolean(busy)} style={{ width: '100%' }}>
            {busy === 'password' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="hint" style={{ marginTop: 18, textAlign: 'center' }}>
          Accounts are created by an administrator. There is no self sign-up.
        </p>
      </div>
    </main>
  );
}
