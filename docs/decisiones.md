# Registro de decisiones (ADR)

Este archivo documenta **por qué** se tomaron las decisiones importantes. Como el
proyecto se construye con ayuda de IA, aquí queda el rastro de qué se propuso, qué
se rectificó y por qué — que es parte del objetivo del proyecto.

Formato: cada decisión tiene fecha, contexto, decisión y consecuencias.

---

## ADR-001 — Guardar los datos de la matriz como JSON, no celda por celda

- **Fecha:** 2026-09-13
- **Contexto:** El diseño original guardaba cada celda como una fila en una tabla
  `dataset_valor`. Para un Excel mediano son decenas de miles de filas.
- **Decisión:** Guardar la matriz completa en un campo `datos_json` dentro de
  `dataset`. Los cálculos se hacen en Node (en memoria) y solo se guardan los
  resultados.
- **Consecuencias:** Menos tablas y menos complejidad. Límite práctico: datasets
  de pocos MB (suficiente para uso educativo). Si algún día hay datasets enormes,
  se migra a archivo en storage + ruta.

## ADR-002 — Mantener `dataset_columna` como tabla (no JSON)

- **Fecha:** 2026-09-13
- **Contexto:** Se simplificó guardando datos en JSON, pero los metadatos de
  columna (tipo, escala) se necesitan para lógica, no solo para mostrar.
- **Decisión:** `dataset_columna` sigue siendo tabla relacional.
- **Consecuencias:** Permite consultar y decidir en el backend qué cálculos
  ofrecer según la escala de cada columna (evita cálculos sin sentido).

## ADR-003 — Colapsar tablas de resultados complejos en JSON

- **Fecha:** 2026-09-13
- **Contexto:** El diseño original tenía tablas separadas para distribución de
  frecuencia, clases y resumen de caja.
- **Decisión:** Guardar esos resultados estructurados en `resultado_estadistico.valor_json`.
- **Consecuencias:** Se pasa de 16 a 9 tablas. Se pierde consulta SQL fina sobre
  esos resultados, pero no se necesita para el producto.

## ADR-004 — El "hover educativo" se apoya en 3 campos JSON

- **Fecha:** 2026-09-13
- **Contexto:** El feature clave es explicar cada cálculo al pasar el mouse.
- **Decisión:** Cada `resultado_estadistico` guarda `sustitucion` (fórmula con
  valores), `pasos` (paso a paso) y `datos_usados` (qué celdas entraron). El
  contrato de estos JSON está en `docs/plan-db-mvp.md`.
- **Consecuencias:** Backend y frontend comparten un contrato claro. Conviene
  fijarlo en tipos TypeScript compartidos.

## ADR-005 — Versionado de la DB con schema.sql + migrations

- **Fecha:** 2026-09-13
- **Contexto:** Hay que documentar cómo evoluciona la base en Git.
- **Decisión:** `db/migrations/` como historial (fuente de verdad) + `db/schema.sql`
  como foto actual. Nunca se editan migraciones ya subidas.
- **Consecuencias:** El `git log` documenta la evolución de la DB.

## ADR-006 — Monorepo: base de datos y backend en el mismo repositorio

- **Fecha:** 2026-10-09
- **Contexto:** El backend vivía en otro repositorio y se programó contra la
  propuesta original (tablas `archivo` y `dataset_valor`), no contra el diseño
  final de ADR-001. Al estar separados, nada avisó del desfase. Además, ese
  repositorio tenía el `.env` con contraseñas subido a Git.
- **Decisión:** Mover el backend a `backend/` dentro de este repositorio, **sin
  su historial** (para no arrastrar los secretos). Un solo `.env` en la raíz.
  Una CI en GitHub Actions comprueba en cada push que migraciones, `schema.sql`,
  catálogo y backend sigan alineados, usando un MySQL real.
- **Consecuencias:** Un cambio de base y su código van en el mismo commit. El
  historial previo del backend queda en el repositorio viejo (a archivar). El
  frontend debería vivir también aquí, en `frontend/`.

## ADR-007 — Migraciones aplicadas con `npm run migrate`

- **Fecha:** 2026-10-09
- **Contexto:** Aplicar migraciones a mano obliga a recordar cuáles ya se
  corrieron. `schema.sql` no creaba `_migraciones`, así que una base levantada
  con él no podía recibir migraciones nuevas.
- **Decisión:** `backend/scripts/migrate.js` aplica en orden las migraciones que
  no estén en `_migraciones`. `schema.sql` crea `_migraciones` y registra las
  migraciones que ya incluye. Para bases antiguas existe `--baseline`.
- **Consecuencias:** Los CREATE/ALTER de MySQL no se pueden deshacer: si una
  migración falla a la mitad hay que revisar a mano. Las migraciones no pueden
  usar `DELIMITER`.

## ADR-008 — Convenciones estadísticas del backend

- **Fecha:** 2026-10-09
- **Contexto:** Hay varias formas válidas de calcular algunos estadísticos, y
  distintos programas dan resultados distintos; para enseñar hay que elegir una
  y explicarla.
- **Decisión:**
  - Varianza y desviación estándar **muestrales (n − 1)** por defecto, igual que
    el catálogo; la poblacional (n) es una opción explícita.
  - Cuartiles, deciles y percentiles por la posición **k(n + 1)/partes**, con
    interpolación lineal; si la posición cae fuera de los datos se usa el extremo.
  - Atípicos con la regla de Tukey (1.5 × RIQ); los bigotes llegan al último
    dato real dentro de las cercas.
  - Número de clases por Sturges por defecto (también raíz de n y Scott).
- **Consecuencias:** Los resultados pueden diferir un poco de Excel (que usa
  otro método de cuartiles). El paso a paso explica el método usado.
