// ============================================
// ESLint 9 (flat config) — TSENA Backend (NestJS + TypeScript)
// ============================================
// Exécuté par `npm run lint` (CI « Lint & Build ») : règles recommandées
// ESLint + typescript-eslint, adaptées à un backend NestJS (décorateurs,
// injection de dépendances, tests Jest).

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'storage/**', 'eslint.config.mjs', 'jest.config.js'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // Le projet compile avec `noImplicitAny: false` : `any` reste toléré (DTO dynamiques, requêtes TypeORM brutes).
      '@typescript-eslint/no-explicit-any': 'off',
      // Variables/arguments préfixés `_` = volontairement inutilisés (déstructurations pour retirer des champs sensibles).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // Modules optionnels chargés dynamiquement (sharp) et scripts de seed.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      // Entités TypeORM : le pattern `interface` vide pour l'augmentation de types est courant.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-namespace': 'off',
      // `catch {}` volontairement vides sont documentés par un commentaire ; interdits sinon.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  {
    // Tests : les mocks Jest justifient des typages souples.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
);
