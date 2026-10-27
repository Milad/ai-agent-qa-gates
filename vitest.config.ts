import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      exclude: ["**/*.test.*", "node_modules/**"],
      include: ["index.cjs", "rules/**/*.cjs"],
      provider: "v8",
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
