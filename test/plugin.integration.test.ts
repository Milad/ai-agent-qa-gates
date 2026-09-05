import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dirname, "..");
const oxlint = path.join(packageRoot, "node_modules", ".bin", "oxlint");
const temporaryDirectories: string[] = [];

function createFixture() {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "ai-agent-qa-gates-"));
  temporaryDirectories.push(fixtureRoot);
  mkdirSync(path.join(fixtureRoot, "internal"));
  writeFileSync(path.join(fixtureRoot, "internal", "dependency.js"), "export const value = 1;\n");
  writeFileSync(
    path.join(fixtureRoot, "violations.js"),
    [
      "// forbidden comment",
      'export { value } from "./internal/dependency.js";',
      'import blocked from "blocked-lib/subpath";',
      'import { Pool } from "pg";',
      "new Pool();",
      "void blocked;",
      "",
    ].join("\n"),
  );

  const config = {
    jsPlugins: [{ name: "qa", specifier: path.join(packageRoot, "index.cjs") }],
    rules: {
      "qa/no-comments": "error",
      "qa/no-re-exports": "error",
      "qa/restricted-construction": [
        "error",
        { constructs: [{ export: "Pool", maxPerRepo: 0, module: "pg" }] },
      ],
      "qa/restricted-libs": ["error", { libraries: [{ allowImporters: [], name: "blocked-lib" }] }],
      "qa/whitelist-imports": [
        "error",
        {
          allow: [{ importers: [], target: "./internal" }],
        },
      ],
    },
  };
  const configPath = path.join(fixtureRoot, "isolated.oxlintrc.json");
  writeFileSync(configPath, JSON.stringify(config));
  return { configPath, fixtureRoot };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("published plugin", () => {
  it("loads all five rules using only an explicit fixture configuration", () => {
    const { configPath, fixtureRoot } = createFixture();
    let diagnostics = "";

    try {
      execFileSync(oxlint, ["--config", configPath, "--disable-nested-config", "violations.js"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      const processError = error as { stderr?: string; stdout?: string };
      diagnostics = `${processError.stdout ?? ""}\n${processError.stderr ?? ""}`;
    }

    expect(diagnostics).toContain("qa(no-comments)");
    expect(diagnostics).toContain("qa(no-re-exports)");
    expect(diagnostics).toContain("qa(restricted-construction)");
    expect(diagnostics).toContain("qa(restricted-libs)");
    expect(diagnostics).toContain("qa(whitelist-imports)");
  });

  it("enforces project boundaries when Oxlint runs below the Git root", () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "ai-agent-qa-gates-root-"));
    temporaryDirectories.push(fixtureRoot);
    const domainDirectory = path.join(fixtureRoot, "src/domain");
    const uiDirectory = path.join(fixtureRoot, "src/ui");
    mkdirSync(path.join(fixtureRoot, ".git"));
    mkdirSync(domainDirectory, { recursive: true });
    mkdirSync(uiDirectory, { recursive: true });
    writeFileSync(path.join(domainDirectory, "model.js"), "export const value = 1;\n");
    writeFileSync(
      path.join(uiDirectory, "view.js"),
      'import { value } from "../domain/model.js";\nvoid value;\n',
    );
    const configPath = path.join(fixtureRoot, "isolated.oxlintrc.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        jsPlugins: [{ name: "qa", specifier: path.join(packageRoot, "index.cjs") }],
        rules: {
          "qa/whitelist-imports": ["error", { allow: [{ importers: [], target: "./src/domain" }] }],
        },
      }),
    );
    let diagnostics = "";

    try {
      execFileSync(oxlint, ["--config", configPath, "--disable-nested-config", "view.js"], {
        cwd: uiDirectory,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      const processError = error as { stderr?: string; stdout?: string };
      diagnostics = `${processError.stdout ?? ""}\n${processError.stderr ?? ""}`;
    }

    expect(diagnostics).toContain("qa(whitelist-imports)");
  });
});
