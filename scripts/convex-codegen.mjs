#!/usr/bin/env node
/**
 * Genera `src/convex/_generated/` sin acceso al deployment de Convex.
 *
 * ¿Por qué existe este script?
 *
 * `npx convex codegen` (y `npx convex dev`) exigen credenciales del deployment
 * para hacer un push: en este proyecto el deployment pertenece a la plataforma,
 * así que en un checkout local el CLI responde `401 MissingAccessToken` y el
 * repositorio se queda sin tipos (`src/convex/_generated/` está en .gitignore).
 * Sin esos tipos ni `tsc` ni los tests funcionan.
 *
 * Convex recomienda versionar el código generado. Este script reproduce esa
 * salida usando las propias plantillas del paquete `convex` instalado, de modo
 * que el repositorio sea verificable sin deployment.
 *
 * La vía canónica sigue siendo `npx convex dev` (o el publish de la
 * plataforma), que además escribe la versión tipada de `api.ts`. Este script
 * produce exactamente la misma forma (`staticApi: false`), así que reemplazarla
 * más tarde no cambia nada del resto del código.
 *
 * Uso: `node scripts/convex-codegen.mjs`
 */

import Module, { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionsDir = path.join(root, "src", "convex");
const codegenDir = path.join(functionsDir, "_generated");

// Las plantillas del CLI arrastran dependencias que solo necesita la interfaz
// de línea de comandos (ora, chalk, commander, @sentry/node) y que no están
// instaladas aquí. No las usamos: devolvemos un no-op para que el require no
// falle y podamos leer las plantillas, que son sólo funciones que devuelven
// cadenas.
const noop = new Proxy(function () {}, {
  get: (_t, prop) => (prop === "__esModule" ? false : noop),
  apply: () => noop,
});
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  try {
    return originalLoad.call(this, request, ...rest);
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND") return noop;
    throw err;
  }
};

// Plantillas oficiales del paquete convex instalado (mismas que usa el CLI).
const { dynamicDataModelTS } = require(
  path.join(root, "node_modules/convex/dist/cjs/cli/codegen_templates/dataModel.js"),
);
const { serverCodegen } = require(
  path.join(root, "node_modules/convex/dist/cjs/cli/codegen_templates/server.js"),
);

const HEADER = `/* eslint-disable */
/**
 * %DESC%
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\`.
 * @module
 */
`;

// Mismas reglas que el bundler de Convex (bundler/index.js -> entryPoints).
const ENTRY_POINT_EXTENSIONS = [
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".jsx",
];

/** @returns {string[]} rutas absolutas de los módulos de entrada, ordenadas. */
function entryPoints(dir) {
  const found = [];
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = path.relative(dir, full);
      const ext = path.extname(full).toLowerCase();
      const base = path.basename(full);
      if (!ENTRY_POINT_EXTENSIONS.includes(ext)) continue;
      if (rel.startsWith(`_generated${path.sep}`)) continue;
      if (base.startsWith(".") || base.startsWith("#")) continue;
      if (base === "schema.ts" || base === "schema.js") continue;
      if ((base.match(/\./g) || []).length > 1) continue;
      if (rel.includes(" ")) continue;
      if (
        (full.endsWith(".ts") || full.endsWith(".tsx")) &&
        !/^\s{0,100}(import|export)/m.test(readFileSync(full, "utf8"))
      ) {
        continue;
      }
      found.push(full);
    }
  };
  walk(dir);
  return found;
}

// Mismo identificador/import que genera el CLI (codegen_templates/api.js).
const importPath = (modulePath) => {
  const p = modulePath.replace(/\\/g, "/");
  const dot = p.lastIndexOf(".");
  return dot === -1 ? p : p.slice(0, dot);
};

const moduleIdentifier = (modulePath) => {
  let ident = importPath(modulePath).replace(/\//g, "_").replace(/-/g, "_");
  if (["fullApi", "api", "internal", "components"].includes(ident)) {
    ident = `${ident}_`;
  }
  return ident;
};

const collator = new Intl.Collator("en-US", {
  usage: "sort",
  numeric: true,
  sensitivity: "case",
  ignorePunctuation: false,
  caseFirst: "false",
});
const compareModulePaths = (a, b) =>
  collator.compare(importPath(a), importPath(b)) ||
  collator.compare(path.extname(a), path.extname(b));

function generateApiTs() {
  const modulePaths = entryPoints(functionsDir)
    .map((p) => path.relative(functionsDir, p))
    .sort(compareModulePaths);

  const lines = [HEADER.replace("%DESC%", "Generated `api` utility.")];
  for (const modulePath of modulePaths) {
    lines.push(
      `import type * as ${moduleIdentifier(modulePath)} from "../${importPath(modulePath)}.js";`,
    );
  }
  lines.push(
    `import type {`,
    `  ApiFromModules,`,
    `  FilterApi,`,
    `  FunctionReference,`,
    `} from "convex/server";`,
    `import { anyApi, componentsGeneric } from "convex/server";`,
    ``,
    `const fullApi: ApiFromModules<{`,
  );
  for (const modulePath of modulePaths) {
    lines.push(`  "${importPath(modulePath)}": typeof ${moduleIdentifier(modulePath)},`);
  }
  lines.push(
    `}> = anyApi as any;`,
    ``,
    `/**`,
    ` * A utility for referencing Convex functions in your app's public API.`,
    ` *`,
    ` * Usage:`,
    ` * \`\`\`js`,
    ` * const myFunctionReference = api.myModule.myFunction;`,
    ` * \`\`\``,
    ` */`,
    `export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;`,
    ``,
    `/**`,
    ` * A utility for referencing Convex functions in your app's internal API.`,
    ` *`,
    ` * Usage:`,
    ` * \`\`\`js`,
    ` * const myFunctionReference = internal.myModule.myFunction;`,
    ` * \`\`\``,
    ` */`,
    `export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;`,
    ``,
    `export declare const components: {`,
    `};`,
  );
  return lines.join("\n");
}

async function main() {
  if (!existsSync(functionsDir)) {
    throw new Error(`No existe ${functionsDir}`);
  }
  rmSync(codegenDir, { recursive: true, force: true });
  mkdirSync(codegenDir, { recursive: true });

  // El CLI formatea con prettier (API, no CLI: la CLI respeta .gitignore y
  // estos ficheros viven en un directorio ignorado hasta que se versionan).
  const prettier = require("prettier");
  const files = {
    "api.ts": generateApiTs(),
    "dataModel.ts": dynamicDataModelTS(),
    "server.ts": serverCodegen({ useTypeScript: true, envVars: undefined }).TS,
  };

  for (const [name, contents] of Object.entries(files)) {
    const formatted = await prettier.format(contents, { parser: "typescript" });
    writeFileSync(path.join(codegenDir, name), formatted);
  }

  console.log(
    `Generado ${path.relative(root, codegenDir)}: ${Object.keys(files).join(", ")}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
