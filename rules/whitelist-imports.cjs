"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getPhysicalFilename } = require("eslint-module-utils/contextCompat");
const moduleVisitor = require("eslint-module-utils/moduleVisitor");
const resolveImport = require("eslint-module-utils/resolve");

const visitModules = moduleVisitor.default;
const resolveModule = resolveImport.default;

function findProjectRoot(importerPath, existsSync = fs.existsSync) {
  let currentDirectory = path.dirname(path.resolve(importerPath));
  let nearestPackageRoot;

  while (true) {
    if (
      nearestPackageRoot === undefined &&
      existsSync(path.join(currentDirectory, "package.json"))
    ) {
      nearestPackageRoot = currentDirectory;
    }

    if (existsSync(path.join(currentDirectory, ".git"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return nearestPackageRoot ?? process.cwd();
    }
    currentDirectory = parentDirectory;
  }
}

function isWithinPath(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function isExternalDependency(basePath, candidatePath) {
  return path.relative(basePath, candidatePath).split(path.sep).includes("node_modules");
}

function resolvePath(basePath, targetPath) {
  return path.resolve(basePath, targetPath);
}

function inferPathKind(resolvedPath) {
  try {
    return fs.statSync(resolvedPath).isDirectory() ? "directory" : "file";
  } catch {
    return path.extname(resolvedPath) === "" ? "directory" : "file";
  }
}

function normalizePathEntry(basePath, configuredPath, allowGlob) {
  const resolvedPath = resolvePath(basePath, configuredPath);
  const isGlob = allowGlob ? /[*?[\]{}]/.test(configuredPath) : configuredPath.includes("*");

  if (!isGlob) {
    return { kind: inferPathKind(resolvedPath), path: resolvedPath };
  }

  if (!allowGlob) {
    throw new Error(`Invalid filename pattern: ${configuredPath}`);
  }

  return { kind: "glob", path: resolvedPath };
}

function normalizeBoundaryEntry(basePath, entry) {
  return {
    message: entry.message,
    target: normalizePathEntry(basePath, entry.target, false),
    importers: entry.importers.map((importer) =>
      importer === "*"
        ? { any: true }
        : { any: false, ...normalizePathEntry(basePath, importer, true) },
    ),
  };
}

function matchesPathEntry(entry, candidatePath) {
  if (entry.kind === "directory") {
    return isWithinPath(entry.path, candidatePath);
  }
  if (entry.kind === "glob") {
    return path.matchesGlob(candidatePath, entry.path);
  }
  return path.resolve(entry.path) === path.resolve(candidatePath);
}

function matchesAllowEntry(allowEntry, importerPath, importedPath) {
  if (!matchesPathEntry(allowEntry.target, importedPath)) {
    return false;
  }
  return allowEntry.importers.some((importer) => {
    if (importer.any) {
      return true;
    }
    return matchesPathEntry(importer, importerPath);
  });
}

function isInternalImport(importerPath, importedPath) {
  return isWithinPath(path.dirname(importerPath), importedPath);
}

function isSameDirectoryImport(importerPath, importedPath) {
  return path.dirname(importerPath) === path.dirname(importedPath);
}

function isProjectLocalImport(sourceValue, internalImportPrefixes) {
  return (
    sourceValue === "." ||
    sourceValue === ".." ||
    sourceValue.startsWith("./") ||
    sourceValue.startsWith("../") ||
    path.isAbsolute(sourceValue) ||
    internalImportPrefixes.some((prefix) => sourceValue.startsWith(prefix))
  );
}

function findMatchingTarget(allow, importedPath) {
  return allow
    .filter((allowEntry) => matchesPathEntry(allowEntry.target, importedPath))
    .sort((left, right) => right.target.path.length - left.target.path.length)[0];
}

function createRuleVisitor(context, dependencies = {}) {
  const resolveModuleFn = dependencies.resolveModule ?? resolveModule;
  const visitModulesFn = dependencies.visitModules ?? visitModules;
  const getPhysicalFilenameFn = dependencies.getPhysicalFilename ?? getPhysicalFilename;
  const options = context.options[0] ?? {};
  const importerPath = path.resolve(
    getPhysicalFilenameFn(context) ?? context.getFilename?.() ?? "",
  );
  const basePath = findProjectRoot(importerPath);
  const internalImportPrefixes = options.internalImportPrefixes ?? [];
  const allow = Array.isArray(options.allow)
    ? options.allow.map((entry) => normalizeBoundaryEntry(basePath, entry))
    : [];

  return visitModulesFn(
    (source) => {
      const resolvedImportPath = resolveModuleFn(source.value, context);
      if (typeof resolvedImportPath !== "string") {
        if (isProjectLocalImport(source.value, internalImportPrefixes)) {
          context.report({
            node: source,
            message: `Unable to resolve project-local import "${source.value}" for boundary validation.`,
          });
        }
        return;
      }

      const importedPath = path.resolve(resolvedImportPath);
      if (!isWithinPath(basePath, importedPath) || isExternalDependency(basePath, importedPath)) {
        return;
      }

      const importerBoundary = findMatchingTarget(allow, importerPath);
      const matchingTarget = findMatchingTarget(allow, importedPath);
      if (
        isSameDirectoryImport(importerPath, importedPath) ||
        (importerBoundary &&
          importerBoundary === matchingTarget &&
          isInternalImport(importerPath, importedPath))
      ) {
        return;
      }
      if (matchingTarget && matchesAllowEntry(matchingTarget, importerPath, importedPath)) {
        return;
      }

      const importerMessage = path.relative(basePath, importerPath) || importerPath;
      const importedMessage = path.relative(basePath, importedPath) || importedPath;
      context.report({
        node: source,
        message:
          matchingTarget?.message ??
          `Unexpected import of "${source.value}" from "${importerMessage}" into "${importedMessage}".`,
      });
    },
    { commonjs: true },
  );
}

module.exports = {
  rules: {
    "whitelist-imports": {
      meta: {
        type: "problem",
        schema: [
          {
            type: "object",
            properties: {
              internalImportPrefixes: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
              allow: {
                type: "array",
                minItems: 0,
                items: {
                  type: "object",
                  properties: {
                    target: { type: "string" },
                    importers: { type: "array", minItems: 0, items: { type: "string" } },
                    message: { type: "string" },
                  },
                  required: ["target", "importers"],
                  additionalProperties: false,
                },
              },
            },
            required: ["allow"],
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        return createRuleVisitor(context);
      },
    },
  },
};

module.exports.__test__ = {
  createRuleVisitor,
  findProjectRoot,
  findMatchingTarget,
  inferPathKind,
  isExternalDependency,
  isInternalImport,
  isProjectLocalImport,
  isSameDirectoryImport,
  isWithinPath,
  matchesAllowEntry,
  matchesPathEntry,
  normalizeBoundaryEntry,
  resolvePath,
};
