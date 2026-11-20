import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Remplace `__SITE_URL__` dans index.html par `VITE_SITE_URL` (sans slash final) afin que les
 * balises Open Graph statiques soient absolues même pour les robots n'exécutant pas JavaScript.
 * Sans variable définie, les URLs restent relatives (fonctionnel, mais moins bien partagé).
 */
function siteUrlPlugin(siteUrl: string): Plugin {
  return {
    name: 'tsena-site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Cible du proxy de développement : permet d'utiliser `VITE_API_URL=/api` (même origine,
  // aucun problème CORS ni de cookies) tout en gardant le backend sur son propre port.
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:3000';
  const siteUrl = (env.VITE_SITE_URL || '').replace(/\/+$/, '');

  return {
    plugins: [react(), tailwindcss(), siteUrlPlugin(siteUrl)],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        // Fichiers téléversés servis par le backend (pilote de stockage local)
        '/uploads': { target: proxyTarget, changeOrigin: true },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true,
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          // Découpage des dépendances lourdes en chunks stables (meilleur cache navigateur).
          // Vite 8 (Rolldown) : `codeSplitting.groups` remplace `manualChunks`.
          //
          // RÈGLE ABSOLUE : aucun cycle d'imports entre chunks. Un cycle (ex. react → common → query → react)
          // fait évaluer un chunk avant celui dont il dépend : les liaisons `var` sont encore indéfinies et
          // l'application plante au démarrage avec « n is not a function » (incident de production, oct. 2026,
          // provoqué par le helper de préchargement Vite — utilisé par react-router — rangé dans `common`).
          // Chaque groupe inclut donc TOUTES ses dépendances (`includeDependenciesRecursively`, valeur par
          // défaut) : un chunk n'importe que des groupes de priorité supérieure, jamais `common`.
          codeSplitting: {
            groups: [
              // Socle : react, react-dom, scheduler, react-router (+ ses dépendances `cookie`, `set-cookie-parser`
              // et le helper de préchargement Vite). Priorité maximale : tout le reste en dépend.
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 30,
              },
              // Petits utilitaires partagés par l'application ET par recharts : isolés pour que l'entrée
              // n'importe pas le chunk `charts` (≈375 kB) uniquement pour `clsx`.
              {
                name: 'utils',
                test: /node_modules[\\/](clsx|tailwind-merge|use-sync-external-store|react-is)[\\/]/,
                priority: 25,
              },
              { name: 'query', test: /node_modules[\\/](@tanstack|axios)[\\/]/, priority: 20 },
              {
                name: 'motion',
                test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
                priority: 20,
              },
              // recharts et sa fermeture (redux, immer, d3-*, victory-vendor…) : chargé uniquement par les
              // tableaux de bord (routes paresseuses).
              {
                name: 'charts',
                test: /node_modules[\\/](recharts|d3-.*|victory-vendor)[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
  };
});
