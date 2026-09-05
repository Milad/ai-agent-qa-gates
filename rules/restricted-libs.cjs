"use strict";

const path = require("node:path");

const visitModules = require("eslint-module-utils/moduleVisitor").default;

function isWithinPath(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function matchesLibrary(source, library) {
  return source === library || source.startsWith(`${library}/`);
}

function normalizeConfig(options) {
  return {
    basePath: process.cwd(),
    libraries: Array.isArray(options.libraries) ? options.libraries : [],
  };
}

function isAllowedImporter(importerPath, basePath, allowImporters) {
  return allowImporters.some((entry) => {
    if (entry === "*") {
      return true;
    }
    return isWithinPath(path.resolve(basePath, entry), importerPath);
  });
}

module.exports = {
  rules: {
    "restricted-libs": {
      meta: {
        type: "problem",
        schema: [
          {
            type: "object",
            properties: {
              libraries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", minLength: 1 },
                    allowImporters: { type: "array", items: { type: "string" } },
                    message: { type: "string" },
                  },
                  required: ["name", "allowImporters"],
                  additionalProperties: false,
                },
              },
            },
            required: ["libraries"],
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const options = normalizeConfig(context.options[0] ?? {});
        const importerPath = path.resolve(context.getFilename?.() ?? "");

        return visitModules(
          (source) => {
            const policy = options.libraries.find((entry) =>
              matchesLibrary(source.value, entry.name),
            );

            if (
              !policy ||
              isAllowedImporter(importerPath, options.basePath, policy.allowImporters)
            ) {
              return;
            }

            context.report({
              node: source,
              message:
                policy.message ??
                `Importing "${source.value}" is restricted to configured importer paths for "${policy.name}".`,
            });
          },
          { commonjs: true, esmodule: true },
        );
      },
    },
  },
  __test__: { isAllowedImporter, isWithinPath, matchesLibrary, normalizeConfig },
};
