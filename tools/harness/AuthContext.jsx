/* Stand-in for src/AuthContext.jsx.
 *
 * A signed-in administrator by default, because that is what most of the
 * admin needs to render at all. `?who=` switches identity, because the
 * student pages have three completely different faces and only one of them
 * is reachable as an administrator:
 *
 *   ?who=out       signed out — the sign-in door
 *   ?who=student   a signed-in student
 *   ?who=new       a signed-in student holding no ticket at all
 *   ?who=stuck     the OWNER address, not on the allow-list — the case where
 *                  the bootstrap write was refused, which looks completely
 *                  different and is the only one that IS a fault
 *   (anything else) the administrator
 *
 * A student identity is ALSO how the admin area's refusal gets looked at:
 * a browser holds one account, so signing in as a student is exactly what
 * puts a real person on that screen.
 */
import { createContext, useContext, useState } from 'react';

const WHO = new URLSearchParams(window.location.search).get('who') || '';

const ADMIN = { uid: 'harness', email: 'almajeed.work@gmail.com', displayName: 'Administrator' };
const STUDENT = { uid: 'harness-student', email: 'fathima@example.com', displayName: 'Fathima Zoha' };

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    WHO === 'out' ? null
      : (WHO === 'student' || WHO === 'new') ? STUDENT
        : WHO === 'stuck' ? { ...ADMIN, uid: 'gEulxFxyA6VOk41cSdUVcnDm4Ny1' }
          : ADMIN,
  );
  const value = {
    user,
    isAdmin: WHO !== 'stuck' && user?.uid === ADMIN.uid,
    loading: false,
    login: async () => {},
    loginWithGoogle: async () => {},
    // Signing in HERE is how the signed-out face is checked against the
    // signed-in one without a Google popup the harness cannot open.
    loginStudentWithGoogle: async () => { setUser(STUDENT); return { user: STUDENT }; },
    /* The email door, including its failures — those are most of what there
       is to look at, and a stub that always succeeds shows none of them. */
    signUpStudent: async (email, password, name) => {
      if (String(email).startsWith('taken@')) {
        const e = new Error('in use'); e.code = 'auth/email-already-in-use'; throw e;
      }
      setUser({ uid: 'harness-new', email, displayName: name || '' });
      return { user: { uid: 'harness-new', email } };
    },
    signInStudent: async (email) => {
      if (String(email).startsWith('wrong@')) {
        const e = new Error('nope'); e.code = 'auth/invalid-credential'; throw e;
      }
      setUser(STUDENT);
      return { user: STUDENT };
    },
    redirectError: null,
    resetPassword: async () => {},
    logout: async () => { setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
