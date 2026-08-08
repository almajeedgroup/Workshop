import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Firebase config is baked into the bundle at build time. Without a .env
 * the build still succeeds — and produces a site that shows "Setup required"
 * to everyone. `npm run deploy` is `vite build && firebase deploy`, so that
 * broken bundle would go straight to production without a word of warning.
 *
 * Fail the build instead. Set SKIP_ENV_CHECK=1 to build without config on
 * purpose (checking that the app compiles, say).
 */
const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

function assertConfigured(mode) {
  if (process.env.SKIP_ENV_CHECK) return;
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const missing = REQUIRED.filter((key) => !env[key]);
  if (!missing.length) return;

  throw new Error(
    `\n\nCannot build: the Firebase configuration is missing.\n\n` +
      `  ${missing.join('\n  ')}\n\n` +
      `Copy .env.example to .env and paste the values from\n` +
      `Firebase Console > Project settings > General > Your apps > Web app.\n\n` +
      `Building without them produces a site that shows "Setup required" to\n` +
      `every visitor. To build anyway, set SKIP_ENV_CHECK=1.\n`
  );
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') assertConfigured(mode);

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Keep the vendor libraries in their own long-cached chunks so an app
          // change doesn't force everyone to re-download Firebase.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          },
        },
      },
    },
  };
});
