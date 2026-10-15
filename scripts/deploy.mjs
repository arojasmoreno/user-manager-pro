#!/usr/bin/env node
/**
 * Publica el sitio en un solo paso: comprueba el entorno, construye `dist/`,
 * publica el worker en Cloudflare y verifica la URL publicada.
 *
 *   bun run deploy                    # construye, publica y verifica
 *   bun run deploy -- --url <url>     # publica y verifica esa URL
 *   bun run deploy -- --no-build      # publica el `dist/` que ya existe
 *   bun run deploy -- --no-deploy     # construye y verifica, sin publicar
 *
 * Es el mismo camino que usa CI (`.github/workflows/deploy.yml`), de forma que un
 * fallo se ve antes en local que en `main`. El único trozo que no se puede
 * ejecutar sin credenciales es la publicación en sí.
 *
 * Variables de entorno:
 *
 *   VITE_CONVEX_URL         para construir. En CI viene del secreto. En local, si
 *                           no está definida y existe `.env.local`, se descifra
 *                           con dotenvx (igual que `dev:local`).
 *   CLOUDFLARE_API_TOKEN    para publicar. Las lee wrangler, no este script.
 *   CLOUDFLARE_ACCOUNT_ID   para publicar.
 *   PUBLISH_URL             URL para la verificación (equivale a `--url`).
 *
 * Ojo con el alcance: esto publica el worker de Cloudflare, que sirve su propia
 * URL. `docmanager.freebuff.app` —la URL de producción del proyecto— la sirve la
 * plataforma, así que publicar aquí no la mueve.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

/** El CLI se fija en una major para que un cambio de versión no altere el deploy. */
const WRANGLER = "wrangler@4";
/** Debe coincidir con `name` de wrangler.jsonc. */
const WORKER = "docmanager";
/** Entorno local cifrado, el mismo que usa `dev:local`. */
const ENV_FILE = ".env.local";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Publica el sitio: comprueba, construye, publica en Cloudflare y verifica.

  bun run deploy [opciones]

Opciones
  --url <url>    verifica esta URL en lugar de la que devuelva el despliegue
  --no-build     no construye; publica el dist/ que ya existe
  --no-deploy    no publica; sólo construye y verifica (necesita --url)
  -h, --help     muestra esta ayuda

Ejemplos
  bun run deploy -- --no-deploy --url https://docmanager.freebuff.app
  bun run deploy -- --no-build --url https://docmanager.example.workers.dev`);
}

/** Argumentos de línea de órdenes; `--` lo consume el gestor de paquetes. */
function parseArgs(argv) {
  const args = { url: "", noBuild: false, noDeploy: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg === "--no-build") args.noBuild = true;
    else if (arg === "--no-deploy") args.noDeploy = true;
    else if (arg === "--url") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--"))
        fail("--url necesita una URL: --url <url>");
      args.url = value;
      i += 1;
    } else if (arg.startsWith("--url=")) args.url = arg.slice("--url=".length);
    else
      fail(`Opción desconocida: ${arg}. Usa --help para ver las disponibles.`);
  }
  return args;
}

/** Ejecuta heredando la salida; devuelve el resultado de `spawnSync`. */
function run(command, commandArgs) {
  return spawnSync(command, commandArgs, { stdio: "inherit" });
}

/**
 * Igual que `run`, pero se queda con la salida para poder leer de ella la URL
 * publicada, que wrangler escribe en stdout. Se reimprime tal cual para no
 * esconder nada de lo que dijo el CLI.
 */
function runCapturing(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function reportSpawnResult(result, what) {
  if (result.error) {
    fail(`${what} no se ha podido ejecutar: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${what} ha fallado (exit ${result.status}).`);
  }
}

function build({ noBuild }) {
  if (noBuild) {
    console.log("· Build: se omite (--no-build)");
    return;
  }

  const inEnv = Boolean(process.env.VITE_CONVEX_URL);
  if (!inEnv && !existsSync(ENV_FILE)) {
    fail(
      "Para construir falta VITE_CONVEX_URL y no hay " +
        `${ENV_FILE} que descifrar. Expórtala o copia ${ENV_FILE} y .env.keys ` +
        "desde un checkout que ya los tenga (ver README → Local dev).",
    );
  }

  if (inEnv) {
    console.log("· Build: bun run build (VITE_CONVEX_URL del entorno)");
    reportSpawnResult(run("bun", ["run", "build"]), "El build");
    return;
  }

  console.log(
    `· Build: descifrando ${ENV_FILE} con dotenvx y ejecutando bun run build`,
  );
  reportSpawnResult(
    run("npx", [
      "--yes",
      "@dotenvx/dotenvx",
      "run",
      "--strict",
      "-f",
      ENV_FILE,
      "--",
      "bun",
      "run",
      "build",
    ]),
    "El build",
  );
}

function publish({ noDeploy }) {
  if (noDeploy) {
    console.log("· Publicación: se omite (--no-deploy)");
    return "";
  }

  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter(
    (name) => !process.env[name],
  );
  if (missing.length > 0) {
    fail(
      `Para publicar en Cloudflare falta: ${missing.join(", ")}. ` +
        "En local añádelas al entorno (o usa --no-deploy para sólo construir y verificar); " +
        "en CI vienen de los secretos del repositorio.",
    );
  }

  console.log(`· Publicación: npx --yes ${WRANGLER} deploy`);
  const result = runCapturing("npx", ["--yes", WRANGLER, "deploy"]);
  // La salida se guarda aunque el comando falle: el error de wrangler es la
  // única pista de por qué falló.
  reportSpawnResult(result, "La publicación");
  console.log("· Publicación: hecha");
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

/** URL del worker tal y como la imprime `wrangler deploy`. */
function urlFromOutput(output) {
  const match = output.match(/https:\/\/[^\s]*\.workers\.dev\S*/);
  return match ? match[0].replace(/[),.;]+$/, "") : "";
}

/**
 * Plan B si el CLI cambia de formato: preguntar a la API por el subdominio de la
 * cuenta. El worker vive en `https://<worker>.<subdominio>.workers.dev`.
 */
async function urlFromApi() {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/subdomain`,
      {
        headers: {
          authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok) return "";
    const body = await res.json();
    const subdomain = body?.result?.subdomain;
    return subdomain ? `https://${WORKER}.${subdomain}.workers.dev` : "";
  } catch {
    return "";
  }
}

async function resolveUrl(args, output) {
  if (args.url) return args.url;
  if (process.env.PUBLISH_URL) return process.env.PUBLISH_URL;
  const fromOutput = urlFromOutput(output);
  if (fromOutput) return fromOutput;
  if (!args.noDeploy) {
    console.log(
      "· URL: no aparece en la salida de wrangler; se pregunta a la API",
    );
    const fromApi = await urlFromApi();
    if (fromApi) return fromApi;
  }
  return "";
}

/** Verificación, reutilizando el mismo script que el workflow. */
function verify(url) {
  console.log(`· Verificación: node scripts/check-site.mjs ${url}`);
  const result = run("node", ["scripts/check-site.mjs", url]);
  if (result.status !== 0) {
    fail(
      `La URL publicada no pasa la comprobación: ${url}. ` +
        "El último despliegue correcto sigue siendo el que está sirviendo; " +
        "si acabas de publicar y no quieres dejar esa versión en pie, " +
        `reviértela con \`npx ${WRANGLER} rollback\`.`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (args.noDeploy && !args.url && !process.env.PUBLISH_URL) {
    // Sin publicación no hay salida que leer: la URL tiene que venir de fuera.
    fail(
      "Con --no-deploy hay que indicar qué verificar: --url <url> o PUBLISH_URL.",
    );
  }

  console.log(`Publicación de ${WORKER} (wrangler.jsonc → dist/)`);
  build(args);
  const output = publish(args);
  const url = await resolveUrl(args, output);
  if (!url) {
    fail(
      "Se ha publicado, pero no se ha podido deducir la URL del despliegue. " +
        "Pásala a mano para verificarla: bun run deploy -- --no-build --url <url>",
    );
  }
  verify(url);

  const summary = [
    args.noBuild ? "dist/ existente" : "build hecho",
    args.noDeploy ? "sin publicar (--no-deploy)" : "publicado",
    `verificado en ${url}`,
  ].join(" · ");
  console.log(`\nOK: ${WORKER} · ${summary}`);
  if (!args.noDeploy) {
    console.log(
      "Recordatorio: docmanager.freebuff.app la sirve la plataforma; esta URL es otro host de la misma build.",
    );
  }
}

main().catch((err) => {
  fail(`Error inesperado publicando: ${err && err.stack ? err.stack : err}`);
});
