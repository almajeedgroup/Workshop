import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, isConfigured } from './firebase.js';
import { BOOTSTRAP_ADMIN_EMAIL } from './lib/schema.js';
import { isListedAdmin, registerOwner } from './lib/db.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

/**
 * What the app keeps about who is signed in.
 *
 * A snapshot, not the Firebase user object. Three fields is everything this
 * app reads, and a plain object is a NEW reference every time — which is
 * what makes a name set just after sign-up actually appear. Firebase mutates
 * its user in place, so re-rendering on it never happens.
 */
const snapshot = (u) => (u
  ? { uid: u.uid, email: u.email || '', displayName: u.displayName || '' }
  : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isConfigured);
  const [redirectError, setRedirectError] = useState(null);

  useEffect(() => {
    if (!isConfigured) return;
    /* A redirect sign-in finishes on THIS load, not the one that started it.
       Asking for the result is what surfaces its error — without this a
       student sent round to Google and refused comes back to a page that
       simply looks signed out, with nothing said. */
    getRedirectResult(auth).catch((e) => setRedirectError(e));

    return onAuthStateChanged(auth, async (u) => {
      setUser(snapshot(u));

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
   * Sign a STUDENT in with Google.
   *
   * Separate from `loginWithGoogle` above, and it must stay separate: that
   * one signs out anybody who is not the owner, which is right for the
   * administrator door and would throw every student straight back out.
   *
   * This one accepts whoever arrives. That is safe because SIGNING IN IS
   * NOT A PERMISSION anywhere in this app — `firestore.rules` grants an
   * account nothing until it holds a membership, and a membership needs a
   * claim on a ticket the course really issued. A student account can read
   * one course's library and cannot read a workshop, a registration, a
   * phone number or another student's anything. The rules audit proves
   * that with a signed-in account that has claimed nothing.
   *
   * `prompt: select_account` because a shared family machine is the normal
   * case here, and silently reusing whichever Google account happens to be
   * signed in would claim a ticket against the wrong person — and a claim
   * is exclusive, so it would take the office to undo.
   */
  const loginStudentWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      return await signInWithPopup(auth, provider);
    } catch (e) {
      /* A POPUP IS THE WRONG DEFAULT FOR THIS AUDIENCE and it took a
         complaint to see it. Links to this site get sent on WhatsApp, and a
         WhatsApp link opens in WhatsApp's own in-app browser, where Google
         refuses OAuth in a popup outright. Same for Instagram, and for any
         phone browser with pop-ups blocked. The whole page goes to Google
         instead, which works everywhere — see getRedirectResult above for
         the other half. */
      const popupUnavailable = [
        'auth/popup-blocked',
        'auth/operation-not-supported-in-this-environment',
        'auth/web-storage-unsupported',
        'auth/cancelled-popup-request',
      ].includes(e?.code);
      if (!popupUnavailable) throw e;

      await signInWithRedirect(auth, provider);
      return null;                       // the page is leaving; nothing follows
    }
  };

  /**
   * A student account with an email and a password.
   *
   * Here because Google is not universal: a student on a school machine, or
   * one whose only account is their parent's, cannot use it — and on this
   * audience's phones the popup is refused often enough that a second way in
   * is not a luxury.
   *
   * It grants nothing on its own. Like the Google path, an account holds no
   * access until it claims a ticket a course really issued.
   */
  const signUpStudent = async (email, password, name = '') => {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const clean = String(name || '').trim().slice(0, 120);
    if (clean) {
      await updateProfile(credential.user, { displayName: clean });
      // onAuthStateChanged has already fired, with no name on it. The
      // snapshot is re-taken so the office sees who claimed the ticket
      // rather than a blank in the members list.
      setUser(snapshot(credential.user));
    }
    return credential;
  };

  /** The same account, on the next visit. */
  const signInStudent = (email, password) =>
    signInWithEmailAndPassword(auth, email.trim(), password);

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
    <Ctx.Provider value={{
      user, isAdmin, loading, login, loginWithGoogle,
      loginStudentWithGoogle, signUpStudent, signInStudent,
      redirectError, resetPassword, logout,
    }}>
      {children}
    </Ctx.Provider>
  );
}
