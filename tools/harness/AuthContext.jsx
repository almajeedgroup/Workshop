/* Stand-in for src/AuthContext.jsx: a signed-in administrator, always. */
import { createContext, useContext } from 'react';

const USER = { uid: 'harness', email: 'almajeed.work@gmail.com', displayName: 'Administrator' };
const VALUE = { user: USER, isAdmin: true, loading: false, logout: async () => {} };

const Ctx = createContext(VALUE);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  return <Ctx.Provider value={VALUE}>{children}</Ctx.Provider>;
}
