import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'server/dist/**',
      'server/**/*.js',
      'server/migrations/**',
      'server/models/**',
      'server/jest.config.js',
      'src/docs/dist/search.js',
      'src/docs/dist/**',
      'src/docs/node_modules/**',
      'src/docs/**/*.js',
      'dist/**',
      'dev-dist/**',
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/docs/dist/**/*.js'],
    languageOptions: {
      globals: {
        browser: true,
      }
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'], // Client-side files
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.browser,
        console: true,
        window: true,
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^(e|error|_e)' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off'
    }
  },
  {
    files: ['server/**/*.{ts,tsx}'], // Server-side files
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        node: true,
        console: true,
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^(e|error|_e)' }],
    }
  }
];
