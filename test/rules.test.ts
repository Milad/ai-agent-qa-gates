import { createRequire } from "node:module";
import path from "node:path";
import { RuleTester } from "oxlint/plugins-dev";

const require = createRequire(import.meta.url);
const noCommentsPlugin = require("../rules/no-comments.cjs");
const noReExportsPlugin = require("../rules/no-re-exports.cjs");
const restrictedConstructionPlugin = require("../rules/restricted-construction.cjs");
const restrictedLibsPlugin = require("../rules/restricted-libs.cjs");
const whitelistImportsPlugin = require("../rules/whitelist-imports.cjs");
const aggregatePlugin = require("../index.cjs");

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

describe("package exports", () => {
  it("exports all five rules from one plugin", () => {
    expect(Object.keys(aggregatePlugin.rules).sort()).toEqual([
      "no-comments",
      "no-re-exports",
      "restricted-construction",
      "restricted-libs",
      "whitelist-imports",
    ]);
  });
});

ruleTester.run("no-comments", noCommentsPlugin.rules["no-comments"], {
  valid: [
    "const value = 1;",
    {
      code: "// oxlint-disable-next-line\nconst value = 1;",
      options: [{ allow: ["oxlint-disable"] }],
    },
  ],
  invalid: [
    {
      code: "// explanation\nconst value = 1;\n",
      errors: [{ message: /Comments are forbidden/ }],
      output: "const value = 1;\n",
    },
    {
      code: "const value = 1; // explanation\n",
      errors: [{ message: /Comments are forbidden/ }],
      output: "const value = 1; \n",
    },
    {
      code: "// first\n// second\nconst value = 1;\n",
      errors: [{ message: /Comments are forbidden/ }],
      output: "const value = 1;\n",
    },
    {
      code: "const value = 1;\n// final comment",
      errors: [{ message: /Comments are forbidden/ }],
      output: "const value = 1;\n",
    },
    {
      code: "// first\n// allowed\n// third\nconst value = 1;\n",
      errors: [{ message: /Comments are forbidden/ }, { message: /Comments are forbidden/ }],
      options: [{ allow: ["allowed"] }],
      output: "// allowed\nconst value = 1;\n",
    },
  ],
});

ruleTester.run("no-re-exports", noReExportsPlugin.rules["no-re-exports"], {
  valid: [
    "const value = 1; export { value };",
    'export {} from "./dependency.js";',
    "export default 1;",
  ],
  invalid: [
    { code: 'export * from "./dependency.js";', errors: [{ message: /Re-exporting/ }] },
    { code: 'export { value } from "./dependency.js";', errors: [{ message: /Re-exporting/ }] },
    {
      code: 'import { value as local } from "./dependency.js"; export { local };',
      errors: [{ message: /Re-exporting/ }],
    },
    {
      code: 'import value from "./dependency.js"; export default value;',
      errors: [{ message: /Re-exporting/ }],
    },
  ],
});

ruleTester.run("restricted-libs", restrictedLibsPlugin.rules["restricted-libs"], {
  valid: [
    {
      code: 'import value from "blocked-lib/subpath";',
      filename: path.join(process.cwd(), "webapp/src/components/nested/view.test.tsx"),
      options: [
        {
          libraries: [{ allowImporters: ["./webapp/src/**/*.test.{ts,tsx}"], name: "blocked-lib" }],
        },
      ],
    },
    {
      code: 'import value from "blocked-lib";',
      filename: path.join(process.cwd(), "src", "allowed.ts"),
      options: [{ libraries: [{ allowImporters: ["./src"], name: "blocked-lib" }] }],
    },
    {
      code: 'import value from "another-lib";',
      filename: path.join(process.cwd(), "outside.ts"),
      options: [{ libraries: [{ allowImporters: [], name: "blocked-lib" }] }],
    },
  ],
  invalid: [
    {
      code: 'const value = require("blocked-lib");',
      errors: [{ message: /Importing "blocked-lib" is restricted/ }],
      filename: path.join(process.cwd(), "src/components/view.tsx"),
      options: [
        {
          libraries: [{ allowImporters: ["./src/**/*.test.{ts,tsx}"], name: "blocked-lib" }],
        },
      ],
    },
    {
      code: 'import value from "blocked-lib/subpath";',
      errors: [{ message: /Importing "blocked-lib\/subpath" is restricted/ }],
      filename: path.join(process.cwd(), "outside.ts"),
      options: [{ libraries: [{ allowImporters: [], name: "blocked-lib" }] }],
    },
    {
      code: 'const value = require("blocked-lib");',
      errors: [{ message: "Use the adapter." }],
      filename: path.join(process.cwd(), "outside.ts"),
      options: [
        { libraries: [{ allowImporters: [], message: "Use the adapter.", name: "blocked-lib" }] },
      ],
    },
    {
      code: 'export { value } from "blocked-lib";',
      errors: [{ message: /Importing "blocked-lib" is restricted/ }],
      filename: path.join(process.cwd(), "outside.ts"),
      options: [{ libraries: [{ allowImporters: [], name: "blocked-lib" }] }],
    },
  ],
});

ruleTester.run("whitelist-imports", whitelistImportsPlugin.rules["whitelist-imports"], {
  valid: [
    {
      code: 'import "./no-comments.cjs";',
      filename: path.join(process.cwd(), "rules", "synthetic.ts"),
      options: [{ allow: [] }],
    },
    {
      code: 'import "../rules/no-comments.cjs";',
      filename: path.join(process.cwd(), "test/synthetic.test.ts"),
      options: [{ allow: [{ target: "./rules", importers: ["./test/**/*.test.{ts,tsx}"] }] }],
    },
  ],
  invalid: [
    {
      code: 'import "../rules/no-comments.cjs";',
      errors: [{ message: /Unexpected import/ }],
      filename: path.join(process.cwd(), "test", "synthetic.ts"),
      options: [{ allow: [] }],
    },
    {
      code: 'import "../rules/no-comments.cjs";',
      errors: [{ message: /Unexpected import/ }],
      filename: path.join(process.cwd(), "test/synthetic.ts"),
      options: [{ allow: [{ target: "./rules", importers: ["./test/**/*.test.{ts,tsx}"] }] }],
    },
  ],
});

ruleTester.run(
  "whitelist-imports allowTypesOnly",
  whitelistImportsPlugin.rules["whitelist-imports"],
  {
    valid: [
      'import type Value from "../rules/no-comments.cjs";',
      'import type * as Types from "../rules/no-comments.cjs";',
      'import type { Value } from "../rules/no-comments.cjs";',
      'import { type Value, type Other as Renamed } from "../rules/no-comments.cjs";',
      'export type { Value } from "../rules/no-comments.cjs";',
      'export type * from "../rules/no-comments.cjs";',
      'export { type Value } from "../rules/no-comments.cjs";',
    ]
      .map((code) => ({
        code,
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          { allow: [{ target: "./rules", importers: [["./test", { allowTypesOnly: true }]] }] },
        ],
      }))
      .concat([
        {
          code: 'import Value from "../rules/no-comments.cjs";',
          filename: path.join(process.cwd(), "test/synthetic.ts"),
          options: [
            { allow: [{ target: "./rules", importers: [["./test", { allowTypesOnly: false }]] }] },
          ],
        },
      ]),
    invalid: [
      ...[
        'import Value from "../rules/no-comments.cjs";',
        'import * as Values from "../rules/no-comments.cjs";',
        'import { type Value, other } from "../rules/no-comments.cjs";',
        'import "../rules/no-comments.cjs";',
        'import {} from "../rules/no-comments.cjs";',
        'const value = require("../rules/no-comments.cjs");',
        'const value = import("../rules/no-comments.cjs");',
        'export { Value } from "../rules/no-comments.cjs";',
        'export * from "../rules/no-comments.cjs";',
      ].map((code) => ({
        code,
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          { allow: [{ target: "./rules", importers: [["./test", { allowTypesOnly: true }]] }] },
        ],
        errors: [{ message: /Only type imports/ }],
      })),
      {
        code: 'import "./no-comments.cjs";',
        filename: path.join(process.cwd(), "rules/synthetic.ts"),
        options: [
          { allow: [{ target: "./rules", importers: [["./rules", { allowTypesOnly: true }]] }] },
        ],
        errors: [{ message: /Only type imports/ }],
      },
      {
        code: 'import "./rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "synthetic.ts"),
        options: [{ allow: [{ target: ".", importers: [[".", { allowTypesOnly: true }]] }] }],
        errors: [{ message: /Only type imports/ }],
      },
      {
        code: 'import type { Value } from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [{ allow: [{ target: "./rules", importers: [] }] }],
        errors: [{ message: /Unexpected import/ }],
      },
      {
        code: 'import Value from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              {
                target: "./rules",
                importers: [["./test", { allowTypesOnly: true }]],
                message: "Use types.",
              },
            ],
          },
        ],
        errors: [{ message: "Use types." }],
      },
    ],
  },
);

ruleTester.run(
  "whitelist-imports importer permissions",
  whitelistImportsPlugin.rules["whitelist-imports"],
  {
    valid: [
      ...[
        ["./rules", ["./test", { allowTypesOnly: true }]],
        [["./test", { allowTypesOnly: true }], "./rules"],
      ].flatMap((importers) => [
        {
          code: 'import Value from "../index.cjs";',
          filename: path.join(process.cwd(), "rules/service.ts"),
          options: [{ allow: [{ target: "./index.cjs", importers }] }],
        },
        {
          code: 'import type { Value } from "../index.cjs";',
          filename: path.join(process.cwd(), "test/view.ts"),
          options: [{ allow: [{ target: "./index.cjs", importers }] }],
        },
      ]),
      ...[
        ["*", ["./test", { allowTypesOnly: true }]],
        [["./test", { allowTypesOnly: true }], "*"],
        ["./test", ["./test/**/*.ts", { allowTypesOnly: true }]],
        [["./test/**/*.ts", { allowTypesOnly: true }], "./test"],
        [["./test", {}]],
      ].map((importers) => ({
        code: 'import Value from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [{ allow: [{ target: "./rules", importers }] }],
      })),
      {
        code: 'import type { Value } from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              { target: "./rules", importers: [["./test/**/*.ts", { allowTypesOnly: true }]] },
            ],
          },
        ],
      },
      {
        code: 'import "./no-comments.cjs";',
        filename: path.join(process.cwd(), "rules/synthetic.ts"),
        options: [
          { allow: [{ target: "./rules", importers: [["./test", { allowTypesOnly: true }]] }] },
        ],
      },
    ],
    invalid: [
      ...[
        ["./rules", ["./test", { allowTypesOnly: true }]],
        [["./test", { allowTypesOnly: true }], "./rules"],
      ].map((importers) => ({
        code: 'import Value from "../index.cjs";',
        filename: path.join(process.cwd(), "test/view.ts"),
        options: [{ allow: [{ target: "./index.cjs", importers }] }],
        errors: [{ message: /Only type imports/ }],
      })),
      {
        code: 'import type { Value } from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/other.ts"),
        options: [
          {
            allow: [
              {
                target: "./rules",
                importers: ["./test/services", ["./test/ui", { allowTypesOnly: true }]],
              },
            ],
          },
        ],
        errors: [{ message: /Unexpected import/ }],
      },
      {
        code: 'import Value from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              { target: "./rules", importers: [["./test/**/*.ts", { allowTypesOnly: true }]] },
            ],
          },
        ],
        errors: [{ message: /Only type imports/ }],
      },
      {
        code: 'import Value from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              { target: ".", importers: ["*"] },
              { target: "./rules", importers: [["./test", { allowTypesOnly: true }]] },
            ],
          },
        ],
        errors: [{ message: /Only type imports/ }],
      },
    ],
  },
);

ruleTester.run(
  "whitelist-imports allowSymbols",
  whitelistImportsPlugin.rules["whitelist-imports"],
  {
    valid: [
      ...[
        'import { PortError } from "../rules/no-comments.cjs";',
        'import { PortError as LocalError } from "../rules/no-comments.cjs";',
        'import { "PortError" as LocalError } from "../rules/no-comments.cjs";',
        'import { type Port, PortError } from "../rules/no-comments.cjs";',
        'import type * as Ports from "../rules/no-comments.cjs";',
        'import type { Port } from "../rules/no-comments.cjs";',
        'export { PortError as LocalError } from "../rules/no-comments.cjs";',
        'export { "PortError" as LocalError } from "../rules/no-comments.cjs";',
        'export { type Port, PortError } from "../rules/no-comments.cjs";',
        'export type * from "../rules/no-comments.cjs";',
      ].map((code) => ({
        code,
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              {
                target: "./rules",
                importers: [["./test", { allowTypesOnly: true, allowSymbols: ["PortError"] }]],
              },
            ],
          },
        ],
      })),
      ...[
        'import { PortError } from "../rules/no-comments.cjs";',
        'import type { PortError } from "../rules/no-comments.cjs";',
        'export type { PortError } from "../rules/no-comments.cjs";',
      ].map((code) => ({
        code,
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              { target: "./rules", importers: [["./test", { allowSymbols: ["PortError"] }]] },
            ],
          },
        ],
      })),
      ...[
        'import ErrorClass from "../rules/no-comments.cjs";',
        'import { default as ErrorClass } from "../rules/no-comments.cjs";',
        'export { default as ErrorClass } from "../rules/no-comments.cjs";',
      ].map((code) => ({
        code,
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [{ target: "./rules", importers: [["./test", { allowSymbols: ["default"] }]] }],
          },
        ],
      })),
      ...[
        [
          ["./test", { allowSymbols: ["PortError"] }],
          ["./test", { allowSymbols: ["OtherError"] }],
          ["./test", { allowTypesOnly: true }],
        ],
        [
          ["./test", { allowTypesOnly: true }],
          ["./test", { allowSymbols: ["OtherError"] }],
          ["./test", { allowSymbols: ["PortError"] }],
        ],
      ].map((importers) => ({
        code: 'import { type Port, PortError, OtherError } from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [{ allow: [{ target: "./rules", importers }] }],
      })),
      ...[
        ["*", ["./test", { allowSymbols: ["PortError"] }]],
        [["./test", { allowSymbols: ["PortError"] }], "*"],
      ].map((importers) => ({
        code: 'import * as Ports from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [{ allow: [{ target: "./rules", importers }] }],
      })),
    ],
    invalid: [
      ...[
        'import { createPort } from "../rules/no-comments.cjs";',
        'import { createPort as PortError } from "../rules/no-comments.cjs";',
        'import { PortError, createPort } from "../rules/no-comments.cjs";',
        'import * as Ports from "../rules/no-comments.cjs";',
        'import ErrorClass from "../rules/no-comments.cjs";',
        'import "../rules/no-comments.cjs";',
        'import {} from "../rules/no-comments.cjs";',
        'const { PortError } = require("../rules/no-comments.cjs");',
        'const ports = import("../rules/no-comments.cjs");',
        'export * from "../rules/no-comments.cjs";',
        'export * as Ports from "../rules/no-comments.cjs";',
        'export { createPort as PortError } from "../rules/no-comments.cjs";',
      ].map((code) => ({
        code,
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              {
                target: "./rules",
                importers: [
                  "./rules",
                  ["./test", { allowTypesOnly: true, allowSymbols: ["PortError"] }],
                ],
              },
            ],
          },
        ],
        errors: [{ message: /Only configured symbols/ }],
      })),
      ...[
        'import type { Port } from "../rules/no-comments.cjs";',
        'export type { Port } from "../rules/no-comments.cjs";',
        'import { PortErrorExtra } from "../rules/no-comments.cjs";',
        'export { PortError, OtherError } from "../rules/no-comments.cjs";',
        'import { PortError, type Port } from "../rules/no-comments.cjs";',
      ].map((code) => ({
        code,
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              { target: "./rules", importers: [["./test", { allowSymbols: ["PortError"] }]] },
            ],
          },
        ],
        errors: [{ message: /Only configured symbols/ }],
      })),
      {
        code: 'import { PortError } from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              {
                target: "./rules",
                importers: [["./test/other.ts", { allowSymbols: ["PortError"] }]],
              },
            ],
          },
        ],
        errors: [{ message: /Unexpected import/ }],
      },
      {
        code: 'import { PortError } from "../rules/no-comments.cjs";',
        filename: path.join(process.cwd(), "test/synthetic.ts"),
        options: [
          {
            allow: [
              {
                target: "./rules",
                importers: [["./test", { allowSymbols: [] }]],
                message: "Use port errors only.",
              },
            ],
          },
        ],
        errors: [{ message: "Use port errors only." }],
      },
    ],
  },
);

beforeEach(() => {
  restrictedConstructionPlugin.__test__.resetRepoCounts();
});

ruleTester.run(
  "restricted-construction",
  restrictedConstructionPlugin.rules["restricted-construction"],
  {
    valid: [
      {
        code: 'import { Pool } from "pg"; new Pool();',
        options: [{ constructs: [{ export: "Pool", maxPerRepo: 1, module: "pg" }] }],
      },
      {
        code: "new Pool();",
        options: [{ constructs: [{ export: "Pool", maxPerRepo: 0, module: "pg" }] }],
      },
      {
        code: [
          'import { Other, Pool } from "pg";',
          'import { Pool as MysqlPool } from "mysql";',
          "new Pool();",
          "new MysqlPool();",
          "Pool();",
          'const method = "fromConfig";',
          "Pool[method]();",
          "Pool.allowed();",
          "Other.fromConfig();",
        ].join("\n"),
        options: [
          {
            constructs: [{ export: "Pool", forbiddenStaticMethods: ["fromConfig"], module: "pg" }],
          },
        ],
      },
    ],
    invalid: [
      {
        code: 'import { Pool as DatabasePool } from "pg"; new DatabasePool();',
        errors: [{ message: /may be constructed at most 0 time/ }],
        options: [{ constructs: [{ export: "Pool", maxPerRepo: 0, module: "pg" }] }],
      },
      {
        code: 'import * as database from "pg"; database.Pool.fromConfig();',
        errors: [{ message: /Pool\.fromConfig/ }],
        options: [
          {
            constructs: [{ export: "Pool", forbiddenStaticMethods: ["fromConfig"], module: "pg" }],
          },
        ],
      },
      {
        code: 'import database from "pg"; new database["Pool"]();',
        errors: [{ message: "Construct through the shared adapter." }],
        options: [
          {
            constructs: [
              {
                export: "Pool",
                maxPerRepo: 0,
                message: "Construct through the shared adapter.",
                module: "pg",
              },
            ],
          },
        ],
      },
      {
        code: 'import { Pool } from "pg"; Pool["fromConfig"]();',
        errors: [{ message: /Pool\.fromConfig/ }],
        options: [
          {
            constructs: [{ export: "Pool", forbiddenStaticMethods: ["fromConfig"], module: "pg" }],
          },
        ],
      },
    ],
  },
);

describe("whitelist-imports helpers", () => {
  const helpers = whitelistImportsPlugin.__test__;

  it("prefers the Git repository root over a nested package", () => {
    const projectRoot = helpers.findProjectRoot(
      path.join(process.cwd(), "packages/feature/src/file.ts"),
      (candidate: string) =>
        candidate === path.join(process.cwd(), ".git") ||
        candidate === path.join(process.cwd(), "packages/feature/package.json"),
    );

    expect(projectRoot).toBe(process.cwd());
  });

  it("falls back to the nearest package when there is no Git marker", () => {
    const packageRoot = path.join(process.cwd(), "packages/feature");
    const projectRoot = helpers.findProjectRoot(
      path.join(packageRoot, "src/file.ts"),
      (candidate: string) => candidate === path.join(packageRoot, "package.json"),
    );

    expect(projectRoot).toBe(packageRoot);
  });

  it("falls back to cwd when the file has no project marker", () => {
    expect(helpers.findProjectRoot("/outside/file.ts", () => false)).toBe(process.cwd());
  });

  it("recognizes project-local specifiers and excludes package imports", () => {
    expect(helpers.isProjectLocalImport(".", [])).toBe(true);
    expect(helpers.isProjectLocalImport("..", [])).toBe(true);
    expect(helpers.isProjectLocalImport("../domain/model.js", [])).toBe(true);
    expect(helpers.isProjectLocalImport("@app/domain/model.js", ["@app/"])).toBe(true);
    expect(helpers.isProjectLocalImport("react", ["@app/"])).toBe(false);
  });

  it("matches directory, file, and shallow filename-pattern boundaries", () => {
    const basePath = process.cwd();
    const directory = helpers.normalizeBoundaryEntry(basePath, {
      importers: ["./src/*.test.ts"],
      target: "./src/domain",
    });

    expect(helpers.matchesPathEntry(directory.target, path.join(basePath, "src/domain/a.ts"))).toBe(
      true,
    );
    expect(
      helpers.matchesAllowEntry(
        directory,
        path.join(basePath, "src/domain.test.ts"),
        path.join(basePath, "src/domain/a.ts"),
      ),
    ).toBe(true);
    expect(
      helpers.matchesAllowEntry(
        directory,
        path.join(basePath, "src/nested/domain.test.ts"),
        path.join(basePath, "src/domain/a.ts"),
      ),
    ).toBe(false);
  });

  it.each([
    ["./webapp/src/**/*.test.tsx", "webapp/src/app/view.test.tsx", true],
    ["./webapp/src/**/*.test.ts", "webapp/src/components/shared/location/model.test.ts", true],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/src/model.test.ts", true],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/src/components/view.test.tsx", true],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/src/components/view.tsx", false],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/other/view.test.ts", false],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/src/.hidden.test.ts", false],
    ["./webapp/src/file?.ts", "webapp/src/file1.ts", true],
    ["./webapp/src/file[12].ts", "webapp/src/file2.ts", true],
    ["./webapp/src/file.{ts,tsx}", "webapp/src/file.tsx", true],
  ])("matches importer glob %s against %s: %s", (pattern, filename, expected) => {
    const basePath = process.cwd();
    const boundary = helpers.normalizeBoundaryEntry(basePath, {
      importers: [pattern],
      target: "./webapp/src/test-support",
    });

    expect(
      helpers.matchesAllowEntry(
        boundary,
        path.join(basePath, filename),
        path.join(basePath, "webapp/src/test-support/helper.ts"),
      ),
    ).toBe(expected);
  });

  it("classifies paths and rejects target glob patterns", () => {
    const basePath = process.cwd();
    expect(helpers.inferPathKind(process.cwd())).toBe("directory");
    expect(helpers.inferPathKind(path.join(process.cwd(), "LICENSE"))).toBe("file");
    expect(helpers.inferPathKind(path.join(basePath, "missing.ts"))).toBe("file");
    expect(helpers.inferPathKind(path.join(basePath, "missing"))).toBe("directory");
    expect(() =>
      helpers.normalizeBoundaryEntry(basePath, {
        importers: ["*"],
        target: "./src/**/domain",
      }),
    ).toThrow("Invalid filename pattern");
  });

  it("recognizes containment, external dependencies, and same-directory imports", () => {
    const basePath = process.cwd();
    expect(helpers.isWithinPath(basePath, path.join(basePath, "src/file.ts"))).toBe(true);
    expect(helpers.isWithinPath(basePath, path.join(path.dirname(basePath), "outside.ts"))).toBe(
      false,
    );
    expect(
      helpers.isExternalDependency(basePath, path.join(basePath, "node_modules/pkg/index.js")),
    ).toBe(true);
    expect(
      helpers.isInternalImport(path.join(basePath, "src/a.ts"), path.join(basePath, "src/b.ts")),
    ).toBe(true);
    expect(
      helpers.isSameDirectoryImport(
        path.join(basePath, "src/a.ts"),
        path.join(basePath, "src/b.ts"),
      ),
    ).toBe(true);
  });

  it("selects the most specific configured target", () => {
    const basePath = process.cwd();
    const allow = [
      helpers.normalizeBoundaryEntry(basePath, { importers: ["*"], target: "./src" }),
      helpers.normalizeBoundaryEntry(basePath, { importers: [], target: "./src/domain" }),
    ];
    const match = helpers.findMatchingTarget(allow, path.join(basePath, "src/domain/model.ts"));
    expect(match).toBe(allow[1]);
  });

  it("matches exact files and wildcard importers", () => {
    const basePath = process.cwd();
    const boundary = helpers.normalizeBoundaryEntry(basePath, {
      importers: ["*"],
      target: "./src/domain.ts",
    });
    expect(helpers.matchesPathEntry(boundary.target, path.join(basePath, "src/domain.ts"))).toBe(
      true,
    );
    expect(
      helpers.matchesAllowEntry(
        boundary,
        path.join(basePath, "anywhere.ts"),
        path.join(basePath, "src/domain.ts"),
      ),
    ).toBe(true);
    expect(
      helpers.matchesAllowEntry(
        boundary,
        path.join(basePath, "anywhere.ts"),
        path.join(basePath, "src/other.ts"),
      ),
    ).toBe(false);
  });

  it("reports a disallowed resolved import with a custom boundary message", () => {
    const basePath = process.cwd();
    const reports: Array<{ message: string }> = [];
    let visitModule: ((source: { value: string }) => void) | undefined;
    const context = {
      options: [
        {
          allow: [
            {
              importers: ["./src/application"],
              message: "Use the public API.",
              target: "./src/domain",
            },
          ],
        },
      ],
      report: (report: { message: string }) => reports.push(report),
    };

    helpers.createRuleVisitor(context, {
      getPhysicalFilename: () => path.join(basePath, "src/presentation/view.ts"),
      resolveModule: () => path.join(basePath, "src/domain/model.ts"),
      visitModules: (callback: (source: { value: string }) => void) => {
        visitModule = callback;
        return {};
      },
    });
    visitModule?.({ value: "@app/domain/model.js" });

    expect(reports.map(({ message }) => message)).toEqual(["Use the public API."]);
  });

  it("reports unresolved local imports but ignores unresolved packages", () => {
    const reports: Array<{ message: string }> = [];
    let visitModule: ((source: { value: string }) => void) | undefined;
    const context = {
      options: [{ allow: [], internalImportPrefixes: ["@app/"] }],
      report: (report: { message: string }) => reports.push(report),
    };

    helpers.createRuleVisitor(context, {
      getPhysicalFilename: () => path.join(process.cwd(), "src/file.ts"),
      resolveModule: () => undefined,
      visitModules: (callback: (source: { value: string }) => void) => {
        visitModule = callback;
        return {};
      },
    });
    visitModule?.({ value: "react" });
    visitModule?.({ value: "@app/missing.js" });

    expect(reports.map(({ message }) => message)).toEqual([
      'Unable to resolve project-local import "@app/missing.js" for boundary validation.',
    ]);
  });

  it("ignores imports outside the project and inside node_modules", () => {
    const basePath = process.cwd();
    const reports: Array<{ message: string }> = [];
    let visitModule: ((source: { value: string }) => void) | undefined;
    let resolvedPath = path.join(path.dirname(basePath), "outside.ts");
    const context = {
      options: [{ allow: [] }],
      report: (report: { message: string }) => reports.push(report),
    };
    helpers.createRuleVisitor(context, {
      getPhysicalFilename: () => path.join(basePath, "src/file.ts"),
      resolveModule: () => resolvedPath,
      visitModules: (callback: (source: { value: string }) => void) => {
        visitModule = callback;
        return {};
      },
    });
    visitModule?.({ value: "outside" });
    resolvedPath = path.join(basePath, "node_modules/pkg/index.js");
    visitModule?.({ value: "pkg" });
    expect(reports).toEqual([]);
  });

  it("falls back to context filenames and empty options", () => {
    let visitModule: ((source: { value: string }) => void) | undefined;
    const context = {
      getFilename: () => path.join(process.cwd(), "src/file.ts"),
      options: [],
      report: () => undefined,
    };
    helpers.createRuleVisitor(context, {
      getPhysicalFilename: () => undefined,
      resolveModule: () => undefined,
      visitModules: (callback: (source: { value: string }) => void) => {
        visitModule = callback;
        return {};
      },
    });
    visitModule?.({ value: "react" });
    expect(visitModule).toBeTypeOf("function");
  });

  it.each([
    [
      undefined,
      "src/model.ts",
      `Unexpected import of "./dependency.js" from "${process.cwd()}" into "src/model.ts".`,
    ],
    [
      "src/model.ts",
      ".",
      `Unexpected import of "./dependency.js" from "src/model.ts" into "${process.cwd()}".`,
    ],
  ])(
    "reports root paths without empty diagnostic names: %s to %s",
    (importerFile, importedFile, message) => {
      const reports: Array<{ message: string }> = [];
      let visitModule: ((source: { value: string }) => void) | undefined;
      helpers.createRuleVisitor(
        {
          options: [{ allow: [] }],
          report: (report: { message: string }) => reports.push(report),
        },
        {
          getPhysicalFilename: () =>
            importerFile === undefined ? undefined : path.join(process.cwd(), importerFile),
          resolveModule: () => path.join(process.cwd(), importedFile),
          visitModules: (callback: (source: { value: string }) => void) => {
            visitModule = callback;
            return {};
          },
        },
      );
      visitModule?.({ value: "./dependency.js" });
      expect(reports.map((report) => report.message)).toEqual([message]);
    },
  );

  it.each([
    ["src/application/use-case.ts", "src/domain/model.ts"],
    ["src/domain/model.ts", "src/domain/nested/model.ts"],
  ])("allows configured or same-boundary imports from %s to %s", (importerFile, importedFile) => {
    const basePath = process.cwd();
    const reports: Array<{ message: string }> = [];
    let visitModule: ((source: { value: string }) => void) | undefined;
    const importer = path.join(basePath, importerFile);
    const context = {
      options: [
        {
          allow: [{ importers: ["./src/application"], target: "./src/domain" }],
        },
      ],
      report: (report: { message: string }) => reports.push(report),
    };
    helpers.createRuleVisitor(context, {
      getPhysicalFilename: () => importer,
      resolveModule: () => path.join(basePath, importedFile),
      visitModules: (callback: (source: { value: string }) => void) => {
        visitModule = callback;
        return {};
      },
    });
    visitModule?.({ value: "../domain/model.js" });
    expect(reports).toEqual([]);
  });
});

describe("restricted-libs importer globs", () => {
  it.each([
    ["./webapp/src/**/*.test.ts", "webapp/src/model.test.ts", true],
    ["./webapp/src/**/*.test.tsx", "webapp/src/components/view.test.tsx", true],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/src/components/nested/model.test.ts", true],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/src/components/view.tsx", false],
    ["./webapp/src/**/*.test.{ts,tsx}", "webapp/other/view.test.ts", false],
    ["./webapp/src/*.test.ts", "webapp/src/nested/model.test.ts", false],
    ["./webapp/src/**/*.test.ts", "webapp/src/.hidden/model.test.ts", false],
    ["./webapp/src/file?.ts", "webapp/src/file1.ts", true],
    ["./webapp/src/file[12].ts", "webapp/src/file2.ts", true],
    ["./webapp/src/file.{ts,tsx}", "webapp/src/file.tsx", true],
    ["./webapp/src/model.ts", "webapp/src/model.ts", true],
    ["./webapp/src", "webapp/src/nested/model.ts", true],
    ["*", "outside/model.ts", true],
  ])("matches %s against %s: %s", (pattern, filename, expected) => {
    const basePath = process.cwd();
    expect(
      restrictedLibsPlugin.__test__.isAllowedImporter(path.join(basePath, filename), basePath, [
        pattern,
      ]),
    ).toBe(expected);
  });
});

describe("rule helper edge cases", () => {
  it("does not expose basePath as a configurable rule option", () => {
    expect(
      restrictedLibsPlugin.rules["restricted-libs"].meta.schema[0].properties,
    ).not.toHaveProperty("basePath");
    expect(
      whitelistImportsPlugin.rules["whitelist-imports"].meta.schema[0].properties,
    ).not.toHaveProperty("basePath");
  });

  it("reports comments even when source ranges or text access are unavailable", () => {
    const reports: Array<{ fix: (fixer: { remove: (node: unknown) => string }) => string }> = [];
    const comment = { value: " forbidden" };
    const visitor = noCommentsPlugin.rules["no-comments"].create({
      options: [],
      report: (report: (typeof reports)[number]) => reports.push(report),
      sourceCode: { getAllComments: () => [comment] },
    });
    visitor.Program();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.fix({ remove: () => "removed" })).toBe("removed");
  });

  it("normalizes safe construction limits and recognizes static member forms", () => {
    const helpers = restrictedConstructionPlugin.__test__;
    expect(
      helpers.normalizeConstructs({
        constructs: [{ export: "Pool", maxPerRepo: -1, module: "pg" }],
      })[0].maxPerRepo,
    ).toBeUndefined();
    expect(helpers.normalizeConstructs(undefined)).toEqual([]);
    expect(
      helpers.staticMemberName({
        computed: true,
        property: { type: "Identifier", name: "dynamic" },
        type: "MemberExpression",
      }),
    ).toBeUndefined();
    expect(helpers.staticMemberName({ type: "Identifier" })).toBeUndefined();
  });

  it("handles restricted-library path boundaries and wildcard importers", () => {
    const helpers = restrictedLibsPlugin.__test__;
    const root = path.join(process.cwd(), "src");
    expect(helpers.matchesLibrary("pkg/subpath", "pkg")).toBe(true);
    expect(helpers.matchesLibrary("pkg-other", "pkg")).toBe(false);
    expect(helpers.isWithinPath(root, path.join(process.cwd(), "src-other/file.ts"))).toBe(false);
    expect(helpers.isAllowedImporter(path.join(process.cwd(), "any.ts"), root, ["*"])).toBe(true);
    expect(helpers.normalizeConfig({ libraries: "invalid" })).toEqual({
      basePath: process.cwd(),
      libraries: [],
    });
    const visitor = restrictedLibsPlugin.rules["restricted-libs"].create({
      options: [],
      report: () => undefined,
    });
    expect(visitor).toBeTypeOf("object");
  });
});
