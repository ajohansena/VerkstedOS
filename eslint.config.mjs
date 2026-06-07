import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config.
 *
 * NOTE: CLAUDE.md § 15 step 10 documents a legacy `.eslintrc.cjs` extending
 * `next/core-web-vitals`. With Next 16 + ESLint 9, eslint-config-next's bundled
 * react plugin is incompatible across the ESLint 9/10 boundary, so we use the
 * canonical `typescript-eslint` flat config instead. The `@typescript-eslint`
 * recommended set + the no-`any` rule cover the TS rules CLAUDE.md cares about;
 * the AUTHORITATIVE module-boundary enforcement lives in
 * `.dependency-cruiser.cjs` (cross-module backreferences ESLint cannot
 * express). The zones below are a fast first-line check.
 *
 * Follow-up: re-introduce Next-specific lint rules (next/core-web-vitals,
 * react-hooks) once their ESLint 9/10 flat-config compatibility settles.
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'migrations/**',
      'next-env.d.ts',
      '**/*.cjs',
      'eslint.config.mjs',
    ],
  },

  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'module-boundaries': importPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'module-boundaries/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/modules/*/presentation',
              from: './src/modules/*/infrastructure',
              message:
                'Presentation must call through application, never infrastructure directly.',
            },
            {
              target: './src/modules/*/domain',
              from: './src/modules/*/application',
              message: 'Domain must stay pure — no imports from application.',
            },
            {
              target: './src/modules/*/domain',
              from: './src/modules/*/infrastructure',
              message:
                'Domain must stay pure — no imports from infrastructure.',
            },
          ],
        },
      ],
    },
  },

  {
    // Ambient declaration files legitimately use `declare namespace` for
    // module augmentation (e.g. NodeJS.ProcessEnv).
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
    },
  },
);
