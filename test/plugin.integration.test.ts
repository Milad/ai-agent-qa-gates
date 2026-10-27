import { execFileSync, spawnSync } from "node:child_process";
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
  it.each(["directory", "file"])(
    "resolves restricted libraries from the %s root in every working directory",
    (marker) => {
      const fixtureRoot = mkdtempSync(path.join(tmpdir(), "qa-restricted-root-"));
      temporaryDirectories.push(fixtureRoot);
      const workspace = path.join(fixtureRoot, "mobile");
      const components = path.join(workspace, "src/components");
      const services = path.join(workspace, "src/services");
      mkdirSync(components, { recursive: true });
      mkdirSync(services, { recursive: true });
      if (marker === "directory") {
        mkdirSync(path.join(fixtureRoot, ".git"));
      } else {
        writeFileSync(path.join(fixtureRoot, ".git"), "gitdir: /unused/worktree\n");
      }
      writeFileSync(path.join(workspace, "package.json"), "{}");
      const allowedFile = path.join(components, "view.js");
      const deniedFile = path.join(services, "service.js");
      for (const filename of [allowedFile, deniedFile]) {
        writeFileSync(filename, 'import value from "blocked-lib/subpath";\nvoid value;\n');
      }
      const configPath = path.join(fixtureRoot, "isolated.oxlintrc.json");
      for (const allowedPath of ["./mobile/src/components", "./mobile/src/components/*.js"]) {
        writeFileSync(
          configPath,
          JSON.stringify({
            jsPlugins: [{ name: "qa", specifier: path.join(packageRoot, "index.cjs") }],
            rules: {
              "qa/restricted-libs": [
                "error",
                {
                  libraries: [{ name: "blocked-lib", allowImporters: [allowedPath] }],
                },
              ],
            },
          }),
        );
        for (const cwd of [fixtureRoot, workspace]) {
          const lint = (filename: string) =>
            spawnSync(
              oxlint,
              ["--config", configPath, "--disable-nested-config", "--format", "json", filename],
              { cwd, encoding: "utf8", stdio: "pipe" },
            );
          const allowed = lint(allowedFile);
          expect(JSON.parse(allowed.stdout).diagnostics).toEqual([]);
          expect(allowed.status).toBe(0);
          const denied = lint(deniedFile);
          expect(JSON.parse(denied.stdout).diagnostics).toEqual([
            expect.objectContaining({ code: "qa(restricted-libs)" }),
          ]);
          expect(denied.status).toBe(1);
        }
      }
    },
  );

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
