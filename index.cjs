"use strict";

module.exports = {
  rules: {
    ...require("./rules/no-comments.cjs").rules,
    ...require("./rules/no-re-exports.cjs").rules,
    ...require("./rules/restricted-construction.cjs").rules,
    ...require("./rules/restricted-libs.cjs").rules,
    ...require("./rules/whitelist-imports.cjs").rules,
  },
};
