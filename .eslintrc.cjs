// eslint-disable-next-line mmkal/import/no-extraneous-dependencies
const recommended = require('eslint-plugin-mmkal').getRecommended()

module.exports = {
  ...recommended,
  // todo: let eslint-plugin-wrapper disable a whole plugin in one go. typescript-eslint struggles with this repo
  extends: [],
  overrides: [
    ...recommended.overrides,
    {
      files: ['*.md'],
      rules: {
        'mmkal/unicorn/filename-case': 'off',
        'mmkal/prettier/prettier': 'off',
      },
    },
  ],
  rules: {
    'mmkal/prettier/prettier': 'warn',
    'mmkal/@typescript-eslint/no-explicit-any': 'off',
    'mmkal/@typescript-eslint/no-unsafe-assignment': 'off',
    'mmkal/@typescript-eslint/no-unsafe-return': 'off',
    // vscode eslint seems to trip up on this because there are lots of complex typescript types in the implementation of this library
    'mmkal/@typescript-eslint/no-confusing-void-expression': 'off',
    'mmkal/@typescript-eslint/promise-function-async': 'off',
    'mmkal/@typescript-eslint/no-misused-promises': 'off',
    'mmkal/@rushstack/hoist-jest-mock': 'off',
  },
}
