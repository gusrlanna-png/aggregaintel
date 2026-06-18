/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Após um novo deploy, o SW novo assume o controle na hora (clientsClaim) e
  // apaga o precache/caches antigos (cleanupOutdatedCaches). Sem isso, um PWA já
  // instalado pode servir chunks antigos que não existem mais no servidor,
  // causando "client-side exception"/tela branca após cada atualização.
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/,
      handler: "NetworkFirst",
      options: { cacheName: "supabase-api", networkTimeoutSeconds: 5 },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "supabase-storage",
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^\//,
      handler: "NetworkFirst",
      options: { cacheName: "pages" },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  // Permite buildar para uma pasta separada (.next-new) e só então trocar pela
  // ativa — evita servir chunks inconsistentes durante o deploy. O `next start`
  // (sem a env) continua lendo `.next`. Ver scripts/deploy.sh.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "maps.googleapis.com" },
    ],
  },
};

module.exports = withPWA(nextConfig);
