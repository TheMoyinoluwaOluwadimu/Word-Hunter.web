import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built site run from any folder or static host.
export default defineConfig(({ mode }) => {
  // Link previews (og:image) need an absolute address. Use VITE_SITE_URL if it is set (your own
  // domain), else the production address Vercel provides at build time, else leave them relative
  // (fine for local work).
  const env = loadEnv(mode, '.', '');
  const siteUrl = (
    env.VITE_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  ).replace(/\/+$/, '');

  return {
    base: './',
    plugins: [
      react(),
      {
        name: 'site-url',
        transformIndexHtml: (html: string) => html.split('__SITE_URL__').join(siteUrl),
      },
    ],
  };
});
