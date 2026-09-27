/* Stand-in for src/firebase.js.
 *
 * Nothing here should reach a real project, and the harness has no .env of
 * its own — so `canStoreFiles` came back false and the library panel only
 * ever showed its "no file store configured" face. That face is worth
 * having and worth checking, but it is not the one the office will see.
 *
 * `?bucket=off` puts it back, because a project without Storage switched on
 * is a real state and the panel has to say so rather than failing deep
 * inside the SDK with a CORS error that names nothing.
 */
export const isConfigured = true;
export const canStoreFiles =
  new URLSearchParams(window.location.search).get('bucket') !== 'off';

/* No SDK objects at all. Every module that would use one is itself stubbed,
   so anything reaching these is a stub that was forgotten — and a null is a
   quicker way to find that than a half-real client talking to nothing. */
export const app = null;
export const auth = null;
export const db = null;
export const storage = null;
