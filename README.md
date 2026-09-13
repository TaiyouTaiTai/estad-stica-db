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
├── .env.example         ← plantilla de variables de entorno
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
├── backend/             ← (pendiente) API en Node.js
└── frontend/            ← (pendiente) app en React
```

## Estado actual

- [x] Diseño de la base de datos (ver `docs/plan-db-mvp.md`)
- [x] Esquema SQL + primera migración (ver `db/`)
- [x] Semilla del catálogo didáctico
- [ ] Backend Node.js (API + carga del seed)
- [ ] Frontend React
- [ ] Despliegue

## Cómo empezar (base de datos)

Ver instrucciones detalladas en [`db/README.md`](db/README.md). Rápido:

```bash
cp .env.example .env      # y rellena tus datos de MySQL
mysql -u root -p < db/schema.sql
```

## Documentación

Toda decisión de diseño relevante queda registrada en
[`docs/decisiones.md`](docs/decisiones.md).
