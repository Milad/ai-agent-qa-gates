"use strict";

const fs = require("node:fs");
const path = require("node:path");

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

module.exports = { findProjectRoot };
