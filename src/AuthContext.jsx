import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, isConfigured } from './firebase.js';
import { BOOTSTRAP_ADMIN_EMAIL } from './lib/schema.js';
import { isListedAdmin, registerOwner } from './lib/db.js';

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

      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Signing in is not the same as being authorised: anyone holding the
      // public API key can create an account. Authorisation is the /admins
      // allow-list and nothing else, exactly as firestore.rules enforces it.
      let allowed = await isListedAdmin(u.uid);

      if (!allowed) {
        // First sign-in by the permanent owner. The rules let that one
        // address add itself to the list — which is the only thing this
        // address can do that others cannot.
        const isOwner = (u.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        if (isOwner) allowed = await registerOwner(u);
      }

      setIsAdmin(allowed);
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
