// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/** Componentes nunca usam HttpClient: só os serviços de core/api (Art. II.1, contracts/api-services.md). */
const NO_HTTP_CLIENT = {
  name: '@angular/common/http',
  message: 'Use os serviços de src/app/core/api/*.api.ts; componentes não chamam HttpClient.',
};

module.exports = defineConfig([
  {
    ignores: [
      'dist/**',
      '.angular/**',
      'coverage/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'src/app/core/api/schema.gen.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'sm', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'sm', style: 'kebab-case' },
      ],
      // Art. III.1: `any` é proibido.
      '@typescript-eslint/no-explicit-any': 'error',
      // Parâmetros exigidos por assinatura (ex.: ngTemplateContextGuard) usam o prefixo `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Art. 4.1 e plano: componentes standalone e OnPush.
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
    },
  },
  {
    files: ['src/app/features/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [NO_HTTP_CLIENT] }],
    },
  },
  {
    // shared/ é só apresentacional (Art. II.1): sem HttpClient e sem serviços de API.
    files: ['src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [NO_HTTP_CLIENT],
          patterns: [
            {
              group: ['**/core/api/*.api', '**/core/api/*.api.ts'],
              message: 'shared/ é apresentacional: não importe serviços de API (Art. II.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
