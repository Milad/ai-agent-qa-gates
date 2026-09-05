"use strict";

const message = "Re-exporting a binding from another module is forbidden.";

function importedBindings(body) {
  return new Set(
    body
      .filter((node) => node.type === "ImportDeclaration")
      .flatMap((node) => node.specifiers)
      .map((specifier) => specifier.local.name),
  );
}

module.exports = {
  rules: {
    "no-re-exports": {
      meta: {
        type: "problem",
        schema: [],
      },
      create(context) {
        return {
          Program(node) {
            const imports = importedBindings(node.body);

            for (const declaration of node.body) {
              if (declaration.type === "ExportAllDeclaration") {
                context.report({ node: declaration, message });
                continue;
              }

              if (declaration.type === "ExportNamedDeclaration") {
                if (declaration.source && declaration.specifiers.length > 0) {
                  context.report({ node: declaration, message });
                  continue;
                }

                for (const specifier of declaration.specifiers) {
                  if (imports.has(specifier.local.name)) {
                    context.report({ node: specifier, message });
                  }
                }
                continue;
              }

              if (
                declaration.type === "ExportDefaultDeclaration" &&
                declaration.declaration.type === "Identifier" &&
                imports.has(declaration.declaration.name)
              ) {
                context.report({ node: declaration, message });
              }
            }
          },
        };
      },
    },
  },
};
