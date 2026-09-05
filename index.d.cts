import type { OxlintPlugin } from "./types.cjs";

type RuleName =
  | "no-comments"
  | "no-re-exports"
  | "restricted-construction"
  | "restricted-libs"
  | "whitelist-imports";

declare const plugin: OxlintPlugin<RuleName>;

export = plugin;
