# Run doc — preview local del worktree

Cómo levantar esta app en el worktree de un chat de Freebuff y enseñarla en el
panel de preview. No es un despliegue: es un servidor de desarrollo local.

---

## 1. Artefactos que no están en el repo

Dos ficheros del entorno local están en `.gitignore` y **no se pueden obtener con
un `git clone`**. Sin ellos la app no arranca:

| Fichero | Qué es | Dónde está |
| --- | --- | --- |
| `.env.local` | variables de entorno del proyecto, **cifradas** con dotenvx | en el checkout que ya tiene el entorno montado (el workspace principal del proyecto); no viaja por git |
| `.env.keys` | la clave privada de dotenvx que descifra `.env.local` | junto a `.env.local`, en ese mismo checkout |

Reglas:

- **Nunca** commitear ninguno de los dos, ni pegar su contenido en el chat, en un
  log o en un mensaje. `.githooks/pre-commit` y el job `secrets` de CI existen
  precisamente para bloquearlo.
- El nombre de las variables vive en `.env.example` (plantilla sin valores); el
  valor real solo está en `.env.local`.
- Si `.env.local` está cifrado no sirve de nada por sí solo: sin `.env.keys`
  dotenvx no puede descifrarlo y `dev:local` falla (ver §6).

Reproducción, una vez copiados **los dos** ficheros a la raíz del worktree:

```bash
cp /ruta/al/checkout-con-el-entorno/.env.local .
cp /ruta/al/checkout-con-el-entorno/.env.keys .
```

## 2. Dependencias

```bash
bun install --frozen-lockfile
```

- `bun.lock` es el único lockfile del proyecto; no añadir `package-lock.json`.
- La versión de bun está pinneada en `package.json` (`packageManager`): **1.3.14**.
- `node_modules/` y `dist/` son desechables: tras archivar/restaurar el worktree
  hay que volver a instalarlas. No hay que recrear `.env.local` / `.env.keys` si
  siguen ahí, pero tampoco cuentan como artefactos reproducibles desde git.

## 3. Arrancar el servidor

El puerto que espera el panel de preview es el **3000**.

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<hostname-del-preview> \
  bun run dev:local -- --host 0.0.0.0 --port 3000 --strictPort
```

Por qué cada pieza:

- **`dev:local`, no `dev`.** `bun run dev` es el script que usa la plataforma, que
  ya inyecta las variables por su cuenta; llama a `vite` a secas. En local las
  variables hay que descifrarlas, y eso es lo que hace `dev:local`
  (`dotenvx run --strict -f .env.local -- vite`).
- **`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`** es el nombre exacto que lee Vite
  para aceptar el `Host` del preview. Sin ella Vite responde **403** y el panel no
  carga nada. Se pasa por proceso, no se escribe en `vite.config.ts`.
- **`--host 0.0.0.0`** para no quedarse escuchando solo en loopback: hay que
  confirmar con `ss -ltn` que la dirección es `0.0.0.0:3000` y no `127.0.0.1`.
- **`--port 3000 --strictPort`** para no acabar en otro puerto si el 3000 está
  ocupado.
- **`<hostname-del-preview>`** lo da el panel/tool de preview (`cloud_show_dev_server`)
  y **cambia** al archivar y restaurar el worktree: hay que volver a leerlo, no
  reutilizar el de una sesión anterior.

Arrancarlo desacoplado del shell y con log, para poder inspeccionarlo. `setsid` lo
pone en su **propia sesión**, así que sobrevive al shell que lo lanzó y se puede
parar de una vez con una señal al grupo:

```bash
cd <raíz-del-worktree>
rm -f /tmp/vite-preview.log
setsid env __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<hostname-del-preview> \
  bun run dev:local -- --host 0.0.0.0 --port 3000 --strictPort \
  > /tmp/vite-preview.log 2>&1 &
echo "PID: $!"     # apúntalo: es el jefe del grupo de procesos (§6)
```

## 4. Comprobar que está listo (no basta el banner)

El log empieza por `⟐ injected env (N) from .env.local …` y luego
`VITE vX ready in … ms`. Eso **no** demuestra que sirva: hay que pedir la página
con el `Host` real y esperar un **200**.

```bash
# ¿escucha en 0.0.0.0:3000?
ss -ltnp | grep ':3000'

# ¿responde con el Host del preview?
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Host: <hostname-del-preview>' http://127.0.0.1:3000/
```

Y que las variables hayan llegado de verdad al cliente (el valor se sustituye en
el módulo servido; la comparación no imprime el valor):

```bash
curl -s -H 'Host: <hostname-del-preview>' http://127.0.0.1:3000/src/main.tsx \
  | grep -oE 'https://[a-z0-9.-]+\.convex\.cloud' | head -1 | sed -E 's#https://.*#OK#'
```

Un 403 significa que falta o no cuadra `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`.

## 5. Enseñarlo en el panel

Con el servidor ya en marcha y verificado, abrir el preview del puerto 3000 en el
panel derecho (tool `cloud_show_dev_server`). Eso da hot reload, pero **no** es un
despliegue ni una prueba de compatibilidad con Workers.

**La verificación visual la hace una persona.** En este entorno no hay
automatización de navegador: un 200 y la variable inyectada prueban que el
servidor sirve, no que la app pinte datos reales de Convex. Lo que queda pendiente
de comprobar a mano en el panel:

- que la app carga y no se queda en blanco ni en un error de consola;
- que llegan datos reales de Convex (no un fallo de conexión);
- que iniciar sesión funciona.

## 6. Parar y reiniciar

Con el arranque de §3 (`setsid`), basta una señal al grupo:

```bash
kill -TERM -<PID apuntado en §3>
```

Ojo: matar solo el PID del lanzador **no** basta si el arranque se hizo con
`nohup … &` a secas — el proceso `vite` es nieto del lanzador (cadena
`bun run` → `dotenvx` → `vite`) y sigue escuchando. En ese caso, localizar el PID
real por el puerto y bajarlo con su padre:

```bash
ss -ltnp | grep ':3000'                 # users:((…,pid=NNNN))  → es vite
kill -TERM <ese pid>
```

Evitar `pkill -f vite` a secas: puede alcanzar servidores de otros worktrees o el
propio shell que hace la limpieza. Para reiniciar, repetir §3 completo (no hace
falta nada más) y comprobar que el puerto quedó libre antes.

## 7. Problemas conocidos

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| `403` en el panel o en `curl` con el `Host` del preview | falta `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`, o el hostname es de una sesión anterior | volver a leer el hostname actual y reiniciar con él |
| `☠ [MISSING_ENV_FILE] missing file (.env.local)` y exit 1 | faltan `.env.local` o `.env.keys`, o están en otro sitio | copiarlos a la raíz del worktree (§1); `--strict` existe para que esto falle en vez de arrancar sin variables |
| El puerto 3000 no responde pero el log dice `ready` | el proceso murió con el shell que lo lanzó | arrancar con `nohup … &` y comprobar `ss -ltnp` (§3, §4) |
| `Host` correcto y 200, pero la app falla en el navegador | variables descifradas pero incorrectas para el deployment, o el deployment no responde | revisar en el navegador qué dice la consola; no es un problema del preview |
| Tras archivar/restaurar el worktree | se pierden `node_modules`, los procesos y **cambia el hostname** | repetir §2, §3 y §4 |

## 8. Recordatorio de seguridad

- Los valores de `.env.local` no se imprimen nunca: ni en logs, ni en el chat, ni
  en el run doc.
- `.env.local` viaja cifrado; la que hay que proteger con más celo es `.env.keys`
  (la clave privada). Si se filtra, hay que rotar la clave y actualizar el secreto
  en el gestor de la plataforma.
- Antes de dar por bueno un entorno: `bun run secrets:check` (y `bun run hooks:install`
  una vez por clon para que el hook de pre-commit esté activo).
- Para rotar la clave privada hay receta verificada en `README.md` →
  *Rotating the dotenvx key*: descifrar, quitar la línea de la clave pública,
  borrar `.env.keys` y volver a cifrar. Compara las huellas de los valores antes y
  después, y confirma que la clave vieja ya no descifra `.env.local`.
