import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const requiredProductionEnv = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const spaEntryRoutes = [
  'login',
  'signup',
  'forgot-password',
  'reset-password',
  'auth/callback',
  'auth/forgot',
  'auth/reset',
  'dashboard',
  'profile',
  'restaurants',
  'restaurant/apply',
  'restaurant/onboarding',
  'restaurant',
  'restaurant/menu',
  'restaurant/settings',
  'admin',
  'admin/restaurants',
  'admin/audit',
  'driver',
  'driver/onboarding',
  'cart',
  'checkout',
  'orders',
  'favorites',
  'support',
];

function spaFallbackEntries() {
  return {
    name: 'kiyo-spa-fallback-entries',
    writeBundle() {
      const distDir = join(__dirname, 'dist');
      const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');

      for (const route of spaEntryRoutes) {
        const target = join(distDir, route, 'index.html');
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, indexHtml);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isVercelProduction = env.VERCEL === '1' && env.VERCEL_ENV === 'production';

  if (isVercelProduction) {
    const missing = requiredProductionEnv.filter((key) => !env[key]?.trim());
    if (missing.length > 0) {
      throw new Error(
        `Kiyo Food production build is missing required Vercel environment variables: ${missing.join(', ')}. ` +
          'Set them for the Production environment and redeploy.',
      );
    }
  }

  return {
    plugins: [react(), spaFallbackEntries()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-maps';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-router-dom')) return 'vendor-router';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
