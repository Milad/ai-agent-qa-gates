import type plugin from "ai-agent-qa-gates";
import type noCommentsPlugin from "ai-agent-qa-gates/no-comments";
import type {
  NoCommentsOptions,
  NoReExportsOptions,
  RestrictedConstructionOptions,
  RestrictedLibsOptions,
  WhitelistImportsOptions,
} from "ai-agent-qa-gates/types";

const noCommentsOptions = { allow: ["^ tool directive"] } satisfies NoCommentsOptions;
const restrictedConstructionOptions = {
  constructs: [
    {
      export: "Pool",
      forbiddenStaticMethods: ["fromConnectionString"],
      maxPerRepo: 1,
      message: "Use the shared pool.",
      module: "pg",
    },
  ],
} satisfies RestrictedConstructionOptions;
const restrictedLibsOptions = {
  libraries: [
    { allowImporters: ["./src/database"], message: "Use the database adapter.", name: "pg" },
  ],
} satisfies RestrictedLibsOptions;
const whitelistImportsOptions = {
  allow: [
    {
      allowTypesOnly: true,
      importers: ["./src/application"],
      message: "Use the application boundary.",
      target: "./src/domain",
    },
  ],
  internalImportPrefixes: ["@app/"],
} satisfies WhitelistImportsOptions;
type NoReExportsHasNoOptions = NoReExportsOptions;
type IsNever<Value> = [Value] extends [never] ? true : false;
const noReExportsHasNoOptions: IsNever<NoReExportsHasNoOptions> = true;
type AggregatePlugin = typeof plugin;
type NoCommentsPlugin = typeof noCommentsPlugin;
const declarationsResolve: [AggregatePlugin, NoCommentsPlugin] | undefined = undefined;

describe("TypeScript package declarations", () => {
  it("type the aggregate and individual plugin entry points", () => {
    expect(declarationsResolve).toBeUndefined();
    expect(noCommentsOptions.allow).toHaveLength(1);
    expect(restrictedConstructionOptions.constructs).toHaveLength(1);
    expect(restrictedLibsOptions.libraries).toHaveLength(1);
    expect(whitelistImportsOptions.allow).toHaveLength(1);
    expect(noReExportsHasNoOptions).toBe(true);
  });
});
