import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { isConfigured } from './firebase.js';
import { ISSUER } from './lib/schema.js';

import LoginPage from './pages/LoginPage.jsx';
import ListPage from './pages/ListPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import WorkshopPage from './pages/WorkshopPage.jsx';
import EditPage from './pages/EditPage.jsx';
import TicketPage from './pages/TicketPage.jsx';

function SetupNotice() {
  return (
    <main>
      <div className="panel">
        <h2>Setup required</h2>
        <p>
          No Firebase configuration was found. Copy <code>.env.example</code> to{' '}
          <code>.env</code>, paste the values from your Firebase project settings, then
          restart the dev server.
        </p>
        <p className="hint">See README.md for the full setup walkthrough.</p>
      </div>
    </main>
  );
}

function Masthead() {
  const { user, isAdmin, logout } = useAuth();
  return (
    <header className="masthead no-print">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}>WORKSHOPS</Link>
      <span className="org">{ISSUER.unitLine}</span>
      <span className="spacer" />
      {isAdmin && (
        <nav>
          <NavLink to="/" end className="navlink">Records</NavLink>
          <NavLink to="/import" className="navlink">Import Text</NavLink>
          <NavLink to="/new" className="navlink">Add Manually</NavLink>
        </nav>
      )}
      {user && (
        <>
          <span className="who">{user.email}</span>
          <button className="small" onClick={logout}>Sign out</button>
        </>
      )}
    </header>
  );
}

/** Signed in AND on the /admins allow-list. */
function Protected({ children }) {
  const { user, isAdmin, loading, logout } = useAuth();
  if (loading) return <main><p className="count">Loading…</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <main>
        <div className="panel">
          <h2>Not authorised</h2>
          <p>
            You are signed in as <strong>{user.email}</strong>, but this account has not
            been added to the administrator list.
          </p>
          <p className="hint">
            An existing administrator must create a document with ID <code>{user.uid}</code>{' '}
            in the <code>admins</code> collection in Firestore.
          </p>
          <p className="hint">
            If this should be the owner account, check that the address matches{' '}
            <code>BOOTSTRAP_ADMIN_EMAIL</code> in <code>src/lib/schema.js</code> and the
            same address in <code>firestore.rules</code>.
          </p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button onClick={logout}>Sign out</button>
          </div>
        </div>
      </main>
    );
  }
  return children;
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="shell">
        <Masthead />
        <SetupNotice />
      </div>
    );
  }

  return (
    <div className="shell">
      <Masthead />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><ListPage /></Protected>} />
        <Route path="/import" element={<Protected><ImportPage /></Protected>} />
        <Route path="/new" element={<Protected><EditPage mode="new" /></Protected>} />
        <Route path="/w/:id" element={<Protected><WorkshopPage /></Protected>} />
        <Route path="/w/:id/edit" element={<Protected><EditPage mode="edit" /></Protected>} />
        <Route path="/w/:id/t/:regId" element={<Protected><TicketPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="foot no-print">
        {ISSUER.name} · system by {ISSUER.operator}
      </footer>
    </div>
  );
}
