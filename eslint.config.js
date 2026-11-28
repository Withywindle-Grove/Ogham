// ESLint: flags common mistakes and React hook misuse (the recommended rules), plus the project's hard-rule and size
// checks (docs/specs/hard-rule-and-size-checks.md).
// Runs as part of `npm run check` (see docs/testing.md).
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// Hard rule 1: no AI service in the app. Each known AI service's client packages (by exact name, or every package under
// a scope) and API hosts. To ban a new service, add it here: this list is the one place the check reads
// (docs/specs/hard-rule-and-size-checks.md, check 2).
const AI_SERVICES = [
  { service: 'OpenAI', packages: ['openai'], scopes: ['@openai'], hosts: ['api.openai.com'] },
  // Every Azure OpenAI resource is a sub-domain of openai.azure.com, which the host scan finds inside a longer host.
  { service: 'Azure OpenAI', packages: ['@azure/openai'], scopes: [], hosts: ['openai.azure.com'] },
  { service: 'Anthropic', packages: [], scopes: ['@anthropic-ai'], hosts: ['api.anthropic.com'] },
  {
    service: 'Google generative AI',
    packages: ['@google/generative-ai', '@google/genai', '@google-cloud/vertexai', '@google-cloud/aiplatform'],
    scopes: ['@google-ai'],
    hosts: ['generativelanguage.googleapis.com', 'aiplatform.googleapis.com'],
  },
  { service: 'Mistral', packages: [], scopes: ['@mistralai'], hosts: ['api.mistral.ai', 'codestral.mistral.ai'] },
  { service: 'Cohere', packages: ['cohere-ai'], scopes: ['@cohere-ai'], hosts: ['api.cohere.ai', 'api.cohere.com'] },
  { service: 'Groq', packages: ['groq-sdk'], scopes: [], hosts: ['api.groq.com'] },
  { service: 'Together', packages: ['together-ai'], scopes: [], hosts: ['api.together.xyz', 'api.together.ai'] },
  { service: 'Replicate', packages: ['replicate'], scopes: [], hosts: ['api.replicate.com'] },
  {
    service: 'Hugging Face inference',
    packages: [],
    scopes: ['@huggingface'],
    hosts: ['api-inference.huggingface.co', 'router.huggingface.co'],
  },
  { service: 'Ollama', packages: ['ollama'], scopes: [], hosts: ['localhost:11434', '127.0.0.1:11434', 'ollama.com'] },
  { service: 'LangChain', packages: ['langchain'], scopes: ['@langchain'], hosts: ['api.smith.langchain.com'] },
  { service: 'Vercel AI SDK', packages: ['ai'], scopes: ['@ai-sdk'], hosts: ['ai-gateway.vercel.sh'] },
];
const AI_PACKAGES = AI_SERVICES.flatMap((s) => s.packages);
const AI_SCOPES = AI_SERVICES.flatMap((s) => s.scopes);
const AI_HOSTS = AI_SERVICES.flatMap((s) => s.hosts);
// A listed package by its exact name or a sub-path of it ('openai', 'openai/resources'), or any package under a listed
// scope ('@anthropic-ai/sdk'); a longer name that only starts alike ('openai-lantern') is not one.
const isAiPackage = (source) =>
  AI_PACKAGES.some((name) => source === name || source.startsWith(`${name}/`)) ||
  AI_SCOPES.some((scope) => source.startsWith(`${scope}/`));
// A break goes to Francis, never to the list: the message says to remove it, and to ask him before changing the list.
const AI_FIX =
  'Remove it; the app never calls an AI service. If it is not one, ask Francis before changing AI_SERVICES in eslint.config.js.';

// The project's own lint rules, kept here (no package). Each has its own name, so ESLint's suppressions file
// (eslint-suppressions.json, the known old breaks; docs/testing.md) counts each rule's cases on their own.
const MAX_LINES = 400;
const tome = {
  rules: {
    // Hard rule 1: no AI service's client package imported (also re-exported, or imported later), and no AI service's
    // API host named in a string or a template literal.
    'no-ai-service': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const checkSource = (source) => {
          if (source && source.type === 'Literal' && typeof source.value === 'string' && isAiPackage(source.value)) {
            context.report({
              node: source,
              message: `No AI service in the app (hard rule 1): '${source.value}' is an AI service's client package. ${AI_FIX}`,
            });
          }
        };
        const checkText = (node, text) => {
          const lower = text.toLowerCase();
          const host = AI_HOSTS.find((h) => lower.includes(h));
          if (host) {
            context.report({
              node,
              message: `No AI service in the app (hard rule 1): this names ${host}, an AI service's API host. ${AI_FIX}`,
            });
          }
        };
        return {
          ImportDeclaration: (node) => checkSource(node.source),
          ExportNamedDeclaration: (node) => checkSource(node.source),
          ExportAllDeclaration: (node) => checkSource(node.source),
          ImportExpression: (node) => checkSource(node.source),
          Literal(node) {
            if (typeof node.value === 'string') checkText(node, node.value);
          },
          TemplateElement(node) {
            checkText(node, node.value.cooked ?? node.value.raw);
          },
        };
      },
    },
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
    // cs-10: a source file stays at 400 lines or fewer. Counts as ESLint's own `max-lines` does with every line counted
    // (blank lines and comments too), the empty line after the last newline left out; reported once, at line 401.
    'max-lines': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        return {
          Program() {
            const lines = context.sourceCode.lines;
            const count = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
            if (count <= MAX_LINES) return;
            context.report({
              loc: { start: { line: MAX_LINES + 1, column: 0 }, end: { line: count, column: lines[count - 1].length } },
              message: `This file has ${count} lines; a source file stays at ${MAX_LINES} or fewer (cs-10). Find the second module in it and move that to its own file.`,
            });
          },
        };
      },
    },
  },
};

// Hard rule 6, the other direction: core has no single public entry, so these core files are it, the ones modules
// use. A module that needs another core file adds it here, in a reviewed change
// (docs/specs/hard-rule-and-size-checks.md, check 1).
const ALLOWED_CORE_FILES = [
  'alignments.ts',
  'campaignCommands.ts',
  'campaignSettings.ts',
  'chargeUnit.ts',
  'commands.ts',
  'currentUser.ts',
  'database.types.ts',
  'eventTags.ts',
  'events.ts',
  'files.ts',
  'marchingRows.ts',
  'nameWords.ts',
  'partyGroups.ts',
  'storedWords.ts',
  'supabase.ts',
  'timeWords.ts',
  'travelWords.ts',
  'undo.ts',
  'useWords.ts',
];
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A relative import that reaches into a `core` folder and does not name exactly one listed file. It matches a folder
// named `core` anywhere in the path, not only src/core; none other exists, and if one did the error would be a false
// failure (the safe way), so the pattern stays simple.
const UNLISTED_CORE_FILE = `^(\\.\\.?/)+(.*/)?core/(?!(${ALLOWED_CORE_FILES.map(escapeRegex).join('|')})$)`;

export default defineConfig([
  // .claude holds helper agents' copies of the repo (git worktrees); they aren't part of this one.
  globalIgnores(['dist', 'dev-dist', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
      // Type-aware lint reads each file's types through tsconfig.json. Two files fall outside its program, so they get
      // a default project with the same settings: a config file outside its `include`, and a .tsx test that shares its
      // name with a .ts one (TypeScript keeps only the .ts).
      parserOptions: {
        projectService: {
          allowDefaultProject: ['playwright.chromium.config.ts', 'src/app/packUpdateReachesItems.test.tsx'],
          defaultProject: 'tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // cs-22: a failure is never swallowed. A promise is awaited, returned or given a rejection handler, and a
      // promise-returning function goes only where a promise is expected. The old breaks are in eslint-suppressions.json.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
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
    // Hard rule 6, the other direction: a module reaches core only through the allowed list above.
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: UNLISTED_CORE_FILE,
              message:
                'Modules use only the allowed core files (hard rule 6). To use another core file, add it to ALLOWED_CORE_FILES in eslint.config.js in a reviewed change.',
            },
          ],
        },
      ],
    },
  },
  {
    // Hard rule 1: no AI service in the app's own code (its tests included). The repository's scripts and the CI
    // workflows are not the app, so they are not checked.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { tome },
    rules: { 'tome/no-ai-service': 'error' },
  },
  {
    // Hard rule 10: no `disabled` attribute on a control in the app's components (tests may render one to check it).
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { tome },
    rules: { 'tome/no-disabled': 'error' },
  },
  {
    // cs-10: a source file stays at 400 lines or fewer, counting every line (blank lines and comments too). Tests and
    // the generated database types are not checked; stylesheets are not either (lint does not read CSS without a new
    // package). The old long files are known in eslint-suppressions.json; a known file that grows stays quiet (the
    // record covers the file, not its size).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'src/core/database.types.ts'],
    plugins: { tome },
    rules: { 'tome/max-lines': 'error' },
  },
  {
    // cs-10 for the repository's scripts too: an agent reads them whole like any source file. Their tests are not
    // checked.
    files: ['scripts/**/*.{js,mjs}'],
    ignores: ['**/*.test.mjs'],
    plugins: { tome },
    rules: { 'tome/max-lines': 'error' },
  },
]);
