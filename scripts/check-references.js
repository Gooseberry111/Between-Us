/*
 * Catches the mistake that has bitten this project twice:
 * a component or namespace used at runtime that nothing
 * imports. Bundling does not catch it -- the app simply
 * crashes when that screen opens.
 *
 * Also checks that every styles.x referenced actually
 * exists in the StyleSheet below it.
 *
 *   node scripts/check-references.js
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = process.cwd();
const problems = [];

const GLOBALS = new Set([
  "Math",
  "JSON",
  "Object",
  "Array",
  "Date",
  "Promise",
  "String",
  "Number",
  "Boolean",
  "Error",
  "React",
  "Intl",
  "Set",
  "Map",
  "AbortController",
]);

function check(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      check(full);
      continue;
    }

    if (!full.endsWith(".js")) continue;

    const code = fs.readFileSync(full, "utf8");
    const where = path.relative(ROOT, full);

    let ast;

    try {
      ast = parser.parse(code, { sourceType: "module", plugins: ["jsx"] });
    } catch (error) {
      problems.push(`${where} -> cannot parse: ${error.message}`);
      continue;
    }

    const declared = new Set();
    const used = new Map();

    const walk = (node, parent) => {
      if (!node || typeof node.type !== "string") return;

      if (
        node.type === "ImportDefaultSpecifier" ||
        node.type === "ImportNamespaceSpecifier" ||
        node.type === "ImportSpecifier"
      ) {
        declared.add(node.local.name);
      } else if (node.type === "VariableDeclarator") {
        if (node.id.type === "Identifier") declared.add(node.id.name);
      } else if (
        node.type === "FunctionDeclaration" ||
        node.type === "ClassDeclaration"
      ) {
        if (node.id) declared.add(node.id.name);
      } else if (node.type === "JSXIdentifier") {
        if (
          parent &&
          parent.type === "JSXOpeningElement" &&
          /^[A-Z]/.test(node.name)
        ) {
          used.set(node.name, node.loc.start.line);
        }
      } else if (node.type === "MemberExpression") {
        if (
          node.object.type === "Identifier" &&
          /^[A-Z]/.test(node.object.name)
        ) {
          used.set(node.object.name, node.loc.start.line);
        }
      }

      for (const key of Object.keys(node)) {
        const value = node[key];

        if (Array.isArray(value)) value.forEach((child) => walk(child, node));
        else if (value && typeof value.type === "string") walk(value, node);
      }
    };

    walk(ast.program, null);

    for (const [name, line] of used) {
      if (!declared.has(name) && !GLOBALS.has(name)) {
        problems.push(`${where}:${line} -> ${name} is not imported`);
      }
    }

    /* styles.foo must exist */
    const styleNames = new Set(
      [...code.matchAll(/^ {2}([A-Za-z0-9_]+): \{/gm)].map((m) => m[1]),
    );

    for (const match of code.matchAll(/styles\.([A-Za-z0-9_]+)/g)) {
      if (!styleNames.has(match[1])) {
        problems.push(`${where} -> styles.${match[1]} is not defined`);
      }
    }
  }
}

["app", "components", "lib"].forEach((dir) => check(path.join(ROOT, dir)));

if (problems.length) {
  console.error("PROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}

console.log("references OK");
