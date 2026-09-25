import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  plugins: [react()],
  resolve: {
    alias: [
      /* Only RELATIVE specifiers that walk straight up into lib/ — the
         ones the app itself writes. The stubs import the real modules as
         `../src/lib/...`, which has a `src/` segment and so does not
         match, letting each stub re-export the real thing and override
         just the calls that would go to Firestore. */
      { find: /^(?:\.\.\/)+lib\/publicdb\.js$/, replacement: here('./publicdb.js') },
      { find: /^(?:\.\.\/)+lib\/db\.js$/, replacement: here('./db.js') },
      { find: /^(?:\.\.\/)+lib\/attendancedb\.js$/, replacement: here('./attendancedb.js') },
      { find: /^(?:\.\.\/)+lib\/classroomdb\.js$/, replacement: here('./classroomdb.js') },
      { find: /^(?:\.\.\/)+lib\/photodb\.js$/, replacement: here('./photodb.js') },
      { find: /^(?:\.\.\/)+lib\/certdb\.js$/, replacement: here('./certdb.js') },
      { find: /^(?:\.\.\/)+lib\/librarydb\.js$/, replacement: here('./librarydb.js') },
      { find: /^(?:\.\.\/)+lib\/studentdb\.js$/, replacement: here('./studentdb.js') },
      { find: /^(?:\.{1,2}\/)+AuthContext\.jsx$/, replacement: here('./AuthContext.jsx') },
    ],
  },
  publicDir: here('../../public'),
  server: { port: 4180 },
});
