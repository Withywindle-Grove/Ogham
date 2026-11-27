// ESLint: flags common mistakes and React hook misuse. Recommended rules only.
// Runs as part of `npm run check` (see docs/testing.md).
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// The project's own lint rules, kept here (no package). Each has its own name, so ESLint's suppressions file
// (eslint-suppressions.json, the known old breaks; docs/testing.md) counts each rule's cases on their own.
const tome = {
  rules: {
    // Hard rule 10: never a disabled button. A blocked action stays tappable and explains why in a pop-up.
    'no-disabled': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          'JSXAttribute[name.name="disabled"]'(node) {
            context.report({
              node,
              message: 'Never a disabled button (hard rule 10): keep it tappable and explain why in a pop-up.',
            });
          },
        };
      },
    },
  },
};

export default defineConfig([
  // .claude holds helper agents' copies of the repo (git worktrees); they aren't part of this one.
  globalIgnores(['dist', 'dev-dist', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Hard rule 3: screens never write to the database directly; they call commands (src/core/commands.ts).
    files: ['src/app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@supabase/supabase-js', message: 'Screens call commands (runCommand), not Supabase.' }] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name=/^(from|rpc|storage)$/][object.name=/^(db|supabase)$/]",
          message: 'Screens call commands (runCommand), not the database.',
        },
      ],
    },
  },
  {
    // Hard rule 6: core never imports a module; modules plug in through the registry.
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/modules/**'], message: 'Core never imports a module (hard rule 6). Use the registry.' }] },
      ],
    },
  },
  {
    // Hard rule 10: no `disabled` attribute on a control in the app's components (tests may render one to check it).
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { tome },
    rules: { 'tome/no-disabled': 'error' },
  },
]);
