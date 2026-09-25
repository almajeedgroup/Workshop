/* Stand-in for src/AuthContext.jsx.
 *
 * A signed-in administrator by default, because that is what most of the
 * admin needs to render at all. `?who=` switches identity, because the
 * student pages have three completely different faces and only one of them
 * is reachable as an administrator:
 *
 *   ?who=out       signed out — the sign-in door
 *   ?who=student   a signed-in student
 *   (anything else) the administrator
 */
import { createContext, useContext, useState } from 'react';

const WHO = new URLSearchParams(window.location.search).get('who') || '';

const ADMIN = { uid: 'harness', email: 'almajeed.work@gmail.com', displayName: 'Administrator' };
const STUDENT = { uid: 'harness-student', email: 'fathima@example.com', displayName: 'Fathima Zoha' };

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    WHO === 'out' ? null : WHO === 'student' ? STUDENT : ADMIN,
  );
  const value = {
    user,
    isAdmin: user?.uid === ADMIN.uid,
    loading: false,
    login: async () => {},
    loginWithGoogle: async () => {},
    // Signing in HERE is how the signed-out face is checked against the
    // signed-in one without a Google popup the harness cannot open.
    loginStudentWithGoogle: async () => { setUser(STUDENT); return { user: STUDENT }; },
    resetPassword: async () => {},
    logout: async () => { setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
