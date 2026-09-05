"use strict";

function normalizeConstructs(options) {
  const constructs = Array.isArray(options?.constructs) ? options.constructs : [];
  return constructs.map((entry) => ({
    module: entry.module,
    export: entry.export,
    maxPerRepo:
      Number.isInteger(entry.maxPerRepo) && entry.maxPerRepo >= 0 ? entry.maxPerRepo : undefined,
    forbiddenStaticMethods: Array.isArray(entry.forbiddenStaticMethods)
      ? entry.forbiddenStaticMethods
      : [],
    message: entry.message,
  }));
}

function constructKey(construct) {
  return `${construct.module} ${construct.export}`;
}

function defaultConstructionMessage(construct) {
  return `"new ${construct.export}()" imported from "${construct.module}" may be constructed at most ${construct.maxPerRepo} time(s) across the whole codebase.`;
}

function defaultStaticCallMessage(construct, methodName) {
  return `"${construct.export}.${methodName}(...)" imported from "${construct.module}" is forbidden.`;
}

function staticMemberName(expression) {
  if (expression.type !== "MemberExpression") {
    return undefined;
  }
  if (!expression.computed) {
    return expression.property.name;
  }
  if (expression.property.type === "Literal" && typeof expression.property.value === "string") {
    return expression.property.value;
  }
  return undefined;
}

function matchesNamedBinding(expression, bindings) {
  return expression.type === "Identifier" && bindings.has(expression.name);
}

function matchesNamespacedBinding(expression, bindings, exportName) {
  return (
    expression.type === "MemberExpression" &&
    expression.object.type === "Identifier" &&
    bindings.has(expression.object.name) &&
    staticMemberName(expression) === exportName
  );
}

function matchesConstruct(expression, namedBindings, namespaceBindings, exportName) {
  return (
    matchesNamedBinding(expression, namedBindings) ||
    matchesNamespacedBinding(expression, namespaceBindings, exportName)
  );
}

const repoConstructionCounts = new Map();

function resetRepoCounts() {
  repoConstructionCounts.clear();
}

module.exports = {
  rules: {
    "restricted-construction": {
      meta: {
        type: "problem",
        schema: [
          {
            type: "object",
            properties: {
              constructs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    module: { type: "string", minLength: 1 },
                    export: { type: "string", minLength: 1 },
                    maxPerRepo: { type: "integer", minimum: 0 },
                    forbiddenStaticMethods: { type: "array", items: { type: "string" } },
                    message: { type: "string" },
                  },
                  required: ["module", "export"],
                  additionalProperties: false,
                },
              },
            },
            required: ["constructs"],
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const constructs = normalizeConstructs(context.options[0]);
        const namedBindings = constructs.map(() => new Set());
        const namespaceBindings = constructs.map(() => new Set());
        return {
          ImportDeclaration(node) {
            const moduleName = node.source.value;
            constructs.forEach((construct, index) => {
              if (construct.module !== moduleName) {
                return;
              }
              for (const specifier of node.specifiers) {
                if (
                  specifier.type === "ImportDefaultSpecifier" ||
                  specifier.type === "ImportNamespaceSpecifier"
                ) {
                  namespaceBindings[index].add(specifier.local.name);
                } else if (
                  specifier.type === "ImportSpecifier" &&
                  specifier.imported?.name === construct.export
                ) {
                  namedBindings[index].add(specifier.local.name);
                }
              }
            });
          },
          NewExpression(node) {
            constructs.forEach((construct, index) => {
              if (construct.maxPerRepo === undefined) {
                return;
              }
              if (
                !matchesConstruct(
                  node.callee,
                  namedBindings[index],
                  namespaceBindings[index],
                  construct.export,
                )
              ) {
                return;
              }
              const key = constructKey(construct);
              const count = (repoConstructionCounts.get(key) ?? 0) + 1;
              repoConstructionCounts.set(key, count);
              if (count > construct.maxPerRepo) {
                context.report({
                  node,
                  message: construct.message ?? defaultConstructionMessage(construct),
                });
              }
            });
          },
          CallExpression(node) {
            if (node.callee.type !== "MemberExpression") {
              return;
            }
            const methodName = staticMemberName(node.callee);
            if (methodName === undefined) {
              return;
            }
            const target = node.callee.object;
            constructs.forEach((construct, index) => {
              if (!construct.forbiddenStaticMethods.includes(methodName)) {
                return;
              }
              if (
                matchesConstruct(
                  target,
                  namedBindings[index],
                  namespaceBindings[index],
                  construct.export,
                )
              ) {
                context.report({
                  node,
                  message: construct.message ?? defaultStaticCallMessage(construct, methodName),
                });
              }
            });
          },
        };
      },
    },
  },
  __test__: {
    matchesConstruct,
    matchesNamedBinding,
    matchesNamespacedBinding,
    normalizeConstructs,
    resetRepoCounts,
    staticMemberName,
  },
};
