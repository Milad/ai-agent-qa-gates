# AI Agent QA Gates

Five JavaScript plugins for [Oxlint](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
that enforce repository-wide quality boundaries.

## Rules and why they help

- **`no-comments`** prevents explanations from drifting away from the code while retaining explicit
  escape hatches for tool directives and other agreed formats.
- **`no-re-exports`** prevents name smuggling across architecture layers and keeps dependency
  origins visible.
- **`restricted-construction`** centralizes ownership of costly or stateful clients by limiting
  constructors and unsafe static factories across the repository.
- **`restricted-libs`** keeps frameworks, drivers, and other low-level dependencies behind their
  intended adapters.
- **`whitelist-imports`** makes architectural boundaries executable, so forbidden dependencies fail
  during linting instead of emerging during review or refactoring.

## Installation

```sh
npm install --save-dev ai-agent-qa-gates oxlint
```

Node.js 24 or newer and Oxlint 1.76.0 or newer are required. The package includes TypeScript
declarations for the aggregate plugin and every individual entry point.

## Configuration

Register the package once with an explicit plugin name, then enable only the rules your project
needs:

```json
{
  "jsPlugins": [
    {
      "name": "qa",
      "specifier": "ai-agent-qa-gates"
    }
  ],
  "rules": {
    "qa/no-comments": [
      "error",
      {
        "allow": ["^\\s*oxlint-disable", "^\\s*c8 ignore"]
      }
    ],
    "qa/no-re-exports": "error",
    "qa/restricted-construction": [
      "error",
      {
        "constructs": [
          {
            "module": "pg",
            "export": "Pool",
            "maxPerRepo": 1
          },
          {
            "module": "database-client",
            "export": "Client",
            "forbiddenStaticMethods": ["fromConnectionString"]
          }
        ]
      }
    ],
    "qa/restricted-libs": [
      "error",
      {
        "libraries": [
          {
            "name": "react",
            "allowImporters": ["./src/ui"],
            "message": "React belongs behind the UI boundary only."
          }
        ]
      }
    ],
    "qa/whitelist-imports": [
      "error",
      {
        "internalImportPrefixes": ["@app/"],
        "allow": [
          {
            "target": "./src/domain",
            "importers": ["./src/application", "./src/index.ts"],
            "message": "Domain modules are consumed through the application layer."
          }
        ]
      }
    ]
  }
}
```

`restricted-libs` and `whitelist-imports` resolve configured paths from the same project root.
Both walk upward from each linted file to find the nearest Git root, including worktrees and
submodules whose `.git` marker is a file. When no Git root exists, they use the nearest
`package.json`, then the current working directory as a final fallback.

This makes root-level import policies consistent when linting from a workspace subdirectory,
including tools that reuse the repository configuration while changing their working directory.
When upgrading, policies previously written relative to a workspace directory must be updated to
use paths relative to the Git root. Projects without Git still use the nearest package root.

TypeScript projects use the same Oxlint configuration. The bundled declarations provide types when
the aggregate plugin or an individual entry point is imported programmatically; configuration by
package specifier does not require a TypeScript import.

Rule option types are available from the type-only `ai-agent-qa-gates/types` entry point:

```ts
import type { RestrictedLibsOptions } from "ai-agent-qa-gates/types";

const restrictedLibraries = {
  libraries: [{ name: "pg", allowImporters: ["./src/database"] }],
} satisfies RestrictedLibsOptions;
```

The entry point exports `NoCommentsOptions`, `RestrictedConstructionOptions`,
`RestrictedLibsOptions`, and `WhitelistImportsOptions`, plus their nested entry types.
`NoReExportsOptions` is `never` because `no-re-exports` accepts no options.

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

Each `constructs` entry identifies an `export` from a `module`.

- `maxPerRepo` is an optional non-negative integer limiting matching `new` expressions across one
  Oxlint process.
- `forbiddenStaticMethods` lists static calls that may not be used.
- `message` replaces the default diagnostic for that entry.

Named aliases, namespace imports, default namespace-style imports, and statically computed string
properties are recognized. Construction counts are shared across every file linted in the same
Oxlint invocation.

### `qa/restricted-libs`

Each `libraries` entry has:

- `name`: a package name; its subpaths are included;
- `allowImporters`: paths relative to the project root, including files, recursive
  directories, Node.js glob patterns, or `"*"` (any importer);
- `message`: an optional custom diagnostic.

The rule checks static imports, re-exports, dynamic imports with literal specifiers, and CommonJS
`require` calls. Relative imports and packages not listed in `libraries` are ignored.

Importer globs support patterns such as `./src/**/*.test.{ts,tsx}`, using the same matching
semantics as `whitelist-imports` below, including exclusion of dotfiles and hidden directories
unless explicitly matched.

### `qa/whitelist-imports`

Each `allow` entry defines a protected `target` file or directory and the files or directories that
may import it. Importer entries may also be `"*"` (any importer) or Node.js glob patterns such as
`./src/*.test.ts`, `./src/**/*.test.ts`, or `./src/**/*.test.{ts,tsx}`. A single `*` matches within
one directory; `**` matches across directories, and braces select alternatives. Glob matching
uses `path.matchesGlob`; wildcard segments exclude dotfiles and hidden directories unless
explicitly matched. Targets remain literal files or directories. When targets overlap, the
most specific target wins.

Set `allowTypesOnly: true` on an `allow` entry to require explicit type-only imports or re-exports
from its target, including same-directory and same-boundary imports. Both `import type { Model }`
and `import { type Model }` are allowed; mixed type/value imports, side-effect imports, `require()`,
and dynamic imports are rejected. The configured `importers` restriction still applies. Omitting
`allowTypesOnly` or setting it to `false` preserves the default behavior. For example:

```json
{ "target": "./src/domain", "importers": ["./src/ui"], "allowTypesOnly": true }
```

Same-directory imports and imports within the same configured boundary are allowed unless
`allowTypesOnly` restricts them. Dependencies
outside the discovered project root and dependencies under `node_modules` are ignored. Unresolved relative,
absolute, or `internalImportPrefixes` imports are reported because their boundary cannot be
verified; unresolved external packages are ignored.

The rule uses the resolver configured through Oxlint's `settings.import/resolver`. Node resolution
works out of the box. For TypeScript aliases, install and configure a compatible resolver, for
example:

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

The aggregate package is recommended. Individual plugins are also exported for compatibility:

```text
ai-agent-qa-gates/no-comments
ai-agent-qa-gates/no-re-exports
ai-agent-qa-gates/restricted-construction
ai-agent-qa-gates/restricted-libs
ai-agent-qa-gates/whitelist-imports
```

Each individual entry point exposes its rule under the original rule name.

## Development

```sh
npm test
npm run test:watch
npm run coverage:report
npm run lint:fix
npm run fmt
npm run validate
npm run release:check
```

`validate` runs strict TypeScript checking, Oxlint, Knip, coverage with enforced thresholds,
duplicate detection, and Oxfmt.

`npm version patch`, `npm version minor`, or `npm version major` validates before creating the version commit and tag, then pushes both. `npm publish` validates again before publishing. Use `npm run release:check` to inspect the publish result without releasing it.

## License

[ISC](LICENSE)
