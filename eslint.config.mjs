// eslint.config.mjs
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import promise from "eslint-plugin-promise";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // --- Global ignores ---
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.cache/**",
      "**/.vite/**",
      "**/.next/**",
      "**/generated/**",
      "**/_history/**",
      "packages/brain/src/ui/**",
      "apps/sim-server/src/representation-learning-demo.ts",
      "apps/env-sandbox/src/index.js",
      "python/**/*.js",
    ],
  },

  // --- Base JS rules ---
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.es2023,
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },

  // --- TypeScript with proper parser ---
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.es2023,
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      unicorn,
      promise,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-fallthrough": "off",
      "no-empty": "off",
      "no-useless-assignment": "off",
      "no-console": "off",
      "no-debugger": "error",
      "no-unused-vars": [
        "off",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "import/first": "error",
      "import/no-duplicates": "error",
      "import/no-cycle": ["warn", { ignoreExternal: true }],

      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      "unicorn/prefer-node-protocol": "warn",
      "unicorn/no-array-for-each": "off",
      "unicorn/prevent-abbreviations": "off",

      "promise/always-return": "off",
      "promise/catch-or-return": "off",
      "preserve-caught-error": "off",
    },
  },

  // --- Shared plugins and rules for all files ---
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      unicorn,
      promise,
    },
    rules: {
      "no-console": "off",
      "no-debugger": "error",

      "import/first": "error",
      "import/no-duplicates": "error",
      "import/no-cycle": ["warn", { ignoreExternal: true }],

      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      "unicorn/prefer-node-protocol": "error",
      "unicorn/no-array-for-each": "off",
      "unicorn/prevent-abbreviations": "off",

      "promise/always-return": "off",
      "promise/catch-or-return": "off",
      "preserve-caught-error": "off",
    },
  },

  // --- No console in certain areas ---
  {
    files: ["apps/nucleus/**", "apps/**/scripts/**", "scripts/**"],
    rules: {
      "no-console": "off",
    },
  },

  // --- React-only extra rule ---
  {
    files: ["**/*.{tsx,jsx}"],
    rules: {
      "react/jsx-no-useless-fragment": "warn",
    },
  },

  // --- Prettier MUST be last ---
  prettier,
];
