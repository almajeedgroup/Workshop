import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail,
} from 'firebase/auth';
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

  /**
   * Sign in with Google, owner account only.
   *
   * Google will happily sign anybody in, so anyone else who tried would land
   * on "Not authorised" — correct, but a confusing way to be told. Instead the
   * wrong account is signed straight back out and told plainly. The real
   * enforcement is unchanged and still on the server: the /admins allow-list,
   * which a Google sign-in does not shortcut.
   *
   * Other administrators keep using email and password — their /admins record
   * is keyed to that account.
   */
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account', login_hint: BOOTSTRAP_ADMIN_EMAIL });

    const credential = await signInWithPopup(auth, provider);
    const signedIn = (credential.user?.email || '').toLowerCase();

    if (signedIn !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      const err = new Error(`Google sign-in is only for ${BOOTSTRAP_ADMIN_EMAIL}.`);
      err.code = 'app/not-the-owner';
      throw err;
    }
    return credential;
  };

  /**
   * Send a reset link.
   *
   * An administrator locked out of the app previously had to be reset from
   * the Firebase Console by somebody who could still get in — which is no
   * help at all when the person locked out IS that somebody.
   */
  const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

  const logout = () => signOut(auth);

  return (
    <Ctx.Provider value={{ user, isAdmin, loading, login, loginWithGoogle, resetPassword, logout }}>
      {children}
    </Ctx.Provider>
  );
}
