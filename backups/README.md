# Copias de seguridad de la base de datos

La aplicación usa **Convex** como base de datos (fichas, usuarios, centros de
trabajo e invitaciones). Los datos son los mismos para cualquiera que abra la
app: no hay una base de datos local ni por navegador.

Cada ZIP de esta carpeta es una copia completa de los datos en el momento en que
se creó. La carpeta está en `.gitignore` a propósito: son archivos binarios
locales, no código.

## Crear una copia

```bash
bun convex export --path backups/convex-AAAA-MM-DD-HHMM.zip
```

## Restaurar una copia

```bash
# Reemplaza los datos actuales por los de la copia
bun convex import --replace backups/convex-AAAA-MM-DD-HHMM.zip

# O añade los datos sin borrar los existentes
bun convex import --append backups/convex-AAAA-MM-DD-HHMM.zip
```

## Comprobar los datos

```bash
bun convex data                # todas las tablas
bun convex data workCenters
bun convex data users
bun convex data fichas
```

## Copia en la nube

Convex genera además una copia permanente por cada exportación, disponible en el
panel del proyecto: *Settings → Snapshot export*.
