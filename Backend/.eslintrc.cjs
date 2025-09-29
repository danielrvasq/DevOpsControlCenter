module.exports = {
  env: { node: true, es2021: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    semi: ['error', 'always'],
    'no-console': 'off',
    quotes: ['error', 'single'],
  },
};
