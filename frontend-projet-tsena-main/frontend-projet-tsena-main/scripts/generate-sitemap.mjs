#!/usr/bin/env node
/**
 * Génère public/sitemap.xml :
 *  - routes publiques statiques ;
 *  - fiches produits actives récupérées depuis l'API (best effort : si l'API est injoignable,
 *    seul le sitemap statique est écrit et le build n'échoue pas).
 *
 * Variables : VITE_SITE_URL (obligatoire pour des URLs absolues), VITE_API_URL (optionnelle),
 *             VITE_ROUTER_MODE (préfixe `/#` en mode hash).
 */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function loadDotEnv() {
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = await readFile(path, 'utf8');
    for (const line of content.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

await loadDotEnv();
const siteUrl = (process.env.VITE_SITE_URL || '').replace(/\/+$/, '');
const apiUrl = (process.env.VITE_API_URL || '').replace(/\/+$/, '');
const prefix = process.env.VITE_ROUTER_MODE === 'hash' ? '/#' : '';

if (!siteUrl) {
  console.warn('[sitemap] VITE_SITE_URL non défini : sitemap généré avec des URLs relatives (à éviter en production).');
}

const today = new Date().toISOString().slice(0, 10);
const staticRoutes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/produits', priority: '0.9', changefreq: 'daily' },
  { path: '/promotions', priority: '0.7', changefreq: 'daily' },
  { path: '/a-propos', priority: '0.5', changefreq: 'monthly' },
  { path: '/contact', priority: '0.5', changefreq: 'monthly' },
  { path: '/inscription', priority: '0.4', changefreq: 'yearly' },
  { path: '/inscription/vendeur', priority: '0.6', changefreq: 'yearly' },
  { path: '/connexion', priority: '0.3', changefreq: 'yearly' },
];

const products = [];
if (apiUrl && /^https?:/.test(apiUrl)) {
  try {
    let page = 1;
    for (;;) {
      const res = await fetch(`${apiUrl}/products?limit=100&page=${page}&sortBy=createdAt&order=DESC`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      for (const p of body.data ?? []) products.push({ path: `/produits/${p.slug || p.id}`, lastmod: (p.updatedAt || p.createdAt || '').slice(0, 10) || today });
      if (!body.meta?.hasNextPage || page >= 50) break;
      page += 1;
    }
    console.log(`[sitemap] ${products.length} fiche(s) produit ajoutée(s).`);
  } catch (error) {
    console.warn(`[sitemap] API injoignable (${error instanceof Error ? error.message : error}) : sitemap statique uniquement.`);
  }
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const url = (path) => escape(`${siteUrl}${prefix}${path}`);
const entries = [
  ...staticRoutes.map((r) => `  <url><loc>${url(r.path)}</loc><lastmod>${today}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`),
  ...products.map((p) => `  <url><loc>${url(p.path)}</loc><lastmod>${p.lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
await writeFile(resolve(process.cwd(), 'public/sitemap.xml'), xml, 'utf8');
console.log(`[sitemap] public/sitemap.xml écrit (${entries.length} URL).`);
