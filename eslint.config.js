import { base } from "@vllnt/eslint-config";
import convex from "@vllnt/eslint-config/convex";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "**/_generated/**", "coverage/**"] },
  ...base,
  // Configuration keys are external rule identifiers, not variable names.
  {
    files: ["eslint.config.js", "scripts/check-pack.mjs"],
    rules: { "@typescript-eslint/naming-convention": "off" },
  },
  {
    files: ["scripts/*.mjs"],
    languageOptions: {
      globals: {
        clearTimeout: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  ...convex,
  {
    languageOptions: {
      parserOptions: { project: "./tsconfig.lint.json", projectService: false },
    },
  },
  // Convex return validators require null, not undefined.
  {
    files: ["src/component/**/*.ts", "example/convex/**/*.ts"],
    rules: { "unicorn/no-null": "off" },
  },
  // Fixture endpoints intentionally share one module; all validation rules remain enabled.
  {
    files: ["example/convex/example.ts"],
    rules: {
      "convex-rules/namespace-separation": "off",
      "convex-rules/standard-filenames": "off",
    },
  },
  // Tests express ordered transactions; loops and long suites are intentional.
  {
    files: ["**/*.test.ts"],
    rules: {
      "functional/no-loop-statements": "off",
      "max-lines-per-function": "off",
    },
  },
  // Apply convex rules to component source (same structure as a convex/ folder)
  {
    files: ["src/component/**/*.ts"],
    ignores: ["src/component/_generated/**"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "convex-rules/namespace-separation": "error",
      "convex-rules/no-bare-v-any": "error",
      "convex-rules/no-filter-on-query": "error",
      "convex-rules/no-query-in-loop": "error",
      "convex-rules/require-returns-validator": "error",
      "convex-rules/snake-case-filenames": "error",
      "convex-rules/standard-filenames": "error",
    },
  },
  // Exempt config, validator, and schema files from strict naming rules
  {
    files: [
      "src/component/convex.config.ts",
      "src/component/validators.ts",
      "src/component/schema.ts",
    ],
    rules: {
      "convex-rules/namespace-separation": "off",
      "convex-rules/standard-filenames": "off",
    },
  },
];
