import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/generated.ts',
    ],
  },
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      'vue/singleline-html-element-content-newline': 'off',
      'vue/max-attributes-per-line': 'off',
    },
  },
  {
    files: ['apps/web/src/components/ui/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/html-self-closing': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'node:*',
            '@exhibition/backend',
            '@exhibition/db',
            '@exhibition/ai',
          ],
        },
      ],
    },
  },
);
