import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isConfigured } from './firebase.js';
import { BOOTSTRAP_ADMIN_EMAIL } from './lib/schema.js';
import { ensureAdminRecord } from './lib/db.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Signing in is not the same as being authorised. Access comes from
        // the /admins allow-list, plus the permanent owner account so the
        // first ever sign-in isn't locked out. This mirrors firestore.rules —
        // the server enforces the same two conditions.
        const isOwner =
          (u.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        if (isOwner) {
          setIsAdmin(true);
          // Record the owner in the admins list on first sign-in. Best-effort:
          // access does not depend on it, so a failure here is not fatal.
          ensureAdminRecord(u);
        } else {
          try {
            const snap = await getDoc(doc(db, 'admins', u.uid));
            setIsAdmin(snap.exists());
          } catch {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);
  const logout = () => signOut(auth);

  return (
    <Ctx.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}
