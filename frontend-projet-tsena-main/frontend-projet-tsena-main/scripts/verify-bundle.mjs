#!/usr/bin/env node
// ============================================
// Vérification du bundle de production (dist/) — à lancer après `vite build`
// ============================================
// Deux contrôles qui ont manqué lors de l'incident « n is not a function » en production :
//
//  1. Graphe d'imports STATIQUES entre chunks : un cycle (ex. react → common → query → react)
//     fait évaluer un chunk avant celui dont il dépend ; les liaisons `var` encore indéfinies
//     donnent « X is not a function » et l'application reste sur l'écran « Chargement… ».
//  2. Évaluation réelle de l'entrée dans Node + jsdom : l'ordre d'évaluation ESM y est identique
//     à celui du navigateur, donc toute erreur d'initialisation est reproduite sans Chromium.
//
// Usage : node scripts/verify-bundle.mjs [dist]   (code de sortie 1 en cas de problème)

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const distDir = path.resolve(process.argv[2] ?? 'dist');
const assetsDir = path.join(distDir, 'assets');

if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error(`✖ ${distDir}/index.html introuvable — lancez d'abord \`vite build\`.`);
  process.exit(1);
}

// ---------- 1. Graphe des imports statiques ----------
const STATIC_IMPORT = /(?:^|[;\s}])import\s*(?:[^'"`]*?from\s*)?["'`]\.\/([^"'`]+\.js)["'`]/g;
const EXPORT_FROM = /export\s*\{[^}]*\}\s*from\s*["'`]\.\/([^"'`]+\.js)["'`]/g;

const files = (await readdir(assetsDir)).filter((f) => f.endsWith('.js'));
const graph = new Map();
for (const file of files) {
  const source = await readFile(path.join(assetsDir, file), 'utf8');
  const deps = new Set();
  for (const re of [STATIC_IMPORT, EXPORT_FROM]) {
    re.lastIndex = 0;
    for (const match of source.matchAll(re)) deps.add(match[1]);
  }
  deps.delete(file);
  graph.set(file, deps);
}

/** Tarjan : composantes fortement connexes de taille > 1 = cycles entre chunks. */
function stronglyConnectedComponents(nodes) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const low = new Map();
  const result = [];
  function visit(v) {
    indices.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of nodes.get(v) ?? []) {
      if (!nodes.has(w)) continue;
      if (!indices.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), indices.get(w)));
      }
    }
    if (low.get(v) === indices.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) result.push(component.sort());
    }
  }
  for (const v of nodes.keys()) if (!indices.has(v)) visit(v);
  return result;
}

const cycles = stronglyConnectedComponents(graph);
let failed = false;
if (cycles.length > 0) {
  failed = true;
  console.error('✖ Cycle(s) d’imports statiques entre chunks (ordre d’évaluation non garanti) :');
  for (const component of cycles) {
    console.error(`   • ${component.join(' ⇄ ')}`);
    for (const chunk of component) {
      const inside = [...graph.get(chunk)].filter((d) => component.includes(d));
      console.error(`       ${chunk} → ${inside.join(', ')}`);
    }
  }
  console.error('   Ajustez `build.rollupOptions.output.codeSplitting.groups` dans vite.config.ts : un groupe ne doit');
  console.error('   contenir que des paquets « feuilles » (qui n’importent rien hors du groupe, ni le helper de préchargement Vite).');
} else {
  console.log(`✔ Aucun cycle entre les ${graph.size} chunks (imports statiques).`);
}

// ---------- 2. Fermeture statique de l'entrée (ce que le navigateur télécharge avant le premier rendu) ----------
const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
const entries = [...html.matchAll(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+)"/g)].map((m) => m[1]);
if (entries.length === 0) {
  console.error('✖ Aucun <script type="module"> trouvé dans index.html.');
  process.exit(1);
}

const initial = new Set();
const queue = [...entries];
while (queue.length > 0) {
  const chunk = queue.shift();
  if (initial.has(chunk) || !graph.has(chunk)) continue;
  initial.add(chunk);
  queue.push(...graph.get(chunk));
}
let initialBytes = 0;
for (const chunk of initial) initialBytes += (await readFile(path.join(assetsDir, chunk))).byteLength;
console.log(`ℹ Fermeture initiale : ${initial.size} chunk(s), ${(initialBytes / 1024).toFixed(0)} kB (${[...initial].join(', ')}).`);
// Les bibliothèques réservées aux tableaux de bord (routes paresseuses) ne doivent jamais être chargées au démarrage.
const LAZY_ONLY = /^charts-/;
const leaked = [...initial].filter((chunk) => LAZY_ONLY.test(chunk));
if (leaked.length > 0) {
  failed = true;
  console.error(`✖ Chunk(s) réservé(s) aux routes paresseuses importé(s) statiquement par l’entrée : ${leaked.join(', ')}.`);
  console.error('   Un utilitaire partagé (ex. `clsx`) a probablement été capturé par le groupe `charts` : ajoutez-le au groupe `utils`.');
}

// ---------- 3. Évaluation réelle de l'entrée (ordre ESM identique au navigateur) ----------

let JSDOM;
let VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  console.warn('⚠ jsdom indisponible : évaluation de l’entrée ignorée (seuls le graphe et la fermeture ont été vérifiés).');
  process.exit(failed ? 1 : 0);
}

// Console virtuelle : on ne relaie que les erreurs internes de jsdom utiles (pas les « Not implemented »
// ni les console.error applicatifs attendus — le backend est volontairement injoignable ici).
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  if (!/Not implemented/i.test(error?.message ?? '')) console.error(`   [jsdom] ${error.message}`);
});
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'https://tsena.example/',
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;
window.scrollTo = () => {};
// Expose le DOM simulé en global (les chunks sont écrits pour le navigateur).
for (const key of ['window', 'self', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage',
  'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'matchMedia',
  'requestAnimationFrame', 'cancelAnimationFrame', 'DOMParser', 'Image', 'HTMLIFrameElement', 'SVGElement', 'Text',
  'Document', 'DocumentFragment', 'ShadowRoot', 'CSSStyleDeclaration', 'KeyboardEvent', 'MouseEvent', 'PointerEvent',
  'FocusEvent', 'InputEvent', 'TouchEvent', 'UIEvent', 'PageTransitionEvent', 'PromiseRejectionEvent', 'ErrorEvent', 'Storage']) {
  const value = window[key];
  if (value === undefined) continue;
  try {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  } catch {
    /* propriété non redéfinissable (ex. `navigator` sur Node ≥ 21) : on garde la valeur native */
  }
}
globalThis.matchMedia ??= () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
window.matchMedia ??= globalThis.matchMedia;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
globalThis.scrollTo ??= () => {};
// Les appels réseau ne doivent pas sortir du processus : réponse « backend injoignable ».
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
globalThis.XMLHttpRequest = window.XMLHttpRequest;

const INIT_ERROR = /is not a function|is not a constructor|before initialization|is not defined|Cannot read properties of undefined/i;
const timer = setTimeout(() => {
  console.error('✖ L’évaluation de l’entrée ne s’est pas terminée en 20 s.');
  process.exit(1);
}, 20_000);

try {
  for (const entry of entries) {
    await import(pathToFileURL(path.join(assetsDir, entry)).href);
  }
  // Laisse React monter (microtâches + un tick) pour capturer une erreur de rendu initial.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const root = window.document.getElementById('root');
  const mounted = root && root.children.length > 0 && !/Chargement de Tsena/.test(root.textContent ?? '');
  if (mounted) {
    console.log(`✔ Entrée ${entries.join(', ')} évaluée et application montée (${root.textContent.trim().slice(0, 60)}…).`);
  } else {
    console.warn('⚠ Entrée évaluée sans erreur, mais aucun rendu détecté dans #root (vérification manuelle conseillée).');
  }
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const frame = (error instanceof Error ? error.stack ?? '' : '').split('\n').find((l) => l.includes('/assets/'));
  if (INIT_ERROR.test(message)) {
    // Erreur d'initialisation = bundle inutilisable dans un vrai navigateur → échec du build.
    failed = true;
    console.error(`✖ Erreur à l’évaluation du bundle : ${message}`);
    if (frame) console.error(`   ${frame.trim()}`);
    console.error('   → symptôme typique d’un cycle entre chunks ou d’un mélange de builds : voir le point 1 ci-dessus.');
  } else {
    // Limite de l'environnement simulé (API DOM absente de jsdom…) : signalée sans bloquer le déploiement.
    console.warn(`⚠ Évaluation interrompue par une erreur non liée à l’ordre des chunks : ${message}`);
    if (frame) console.warn(`   ${frame.trim()}`);
  }
} finally {
  clearTimeout(timer);
  dom.window.close();
}

process.exit(failed ? 1 : 0);
