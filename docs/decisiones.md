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
