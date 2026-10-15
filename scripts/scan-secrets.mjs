#!/usr/bin/env node
/**
 * Detector de secretos sin dependencias.
 *
 * Se usa en dos sitios:
 *   - `.githooks/pre-commit` con `--staged`: mira sólo lo que se va a commitear.
 *   - CI sin argumentos: mira todos los ficheros versionados.
 *
 * No pretende sustituir a gitleaks (que además revisa entropía y el historial):
 * es un filtro rápido y sin red para lo típico de este proyecto. Para eximir una
 * línea concreta, escribe el marcador `secret-scan:allow` en esa misma línea.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const staged = process.argv.includes("--staged");

/** Rutas que nunca deberían llegar al repositorio. */
const BLOCKED_PATHS = [
  { re: /(^|\/)\.env\.keys$/, desc: "fichero de claves privadas de dotenvx" },
  { re: /(^|\/)\.env\.local$/, desc: "entorno local" },
  { re: /(^|\/)\.env\.[^/]*\.local$/, desc: "entorno local" },
  { re: /(^|\/)\.convex-token$/, desc: "token de Convex" },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, desc: "clave SSH privada" },
  { re: /\.(pem|p12|pfx)$/i, desc: "certificado o clave privada" },
];

/** Rutas permitidas aunque encajen con lo anterior (plantillas y este script). */
const ALLOWED_PATHS = [
  /(^|\/)\.env\.(example|sample|template)$/,
  /(^|\/)scripts\/scan-secrets\.mjs$/,
];

/** Patrones de contenido; `secret-scan:allow` en la línea los exime. */
const CONTENT_RULES = [
  {
    id: "dotenvx-private-key",
    re: /\bDOTENV_PRIVATE_KEY(?:_[A-Z0-9]+)?\s*=\s*["']?[a-f0-9]{64}["']?/i,
    desc: "clave privada de dotenvx",
  },
  {
    id: "private-key-block",
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
    desc: "bloque de clave privada",
  },
  {
    id: "vly-integration-key",
    re: /\bsk_[A-Za-z0-9]{20,}\b/,
    desc: "clave de integración (sk_…)",
  },
  {
    id: "google-api-key",
    re: /\bAIza[0-9A-Za-z\-_]{35}\b/,
    desc: "clave de Google API",
  },
  {
    id: "aws-access-key",
    re: /\bAKIA[0-9A-Z]{16}\b/,
    desc: "credencial de AWS",
  },
  {
    id: "github-token",
    re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
    desc: "token de GitHub",
  },
  {
    id: "slack-token",
    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    desc: "token de Slack",
  },
];

const ALLOW_MARKER = "secret-scan:allow";

// `stdio` silencia el stderr de git (p. ej. "not a git repository") para que el
// único mensaje que vea el usuario sea el nuestro.
const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

/** Rutas a revisar: las preparadas (staged) o todas las versionadas. */
function listPaths() {
  const out = staged
    ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
    : git(["ls-files"]);
  return out.split("\n").filter(Boolean);
}

/** Contenido de la ruta, tal y como quedaría en el commit. */
function readContent(path) {
  if (staged) {
    try {
      return git(["show", `:${path}`]);
    } catch {
      return readFileSync(path, "utf8");
    }
  }
  return readFileSync(path, "utf8");
}

const isAllowedPath = (path) => ALLOWED_PATHS.some((re) => re.test(path));

function checkPath(path, findings) {
  if (isAllowedPath(path)) return;
  for (const rule of BLOCKED_PATHS) {
    if (rule.re.test(path)) {
      findings.push({ path, line: 0, id: "blocked-path", desc: rule.desc });
    }
  }
}

function checkContent(path, findings) {
  if (isAllowedPath(path)) return;
  let content;
  try {
    content = readContent(path);
  } catch {
    return; // binario o ilegible
  }
  if (content.includes("\u0000")) return; // binario

  const lines = content.split("\n");
  for (const [i, line] of lines.entries()) {
    if (line.includes(ALLOW_MARKER)) continue;
    for (const rule of CONTENT_RULES) {
      if (rule.re.test(line)) {
        findings.push({ path, line: i + 1, id: rule.id, desc: rule.desc });
      }
    }
  }
}

function main() {
  let paths;
  try {
    paths = listPaths();
  } catch (err) {
    const detail =
      err && typeof err === "object" && "stderr" in err && err.stderr
        ? String(err.stderr).trim().split("\n")[0]
        : String(err);
    console.error(
      "No se ha podido listar los ficheros con git (¿esto no es un repositorio?):",
      detail,
    );
    process.exit(2);
  }
  const findings = [];
  for (const path of paths) {
    checkPath(path, findings);
    checkContent(path, findings);
  }

  if (findings.length === 0) {
    console.log(
      `Sin secretos en ${paths.length} fichero${paths.length === 1 ? "" : "s"}` +
        (staged ? " preparados" : " versionados") +
        ".",
    );
    return;
  }

  const scope = staged ? "que vas a commitear" : "versionados";
  console.error(
    `\n✖ Se han encontrado posibles secretos en los ficheros ${scope}:\n`,
  );
  for (const f of findings) {
    const where = f.line > 0 ? `${f.path}:${f.line}` : f.path;
    console.error(`  ${where}  →  ${f.desc}  (${f.id})`);
  }
  console.error(
    "\nQuita el secreto del commit (usa .env.local, que está ignorado) o,\n" +
      "si es un falso positivo, añade «secret-scan:allow» en esa línea.\n",
  );
  process.exit(1);
}

main();
