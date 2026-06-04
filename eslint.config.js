/* eslint-disable @typescript-eslint/no-require-imports */
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const reactNativePlugin = require('eslint-plugin-react-native');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');
/* eslint-enable @typescript-eslint/no-require-imports */

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  js.configs.recommended,
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ),
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Design-system guard: ban raw numeric borderRadius / fontSize literals.
      // Use radius.* / componentRadius.* and the fontSize scale instead.
      // 'warn' while a few files with entangled in-flight work await migration;
      // flip to 'error' once they're tokenized. See DESIGN.md › Design tokens.
      // (Tests are exempted below.)
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Property[key.name='borderRadius'] > Literal[raw=/^[0-9]/]",
          message:
            'Use radius.* or componentRadius.* tokens instead of a raw borderRadius number. See DESIGN.md › Radius.',
        },
        {
          selector: "Property[key.name='fontSize'] > Literal[raw=/^[0-9]/]",
          message:
            'Use the fontSize scale or m3.typography tokens instead of a raw fontSize number. See DESIGN.md › Typography.',
        },
      ],
      // Theming guard: ban the light-only static `colors`/`darkColors` named
      // imports from '@/styles/theme'. These are the dark-mode-UNSAFE path —
      // they render a single fixed palette regardless of theme. Use useM3()
      // (generic UI) or useThemeColors() (dark-aware legacy ramp, Phase 4
      // target) instead. The theme module itself is exempted below.
      // See docs/theming-consolidation-proposal.md.
      // TODO(theming Phase 4): also ban useThemeColors once all 54 consumers migrate.
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@/styles/theme',
              importNames: ['colors', 'darkColors'],
              message:
                'Do not import the static light-only `colors`/`darkColors` palette — it is not dark-aware. Use useM3() (generic UI) or useDomainColors() (category/water/lab), or useThemeColors() for the dark-aware legacy ramp. See docs/theming-consolidation-proposal.md.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'react-native/no-unused-styles': 'warn',
      'react-native/split-platform-components': 'warn',
      'react-native/no-inline-styles': 'off',
      'react-native/no-color-literals': 'off',
      'react-native/no-raw-text': 'off',
      'react-native/no-single-element-style-arrays': 'warn',
    },
  },
  prettierConfig,
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        __DEV__: 'readonly',
      },
    },
  },
  {
    // Tests use literal pixel values in fixtures and assertions — the
    // design-token guard doesn't apply to them.
    files: ['__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // The theme layer (theme.ts builds M3 from colors/darkColors; use-theme.ts
    // and use-domain-colors.ts source the dark-aware ramp) legitimately imports
    // the raw palette. Exempt it from the static-color import guard.
    files: ['src/styles/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      '.claude/',
      '.expo/',
      '.rnstorybook/',
      'dist/',
      'web-build/',
      'babel.config.js',
      'metro.config.js',
      'app.config.js',
      'eas.json',
    ],
  },
];
