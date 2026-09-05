import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      exclude: ["**/*.test.*", "node_modules/**"],
      include: ["index.cjs", "rules/**/*.cjs"],
      provider: "v8",
      thresholds: {
        branches: 99,
        functions: 99,
        lines: 99,
        statements: 99,
      },
    },
  },
});
