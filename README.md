# estadistica-visual

Sistema de estadística **visual y didáctica**: permite a personas que no dominan
la estadística subir o crear tablas de datos y obtener cálculos (media, mediana,
medidas de posición, gráficas). Al pasar el mouse sobre cualquier resultado, se
muestra **la fórmula usada, los datos que se tomaron en cuenta y el paso a paso**.

> Proyecto construido con asistencia de IA como ejercicio para explorar sus
> límites y nuestra capacidad de dirigir y rectificar el trabajo.

## Stack

- **Frontend:** React (render de fórmulas con KaTeX, gráficas con Recharts/Chart.js)
- **Backend:** Node.js
- **Base de datos:** MySQL 8.0+

## Estructura del proyecto

```
estadistica-visual/
├── README.md            ← este archivo
├── .gitignore
├── .env.example         ← plantilla del .env (uno solo para todo el proyecto)
├── .github/workflows/   ← CI: pruebas + MySQL real en cada push
├── docs/                ← documentación y decisiones de diseño
│   ├── plan-db-mvp.md          (diseño de la base de datos + contrato del hover)
│   ├── decisiones.md           (registro de decisiones / ADR)
│   ├── propuesta-original.md   (propuesta inicial, legible — referencia histórica)
│   └── propuesta-original-sql.md
├── db/                  ← TODO lo relacionado con la base de datos
│   ├── README.md               (cómo levantar y evolucionar la DB)
│   ├── schema.sql              (foto completa del esquema)
│   ├── migrations/             (historial de cambios)
│   └── seed/catalogo.json      (contenido didáctico inicial)
├── backend/             ← API en Node.js (ver backend/README.md)
└── frontend/            ← (pendiente) app en React
```

## Estado actual

- [x] Diseño de la base de datos (ver `docs/plan-db-mvp.md`)
- [x] Esquema SQL + primera migración (ver `db/`)
- [x] Semilla del catálogo didáctico
- [x] Backend Node.js (API + carga del seed + migraciones)
- [ ] Frontend React
- [ ] Despliegue

## Cómo empezar

Necesitas Node.js 20+ y MySQL 8.0+ corriendo.

```bash
cp .env.example .env      # y rellena tus datos de MySQL y un JWT_SECRET
cd backend
npm install
npm run migrate           # crea la base y aplica db/migrations/
npm run seed              # carga db/seed/catalogo.json
npm run dev               # API en http://localhost:3000
npm test                  # pruebas
```

Más detalle: [`db/README.md`](db/README.md) y [`backend/README.md`](backend/README.md).

## Por qué un solo repositorio

La base de datos y el backend cambian juntos: una migración nueva casi siempre
viene con código que la usa. Al vivir en el mismo repo, **un solo commit** cambia
ambos, y la CI comprueba en cada push que sigan alineados (ver ADR-006).

## Documentación

Toda decisión de diseño relevante queda registrada en
[`docs/decisiones.md`](docs/decisiones.md).
