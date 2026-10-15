#!/usr/bin/env node
/**
 * Comprobación posterior al despliegue: que la web publicada sirve la app.
 *
 * Publicar en verde no basta, y aquí hay una trampa concreta: el fallback del
 * SPA manda cualquier ruta desconocida a `index.html`, así que un 200 a secas
 * no prueba nada — daría 200 incluso si los assets no se sirvieran. Por eso se
 * comprueban dos cosas, en este orden:
 *
 *   1. que la raíz responda 200 y traiga el punto de montaje de React
 *      (`<div id="root">`), y
 *   2. que el asset que ese HTML referencia se sirva con un `Content-Type`
 *      de JavaScript (si el hosting devolviera HTML en su lugar, se nota aquí).
 *
 * Como un despliegue recién hecho puede tardar en propagarse, se reintenta.
 * Cualquier fallo sale con `process.exit(1)`, que es lo que marca en rojo el
 * paso del workflow; `::error::` hace que GitHub lo muestre como anotación.
 *
 * Uso:  node scripts/check-site.mjs <url-publicada>
 *
 * Opcionales (para reintentos rápidos al probar este script):
 *   CHECK_ATTEMPTS  intentos antes de darlo por fallido  (por defecto 5)
 *   CHECK_RETRY_MS  espera entre intentos, en ms         (por defecto 5000)
 */

const attempts = Number(process.env.CHECK_ATTEMPTS ?? 5);
const retryMs = Number(process.env.CHECK_RETRY_MS ?? 5000);
const timeoutMs = 20000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

/** Descarga una URL y devuelve estado, tipo de contenido y cuerpo. */
async function fetchText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
    headers: { "user-agent": "user-manager-pro/check-site" },
  });
  const body = await res.text();
  return { status: res.status, type: res.headers.get("content-type") ?? "", body };
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    fail(
      "Falta la URL publicada. Uso: node scripts/check-site.mjs <url> " +
        "(en el workflow sale de steps.deploy.outputs.deployment-url).",
    );
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    fail(`CHECK_ATTEMPTS no es un entero válido: ${process.env.CHECK_ATTEMPTS}`);
  }

  const base = target.replace(/\/+$/, "");

  // 1) El HTML de la app.
  let html = null;
  let lastProblem = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const page = await fetchText(`${base}/`);
      if (page.status === 200 && page.body.includes('<div id="root"')) {
        html = page;
        break;
      }
      lastProblem =
        page.status === 200
          ? "200 pero sin el punto de montaje de React (<div id=\"root\">)"
          : `estado ${page.status}`;
    } catch (err) {
      lastProblem = `no responde (${err && err.name ? err.name : err})`;
    }
    if (attempt === attempts) {
      fail(
        `${base}/ no sirve la app: ${lastProblem}. ` +
          `Comprueba el despliegue y la URL del worker.`,
      );
    }
    await sleep(retryMs);
  }

  // 2) El asset principal, que sí demuestra que se sirven ficheros estáticos.
  const entry = html.body.match(/src="(\/assets\/[^"]+)"/);
  if (!entry) {
    fail(`${base}/ no referencia ningún asset en /assets: el HTML no es el de la app.`);
  }

  // `new URL("/assets/…", base)` resuelve contra el origen, igual que haría el
  // navegador: las rutas del HTML son absolutas, no dependen de la ruta base.
  const assetUrl = new URL(entry[1], base).toString();
  let asset;
  try {
    asset = await fetchText(assetUrl);
  } catch (err) {
    fail(`El asset ${entry[1]} no se descarga (${err && err.name ? err.name : err}).`);
  }

  if (asset.status !== 200) {
    fail(`El asset ${entry[1]} responde ${asset.status} en lugar de 200.`);
  }
  if (!/javascript/i.test(asset.type)) {
    fail(
      `El asset ${entry[1]} se sirve como «${asset.type}» y no como JavaScript: ` +
        `probablemente el HTML lo esté devolviendo en vez del fichero.`,
    );
  }

  console.log(
    `OK: ${base} sirve la app (HTML 200 con #root, ${entry[1]} como ${asset.type}).`,
  );
}

main().catch((err) => {
  fail(`Error inesperado comprobando el sitio: ${err && err.stack ? err.stack : err}`);
});
