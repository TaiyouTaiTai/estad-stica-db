# Backend — estadistica-visual

API en Node.js para el sistema de estadística **visual y didáctica**. Cada
resultado trae la fórmula, los números sustituidos, el paso a paso y las celdas
usadas, siguiendo el *contrato del hover* de [`docs/plan-db-mvp.md`](../docs/plan-db-mvp.md).

## Requisitos

- Node.js 20 o superior
- MySQL 8.0+

## Puesta en marcha

Desde la carpeta `backend/` (el `.env` va en la **raíz** del repo, ver `../.env.example`):

```bash
npm install
npm run db:check            # comprueba la conexión a MySQL
npm run migrate             # crea la base y aplica ../db/migrations/
npm run seed                # carga ../db/seed/catalogo.json
npm run dev                 # servidor con recarga automática
npm test                    # pruebas (la de integración se salta sin INTEGRACION=1)
```

Opciones: `npm run migrate -- --estado` (ver qué está aplicado),
`npm run migrate -- --baseline` (base creada antes con un schema.sql sin
`_migraciones`), `npm run seed -- otra/ruta.json`.

Para correr también la prueba de integración contra tu MySQL local (usa la base
de tu `.env` y crea datos de prueba): `INTEGRACION=1 npm test`.

## Estructura

```
src/
├── server.js              arranque (listen + apagado ordenado)
├── app.js                 middlewares y rutas
├── config/                env (validado con zod), rutas del repo y pool de MySQL
├── middlewares/           auth JWT, validación, errores, límite de intentos
├── routes/                endpoints HTTP (solo orquestan)
├── services/
│   ├── lectura.js         Excel/CSV/tabla → datos_json + detección de tipo/escala (puro)
│   ├── dataset.service.js guardar/leer datasets
│   ├── catalogo.service.js catálogo didáctico en memoria
│   ├── permisos.js        qué cálculos tienen sentido según tipo y escala (puro)
│   ├── calculo.service.js ejecuta los estadísticos pedidos (puro)
│   └── analisis.service.js guardar/leer análisis, resultados y gráficas
├── calculos/              fórmulas + paso a paso (funciones puras)
└── graficas/              datos para Recharts/Chart.js
scripts/
├── migrate.js             aplica las migraciones pendientes de ../db/migrations
├── seed.js                carga ../db/seed/catalogo.json
└── db-check.js            prueba la conexión
test/                      pruebas con node --test (repo.test.js revisa que db/ y backend/ estén alineados)
```

## Endpoints

Todos bajo `/api`. Los marcados con 🔒 necesitan `Authorization: Bearer <token>`.

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/auth/registro` | `{ correo, nombre, clave }` → `{ token, usuario }` |
| POST | `/auth/login` | `{ correo, clave }` → `{ token, usuario }` |
| GET 🔒 | `/auth/me` | usuario actual |
| POST 🔒 | `/datasets/archivo` | subir `.xlsx` o `.csv` (multipart, campo `archivo`, opcional `titulo`) |
| POST 🔒 | `/datasets` | crear tabla en la app: `{ titulo, columnas: [...], filas: [[...]] }` |
| GET 🔒 | `/datasets` | listar mis datasets |
| GET 🔒 | `/datasets/:id` | datos + columnas con `estadisticos_permitidos` y `graficas_permitidas` |
| PUT 🔒 | `/datasets/:id` | reemplazar los datos (borra los análisis anteriores) |
| DELETE 🔒 | `/datasets/:id` | borrar |
| PATCH 🔒 | `/datasets/:id/columnas/:columnaId` | corregir `nombre`, `escala`, `unidad` o `decimales` |
| GET 🔒 | `/datasets/:id/analisis` | historial de análisis |
| POST 🔒 | `/calculos` | calcular y guardar (ver abajo) |
| POST 🔒 | `/graficas` | generar y guardar una gráfica (ver abajo) |
| GET 🔒 | `/analisis/:id` | resultados (con hover) y gráficas de un análisis |
| DELETE 🔒 | `/analisis/:id` | borrar un análisis |
| GET | `/definiciones`, `/definiciones/:clave`, `/glosario` | catálogo didáctico |
| GET | `/health` | estado del servidor y la base |

### Calcular

```jsonc
POST /api/calculos
{
  "dataset_id": 1,
  "columna_id": 3,
  "estadisticos": ["media", "mediana", { "clave": "cuartil", "parametro": 3 }],
  "agrupado": false,          // true → media/mediana/moda con tabla de frecuencias
  "metodo_clases": "sturges", // sturges | raiz | scott
  "poblacional": false,       // varianza/desviación: n en vez de n-1
  "analisis_id": 7            // opcional: agrega a un análisis existente
}
```

Respuesta: `{ analisis, errores, avisos }`. Cada resultado de `analisis.resultados`
trae `sustitucion`, `pasos` y `datos_usados`. Si un estadístico no aplica (ej. media
de una columna nominal) va a `errores` con el motivo del catálogo; los demás se
calculan igual.

Estadísticos: `media`, `mediana`, `moda`, `rango`, `varianza`, `desviacion_estandar`,
`coeficiente_variacion`, `cuartil` (1–3), `decil` (1–9), `percentil` (1–99),
`resumen_caja`. Cada uno debe existir en el catálogo (`definicion_estadistico.clave`).

### Gráficas

```jsonc
POST /api/graficas
{ "dataset_id": 1, "tipo": "histograma", "columna_id": 3 }
```

Tipos: `histograma`, `poligono`, `ojiva`, `caja`, `barras`, `pastel`, `dispersion`
(esta última necesita `columna_b_id`). Cada una incluye un texto `como_leer`.
