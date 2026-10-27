# AI Agent QA Gates

Five JavaScript plugins for [Oxlint](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
that enforce repository-wide quality boundaries.

## Installation

```sh
npm install --save-dev ai-agent-qa-gates oxlint
```

Requires Node.js 24+ and Oxlint >=1.76.0 <2. TypeScript declarations are included.

## Configuration

Register the plugin and enable the rules you need:

```json
{
  "jsPlugins": [{ "name": "qa", "specifier": "ai-agent-qa-gates" }],
  "rules": {
    "qa/no-comments": ["error", { "allow": ["^\\s*oxlint-disable"] }],
    "qa/no-re-exports": "error",
    "qa/restricted-construction": [
      "error",
      { "constructs": [{ "module": "pg", "export": "Pool", "maxPerRepo": 1 }] }
    ],
    "qa/restricted-libs": [
      "error",
      { "libraries": [{ "name": "react", "allowImporters": ["./src/ui"] }] }
    ],
    "qa/whitelist-imports": [
      "error",
      { "allow": [{ "target": "./src/domain", "importers": ["./src/application"] }] }
    ]
  }
}
```

Paths in `restricted-libs` and `whitelist-imports` are relative to the nearest Git root
(including worktrees and submodules), falling back to the nearest `package.json`, then the working
directory. Migrate workspace-relative policies to Git-root-relative paths.

Import rule option types from `ai-agent-qa-gates/types`:

```ts
import type { RestrictedLibsOptions } from "ai-agent-qa-gates/types";

const restrictedLibraries = {
  libraries: [{ name: "pg", allowImporters: ["./src/database"] }],
} satisfies RestrictedLibsOptions;
```

## Rules

### `qa/no-comments`

Reports line and block comments and can remove them with `oxlint --fix`. `allow` accepts regular
expression strings matched against the comment text without its delimiter.

```json
{
  "allow": ["^\\s*TODO\\(PROJ-[0-9]+\\):"]
}
```

### `qa/no-re-exports`

Reports star, namespace, named, and type re-exports. It also reports a locally imported binding
that is subsequently exported by name or as the default export. Local declarations and empty
`export {} from "..."` declarations are allowed.

### `qa/restricted-construction`

Each `constructs` entry identifies an `export` from a `module`:

- `maxPerRepo` is an optional non-negative integer limiting matching `new` expressions across one
  Oxlint process.
- `forbiddenStaticMethods` lists static calls that may not be used.
- `message` replaces the default diagnostic for that entry.

Recognizes named aliases, namespace imports, default namespace-style imports, and statically
computed string properties. Counts are shared across files in one Oxlint invocation.

### `qa/restricted-libs`

Each `libraries` entry has:

- `name`: a package name; its subpaths are included;
- `allowImporters`: paths relative to the project root, including files, recursive
  directories, Node.js glob patterns, or `"*"` (any importer);
- `message`: an optional custom diagnostic.

The rule checks static imports, re-exports, dynamic imports with literal specifiers, and CommonJS
`require` calls. Relative imports and packages not listed in `libraries` are ignored.

Importer globs use the same matching rules as `whitelist-imports` below.

### `qa/whitelist-imports`

Each `allow` entry has a literal `target` file or directory, an `importers` list, and an optional
`message`. The most specific target wins.

Importers accept files, recursive directories, `"*"` (any importer), and Node.js globs:
`*` matches within a directory, `**` crosses directories, and `{ts,tsx}` selects alternatives.
Wildcard segments exclude hidden files and directories unless explicitly matched.

Use `[path, { "allowTypesOnly": true }]` to restrict an importer to explicit type-only imports
or re-exports. Plain strings and tuples without restrictions allow runtime values too:

```json
{
  "target": "./src/domain",
  "importers": [
    "./src/services",
    ["./src/ui", { "allowTypesOnly": true, "allowSymbols": ["PortError"] }]
  ]
}
```

This allows services unrestricted access; UI can import any types and the runtime `PortError`
class. Type-only syntax includes `import type { Model }` and `import { type Model }`.

`allowSymbols` whitelists exact exported names; aliases use the original name, and `"default"`
permits default imports. Without `allowTypesOnly`, only listed symbols are allowed, including
types. With it, all types are also allowed. Mixed imports must satisfy these permissions for
every symbol. Namespace imports, side effects, `require()`, and dynamic imports need an
unrestricted grant; type-only namespace imports remain allowed with `allowTypesOnly`.

Permissions are additive and order-independent: any matching unrestricted importer permits
runtime access. A plain `"*"` grants everyone runtime access. Other rules, including
`no-re-exports`, still apply.

**Migration:** move target-level `allowTypesOnly` into importer tuples; the target-level option
is no longer accepted.

Explicit matching importer restrictions also apply within the same directory or boundary;
otherwise those imports are allowed. Dependencies outside the project root or under
`node_modules` are ignored. Unresolved local imports are reported; unresolved external packages
are ignored. Set `internalImportPrefixes` (for example, `["@app/"]`) to treat aliases as local.

Node resolution works by default. For TypeScript aliases, configure `settings.import/resolver`:

```sh
npm install --save-dev eslint-import-resolver-typescript
```

```json
{
  "settings": {
    "import/resolver": {
      "typescript": {
        "project": "./tsconfig.json"
      }
    }
  }
}
```

## Individual entry points

Individual plugins are available at:

```text
ai-agent-qa-gates/no-comments
ai-agent-qa-gates/no-re-exports
ai-agent-qa-gates/restricted-construction
ai-agent-qa-gates/restricted-libs
ai-agent-qa-gates/whitelist-imports
```

Each exposes its rule under the original name.

## Development

```sh
npm test                 # Run tests
npm run test:watch       # Watch tests
npm run coverage:report  # HTML coverage report
npm run lint:fix         # Fix lint issues
npm run fmt              # Format files
npm run validate         # Types, lint, dead code, coverage, duplicates, formatting
npm run release:check    # Dry-run publish
```

With lifecycle scripts enabled, `npm version patch|minor|major` validates, commits, tags, and pushes.
`npm publish` validates before publishing.

## License

[ISC](LICENSE)
