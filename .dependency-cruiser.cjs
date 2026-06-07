/**
 * dependency-cruiser — the authoritative module-boundary gate (CI).
 *
 * Enforces the bounded-context rules from docs/02-system-architecture.md and
 * CLAUDE.md § 4.6:
 *   - cross-module imports must go through `public/` (never another module's
 *     domain/application/infrastructure/presentation)
 *   - presentation may not import its own module's infrastructure
 *   - no circular dependencies
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-internals',
      comment:
        'Cross-module imports must go through public/. Never deep-import another module.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)' },
      to: {
        path: '^src/modules/([^/]+)/(domain|application|infrastructure|presentation)',
        pathNot: '^src/modules/$1',
      },
    },
    {
      name: 'presentation-not-infrastructure',
      comment:
        'Presentation must call through application, not infrastructure.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/presentation' },
      to: { path: '^src/modules/$1/infrastructure' },
    },
    {
      name: 'no-circular',
      comment: 'Circular dependencies are forbidden.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
