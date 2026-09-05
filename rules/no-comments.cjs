"use strict";

function standaloneLineRange(source, comment) {
  if (!comment.range) {
    return undefined;
  }

  const [start, end] = comment.range;
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const nextLineBreak = source.indexOf("\n", end);
  const lineContentEnd = nextLineBreak === -1 ? source.length : nextLineBreak;

  if (
    source.slice(lineStart, start).trim() === "" &&
    source.slice(end, lineContentEnd).trim() === ""
  ) {
    const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak + 1;
    return [lineStart, lineEnd];
  }

  return undefined;
}

module.exports = {
  rules: {
    "no-comments": {
      meta: {
        type: "problem",
        fixable: "code",
        schema: [
          {
            type: "object",
            properties: {
              allow: { type: "array", items: { type: "string" } },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const patterns = (context.options[0]?.allow ?? []).map((pattern) => new RegExp(pattern));
        const sourceCode = context.sourceCode;

        return {
          Program() {
            const comments = sourceCode.getAllComments();
            const source = typeof sourceCode.getText === "function" ? sourceCode.getText() : "";
            const forbidden = comments.map(
              (comment) => !patterns.some((pattern) => pattern.test(comment.value)),
            );
            const lineRanges = comments.map((comment, index) =>
              forbidden[index] ? standaloneLineRange(source, comment) : undefined,
            );

            for (const [index, comment] of comments.entries()) {
              if (forbidden[index]) {
                const lineRange = lineRanges[index];
                const previousLineRange = lineRanges[index - 1];

                if (
                  lineRange !== undefined &&
                  previousLineRange !== undefined &&
                  previousLineRange[1] >= lineRange[0]
                ) {
                  continue;
                }

                let fix = (fixer) => fixer.remove(comment);

                if (lineRange !== undefined) {
                  let lineEnd = lineRange[1];

                  for (let next = index + 1; next < lineRanges.length; next += 1) {
                    const nextLineRange = lineRanges[next];

                    if (nextLineRange === undefined || nextLineRange[0] > lineEnd) {
                      break;
                    }

                    lineEnd = Math.max(lineEnd, nextLineRange[1]);
                  }

                  fix = (fixer) => fixer.removeRange([lineRange[0], lineEnd]);
                }

                context.report({
                  node: comment,
                  message:
                    "Comments are forbidden. Allow specific patterns via the `allow` option.",
                  fix,
                });
              }
            }
          },
        };
      },
    },
  },
};
