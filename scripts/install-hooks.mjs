#!/usr/bin/env node
/**
 * Instala los hooks versionados en `.githooks/` apuntando `core.hooksPath` a
 * esa carpeta. Es un paso explícito (no un `prepare` automático) para no tocar
 * la configuración de git sin pedirlo.
 *
 * Uso:      bun run hooks:install
 * Deshacer: git config --unset core.hooksPath
 */

import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    stdio: "inherit",
  });
  console.log("Hooks instalados: core.hooksPath=.githooks");
  console.log("A partir de ahora, `git commit` ejecuta .githooks/pre-commit.");
} catch (err) {
  console.error(
    "No se han podido instalar los hooks:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
