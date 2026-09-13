# Base de datos — `estadistica-visual`

Motor: **MySQL 8.0+** · Charset `utf8mb4` · Engine `InnoDB`

## Contenido de esta carpeta

| Archivo/carpeta | Qué es |
|-----------------|--------|
| `schema.sql` | Foto completa del esquema. Cómodo para crear todo desde cero de un jalón. |
| `migrations/` | Historial de cambios incrementales, numerados. **La fuente de verdad.** |
| `seed/catalogo.json` | Contenido didáctico inicial (definiciones, símbolos, escalas, glosario). |

## ¿Por qué dos formas (schema + migrations)?

- **`migrations/`** cuenta la *historia*: cada cambio es un archivo nuevo que se
  aplica en orden. Nunca se edita una migración ya subida; los cambios futuros van
  en `002_...`, `003_...`. Esto deja documentado en Git cómo evolucionó la DB.
- **`schema.sql`** es la *foto actual* ya "aplanada", útil para levantar todo
  rápido o para leer la estructura completa sin recorrer migraciones.

> Regla: cuando agregues una migración nueva, actualiza también `schema.sql` para
> que siga reflejando el estado final.

## Cómo levantar la DB desde cero

Necesitas MySQL instalado y corriendo.

**Opción A — todo de un jalón (recomendada para empezar):**
```bash
mysql -u root -p < db/schema.sql
```

**Opción B — aplicando migraciones en orden (refleja el flujo real):**
```bash
mysql -u root -p < db/migrations/001_init.sql
# cuando existan más:
# mysql -u root -p < db/migrations/002_*.sql
```

Luego carga el contenido didáctico (cuando exista el script de seed en el backend):
```bash
node backend/scripts/seed.js
```

## Cómo hacer un cambio a la DB (flujo)

1. Crea `db/migrations/002_descripcion_corta.sql` con el `ALTER`/`CREATE` nuevo.
2. Al final de la migración: `INSERT INTO _migraciones (archivo) VALUES ('002_descripcion_corta.sql');`
3. Aplícala en tu MySQL local y prueba.
4. Actualiza `schema.sql` para que refleje el estado final.
5. Commit: `git add db/ && git commit -m "db: agrega X"`.

## Tabla de control `_migraciones`

Registra qué migraciones ya se aplicaron (para no repetirlas). Se crea en la
migración `001`.
