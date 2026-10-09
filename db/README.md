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

Necesitas MySQL corriendo y el `.env` de la raíz del repo configurado.

**Recomendado — con el script de migraciones:**
```bash
cd backend
npm run migrate        # crea la base si no existe y aplica las migraciones pendientes
npm run seed           # carga el contenido didáctico de seed/catalogo.json
```

**Alternativa — todo de un jalón con `schema.sql`:**
```bash
mysql -u root -p < db/schema.sql
cd backend && npm run seed
```
`schema.sql` registra en `_migraciones` las migraciones que ya incluye, así que
después `npm run migrate` solo aplicará las nuevas.

> **¿Tu base se creó con un `schema.sql` antiguo (sin la tabla `_migraciones`)?**
> `npm run migrate` se detendrá para no romper nada. Si la base está al día, ejecuta
> una sola vez `npm run migrate -- --baseline` para marcar las migraciones como aplicadas.

Para ver qué migraciones están aplicadas: `npm run migrate -- --estado`.

## Cómo hacer un cambio a la DB (flujo)

1. Crea `db/migrations/002_descripcion_corta.sql` con el `ALTER`/`CREATE` nuevo.
   - Nombre: tres dígitos + guion bajo + minúsculas (`002_agrega_unidad.sql`).
   - No uses `DELIMITER` (triggers/procedimientos) ni `USE` de otra base.
2. Aplícala: `cd backend && npm run migrate` (la registra en `_migraciones` sola).
3. Actualiza `schema.sql` para que refleje el estado final **y agrega el nombre del
   archivo al `INSERT INTO _migraciones` del final**.
4. Si el cambio afecta al backend, cámbialo en el mismo commit.
5. `cd backend && npm test`, y commit: `git commit -m "db: agrega X"`.

La CI (`.github/workflows/ci.yml`) comprueba en cada push que:
- las migraciones se aplican sobre una base vacía y repetirlas no hace nada;
- `schema.sql` produce exactamente las mismas tablas y columnas que las migraciones;
- el catálogo tiene una definición para cada estadístico que el backend calcula.

## Tabla de control `_migraciones`

Registra qué migraciones ya se aplicaron (para no repetirlas). La crea la
migración `001` (o `schema.sql`, o el propio `npm run migrate`).
