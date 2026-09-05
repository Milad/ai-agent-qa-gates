import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["index.cjs", "rules/*.cjs"],
  ignoreDependencies: ["eslint-import-resolver-node"],
};

export default config;
