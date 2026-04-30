// commitlint configuration — https://commitlint.js.org
// Install hooks: cd frontend && npx husky init && npm pkg set scripts.prepare='husky'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // nouvelle fonctionnalité
        'fix',      // correction de bug
        'docs',     // documentation seule
        'style',    // formatage, sans changement de code
        'refactor', // refactorisation sans changement de comportement
        'perf',     // amélioration de performance
        'test',     // ajout/modification de tests
        'build',    // build system, dépendances
        'ci',       // intégration continue
        'chore',    // maintenance
        'revert'    // revert de commit
      ]
    ],
    'scope-enum': [
      2,
      'always',
      ['backend', 'frontend', 'db', 'ops', 'docs', 'security', 'auth', 'files', 'tags', 'release', '']
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100]
  }
};
