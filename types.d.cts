interface OxlintRule {
  readonly meta: Readonly<Record<string, unknown>>;
  create(context: unknown): unknown;
}

export interface OxlintPlugin<Name extends string> {
  readonly rules: Readonly<Record<Name, OxlintRule>>;
}

export interface NoCommentsOptions {
  readonly allow?: readonly string[];
}

export type NoReExportsOptions = never;

export interface RestrictedConstruct {
  readonly module: string;
  readonly export: string;
  readonly maxPerRepo?: number;
  readonly forbiddenStaticMethods?: readonly string[];
  readonly message?: string;
}

export interface RestrictedConstructionOptions {
  readonly constructs: readonly RestrictedConstruct[];
}

export interface RestrictedLibrary {
  readonly name: string;
  readonly allowImporters: readonly string[];
  readonly message?: string;
}

export interface RestrictedLibsOptions {
  readonly libraries: readonly RestrictedLibrary[];
}

export type WhitelistImporter = string | readonly [string, { readonly allowTypesOnly?: boolean }];

export interface WhitelistImportBoundary {
  readonly target: string;
  readonly importers: readonly WhitelistImporter[];
  readonly message?: string;
}

export interface WhitelistImportsOptions {
  readonly internalImportPrefixes?: readonly string[];
  readonly allow: readonly WhitelistImportBoundary[];
}
