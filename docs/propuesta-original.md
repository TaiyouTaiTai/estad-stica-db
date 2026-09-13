# Propuesta de base de datos — App de estadística asistida

> **Motor:** MySQL 8.0+ · **Charset:** `utf8mb4` · **Engine:** InnoDB

Esquema pensado para una aplicación que sube archivos (Excel/CSV), los convierte
en datasets tabulares, calcula estadísticos de forma didáctica y genera gráficas.

---

## Índice de bloques

| Bloque | Tema | Tablas |
|--------|------|--------|
| 1 | Usuarios y archivos | `usuario`, `archivo`, `dataset` |
| 2 | Estructura de la matriz | `dataset_columna`, `dataset_valor`, `incidencia_ingesta` |
| 3 | Catálogo didáctico | `definicion_estadistico`, `simbolo_formula`, `estadistico_escala`, `glosario` |
| 4 | Cálculos y resultados | `analisis`, `resultado_estadistico` |
| 5 | Frecuencias y gráficas | `distribucion_frecuencia`, `clase_frecuencia`, `resumen_caja`, `grafica` |

---

## Creación de la base de datos

```sql
CREATE DATABASE IF NOT EXISTS estadistica_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE estadistica_app;
```

---

## Bloque 1 — Usuarios y archivos

Registra a los usuarios, los archivos que suben y los datasets (hojas/tablas)
que se extraen de cada archivo.

### `usuario`
Cuentas de la aplicación.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK, autoincremental |
| `correo` | VARCHAR(190) | Único, obligatorio |
| `nombre` | VARCHAR(120) | Obligatorio |
| `hash_clave` | VARCHAR(255) | Contraseña hasheada |
| `creado_en` | TIMESTAMP | Por defecto la fecha actual |

### `archivo`
Cada archivo subido por un usuario, con su estado de procesamiento.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `usuario_id` | BIGINT UNSIGNED | FK → `usuario` (ON DELETE CASCADE) |
| `nombre_orig` | VARCHAR(255) | Nombre original del archivo |
| `ruta_storage` | VARCHAR(500) | Ruta en almacenamiento |
| `mime` | VARCHAR(100) | Tipo MIME |
| `tamano_bytes` | BIGINT UNSIGNED | Tamaño en bytes |
| `sha256` | CHAR(64) | Hash de integridad |
| `estado` | ENUM | `subido`, `procesando`, `listo`, `error` |
| `error_msg` | TEXT | Detalle de error si lo hay |
| `subido_en` | TIMESTAMP | Fecha de subida |

Índice: `idx_archivo_usuario (usuario_id, subido_en)`.

### `dataset`
Una hoja/tabla concreta extraída de un archivo.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `archivo_id` | BIGINT UNSIGNED | FK → `archivo` (CASCADE) |
| `nombre_hoja` | VARCHAR(150) | Nombre de la hoja |
| `titulo` | VARCHAR(200) | Título descriptivo |
| `fila_encabezado` | SMALLINT | Fila de cabecera (def. 1) |
| `n_filas` | INT UNSIGNED | Nº de filas |
| `n_columnas` | SMALLINT UNSIGNED | Nº de columnas |
| `creado_en` | TIMESTAMP | Fecha de creación |

```sql
CREATE TABLE usuario (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  correo       VARCHAR(190) NOT NULL UNIQUE,
  nombre       VARCHAR(120) NOT NULL,
  hash_clave  VARCHAR(255) NOT NULL,
  creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE archivo (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id   BIGINT UNSIGNED NOT NULL,
  nombre_orig  VARCHAR(255) NOT NULL,
  ruta_storage VARCHAR(500) NOT NULL,
  mime         VARCHAR(100),
  tamano_bytes BIGINT UNSIGNED,
  sha256       CHAR(64),
  estado       ENUM('subido','procesando','listo','error') DEFAULT 'subido',
  error_msg    TEXT,
  subido_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE,
  INDEX idx_archivo_usuario (usuario_id, subido_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dataset (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  archivo_id     BIGINT UNSIGNED NOT NULL,
  nombre_hoja    VARCHAR(150),
  titulo         VARCHAR(200),
  fila_encabezado SMALLINT DEFAULT 1,
  n_filas        INT UNSIGNED DEFAULT 0,
  n_columnas     SMALLINT UNSIGNED DEFAULT 0,
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (archivo_id) REFERENCES archivo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Bloque 2 — Estructura de la matriz

Describe las columnas del dataset (con su tipo y escala de medición), los valores
celda a celda y las incidencias detectadas durante la ingesta.

### `dataset_columna`
Metadatos de cada columna: tipo de dato, escala de medición y conteos.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `dataset_id` | BIGINT UNSIGNED | FK → `dataset` (CASCADE) |
| `posicion` | SMALLINT UNSIGNED | Posición de la columna |
| `nombre` | VARCHAR(150) | Nombre de la columna |
| `tipo_dato` | ENUM | `numerico`, `texto`, `fecha`, `booleano`, `mixto` |
| `escala` | ENUM | `nominal`, `ordinal`, `intervalo`, `razon` |
| `naturaleza` | ENUM | `discreta`, `continua`, `na` |
| `unidad` | VARCHAR(40) | Unidad de medida |
| `decimales` | TINYINT UNSIGNED | Decimales a mostrar (def. 2) |
| `n_validos` | INT UNSIGNED | Nº de valores válidos |
| `n_nulos` | INT UNSIGNED | Nº de nulos |

Restricción única: `uq_col (dataset_id, posicion)`.

### `dataset_valor`
Los valores individuales en formato largo (una fila por celda). Usa columnas
tipadas (`valor_num`, `valor_txt`, `valor_fecha`) según el dato.

| Campo | Tipo | Notas |
|-------|------|-------|
| `dataset_id` | BIGINT UNSIGNED | Dataset al que pertenece |
| `columna_id` | BIGINT UNSIGNED | FK → `dataset_columna` (CASCADE) |
| `fila_idx` | INT UNSIGNED | Índice de fila |
| `valor_num` | DOUBLE | Valor numérico |
| `valor_txt` | VARCHAR(500) | Valor de texto |
| `valor_fecha` | DATE | Valor de fecha |
| `es_nulo` | BOOLEAN | Marca de valor nulo |

Clave primaria: `(columna_id, fila_idx)` · Índice de cálculo: `idx_calc (columna_id, valor_num)`.

### `incidencia_ingesta`
Avisos y errores encontrados al procesar el dataset.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `dataset_id` | BIGINT UNSIGNED | FK → `dataset` (CASCADE) |
| `columna_id` | BIGINT UNSIGNED | Columna afectada (opcional) |
| `fila_idx` | INT UNSIGNED | Fila afectada (opcional) |
| `severidad` | ENUM | `info`, `advertencia`, `error` |
| `codigo` | VARCHAR(50) | Código de incidencia |
| `mensaje` | VARCHAR(300) | Mensaje descriptivo |

```sql
CREATE TABLE dataset_columna (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dataset_id   BIGINT UNSIGNED NOT NULL,
  posicion     SMALLINT UNSIGNED NOT NULL,
  nombre       VARCHAR(150) NOT NULL,
  tipo_dato    ENUM('numerico','texto','fecha','booleano','mixto') NOT NULL,
  escala       ENUM('nominal','ordinal','intervalo','razon') NOT NULL,
  naturaleza   ENUM('discreta','continua','na') DEFAULT 'na',
  unidad       VARCHAR(40),
  decimales    TINYINT UNSIGNED DEFAULT 2,
  n_validos    INT UNSIGNED DEFAULT 0,
  n_nulos      INT UNSIGNED DEFAULT 0,
  UNIQUE KEY uq_col (dataset_id, posicion),
  FOREIGN KEY (dataset_id) REFERENCES dataset(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dataset_valor (
  dataset_id   BIGINT UNSIGNED NOT NULL,
  columna_id   BIGINT UNSIGNED NOT NULL,
  fila_idx     INT UNSIGNED NOT NULL,
  valor_num    DOUBLE NULL,
  valor_txt    VARCHAR(500) NULL,
  valor_fecha  DATE NULL,
  es_nulo      BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (columna_id, fila_idx),
  INDEX idx_calc (columna_id, valor_num),
  FOREIGN KEY (columna_id) REFERENCES dataset_columna(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE incidencia_ingesta (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dataset_id  BIGINT UNSIGNED NOT NULL,
  columna_id  BIGINT UNSIGNED NULL,
  fila_idx    INT UNSIGNED NULL,
  severidad   ENUM('info','advertencia','error') DEFAULT 'advertencia',
  codigo      VARCHAR(50),
  mensaje     VARCHAR(300),
  FOREIGN KEY (dataset_id) REFERENCES dataset(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Bloque 3 — Catálogo didáctico

Contenido educativo: definiciones de cada estadístico, sus símbolos de fórmula,
en qué escalas se puede usar y un glosario de términos.

### `definicion_estadistico`
Ficha de cada medida estadística (fórmula, descripción, usos y errores comunes).

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | SMALLINT UNSIGNED | PK |
| `clave` | VARCHAR(50) | Clave única (ej. `media`) |
| `nombre` | VARCHAR(120) | Nombre legible |
| `categoria` | ENUM | `tendencia_central`, `posicion`, `dispersion`, `forma`, `frecuencia`, `asociacion` |
| `formula_latex` | TEXT | Fórmula en LaTeX |
| `formula_texto` | VARCHAR(300) | Fórmula en texto plano |
| `descripcion` | TEXT | Explicación |
| `cuando_usar` | TEXT | Cuándo aplicarla |
| `malinterpretacion` | TEXT | Errores frecuentes |
| `requiere_ordenado` | BOOLEAN | Necesita datos ordenados |
| `requiere_agrupado` | BOOLEAN | Necesita datos agrupados |

### `simbolo_formula`
Significado de cada símbolo usado en las fórmulas.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | INT UNSIGNED | PK |
| `definicion_id` | SMALLINT UNSIGNED | FK → `definicion_estadistico` (CASCADE) |
| `simbolo_latex` | VARCHAR(60) | Símbolo en LaTeX |
| `significado` | VARCHAR(250) | Qué representa |
| `orden` | TINYINT | Orden de aparición |

### `estadistico_escala`
Qué escalas de medición admite cada estadístico y por qué.

| Campo | Tipo | Notas |
|-------|------|-------|
| `definicion_id` | SMALLINT UNSIGNED | FK → `definicion_estadistico` (CASCADE) |
| `escala` | ENUM | `nominal`, `ordinal`, `intervalo`, `razon` |
| `permitido` | BOOLEAN | Si está permitido |
| `motivo` | VARCHAR(250) | Justificación |

Clave primaria: `(definicion_id, escala)`.

### `glosario`
Términos y sus definiciones con ejemplo.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | INT UNSIGNED | PK |
| `termino` | VARCHAR(80) | Único |
| `definicion` | TEXT | Definición |
| `ejemplo` | TEXT | Ejemplo |

```sql
CREATE TABLE definicion_estadistico (
  id                SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave            VARCHAR(50) NOT NULL UNIQUE,
  nombre           VARCHAR(120) NOT NULL,
  categoria        ENUM('tendencia_central','posicion','dispersion','forma','frecuencia','asociacion') NOT NULL,
  formula_latex    TEXT NOT NULL,
  formula_texto    VARCHAR(300),
  descripcion      TEXT NOT NULL,
  cuando_usar      TEXT,
  malinterpretacion TEXT,
  requiere_ordenado BOOLEAN DEFAULT FALSE,
  requiere_agrupado BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE simbolo_formula (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  definicion_id SMALLINT UNSIGNED NOT NULL,
  simbolo_latex VARCHAR(60) NOT NULL,
  significado   VARCHAR(250) NOT NULL,
  orden        TINYINT DEFAULT 0,
  FOREIGN KEY (definicion_id) REFERENCES definicion_estadistico(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE estadistico_escala (
  definicion_id SMALLINT UNSIGNED NOT NULL,
  escala        ENUM('nominal','ordinal','intervalo','razon') NOT NULL,
  permitido     BOOLEAN DEFAULT TRUE,
  motivo        VARCHAR(250),
  PRIMARY KEY (definicion_id, escala),
  FOREIGN KEY (definicion_id) REFERENCES definicion_estadistico(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE glosario (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  termino    VARCHAR(80) NOT NULL UNIQUE,
  definicion TEXT NOT NULL,
  ejemplo    TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Bloque 4 — Cálculos y resultados

Cada análisis agrupa un conjunto de cálculos sobre un dataset (con filtros y una
huella para detectar duplicados), y guarda los resultados de cada estadístico.

### `analisis`
Un análisis ejecutado sobre un dataset.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `dataset_id` | BIGINT UNSIGNED | FK → `dataset` (CASCADE) |
| `usuario_id` | BIGINT UNSIGNED | Autor del análisis |
| `nombre` | VARCHAR(150) | Nombre del análisis |
| `filtros_json` | JSON | Filtros aplicados |
| `huella` | CHAR(64) | Hash para deduplicar |
| `creado_en` | TIMESTAMP | Fecha |

Índice: `idx_analisis_huella (huella)`.

### `resultado_estadistico`
Resultado de aplicar un estadístico a una (o dos) columnas, con sustituciones y
pasos guardados para mostrar el "cómo se calculó".

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `analisis_id` | BIGINT UNSIGNED | FK → `analisis` (CASCADE) |
| `columna_id` | BIGINT UNSIGNED | Columna principal |
| `columna_b_id` | BIGINT UNSIGNED | Segunda columna (asociación) |
| `definicion_id` | SMALLINT UNSIGNED | FK → `definicion_estadistico` |
| `parametro` | DECIMAL(6,3) | Parámetro (ej. percentil) |
| `valor_num` | DOUBLE | Resultado numérico |
| `valor_txt` | VARCHAR(255) | Resultado textual |
| `n_usado` | INT UNSIGNED | Nº de datos usados |
| `sustitucion` | JSON | Valores sustituidos en la fórmula |
| `pasos` | JSON | Pasos del cálculo |
| `calculado_en` | TIMESTAMP | Fecha |

Restricción única: `uq_res (analisis_id, columna_id, columna_b_id, definicion_id, parametro)`.

```sql
CREATE TABLE analisis (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dataset_id  BIGINT UNSIGNED NOT NULL,
  usuario_id  BIGINT UNSIGNED NOT NULL,
  nombre      VARCHAR(150),
  filtros_json JSON,
  huella      CHAR(64),
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES dataset(id) ON DELETE CASCADE,
  INDEX idx_analisis_huella (huella)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE resultado_estadistico (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analisis_id   BIGINT UNSIGNED NOT NULL,
  columna_id    BIGINT UNSIGNED NOT NULL,
  columna_b_id  BIGINT UNSIGNED NULL,
  definicion_id SMALLINT UNSIGNED NOT NULL,
  parametro     DECIMAL(6,3) NULL,
  valor_num     DOUBLE NULL,
  valor_txt     VARCHAR(255) NULL,
  n_usado       INT UNSIGNED,
  sustitucion   JSON,
  pasos         JSON,
  calculado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_res (analisis_id, columna_id, columna_b_id, definicion_id, parametro),
  FOREIGN KEY (analisis_id) REFERENCES analisis(id) ON DELETE CASCADE,
  FOREIGN KEY (definicion_id) REFERENCES definicion_estadistico(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Bloque 5 — Frecuencias y gráficas

Distribuciones de frecuencia con sus clases, resúmenes de cinco números para
diagramas de caja y la configuración de las gráficas generadas.

### `distribucion_frecuencia`
Parámetros de una tabla de frecuencias (método y nº de clases).

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `analisis_id` | BIGINT UNSIGNED | FK → `analisis` (CASCADE) |
| `columna_id` | BIGINT UNSIGNED | Columna analizada |
| `metodo_k` | ENUM | `sturges`, `raiz`, `scott`, `manual` |
| `k_clases` | SMALLINT UNSIGNED | Nº de clases |
| `ancho_clase` | DOUBLE | Amplitud de clase |
| `valor_min` / `valor_max` | DOUBLE | Mínimo y máximo |
| `rango` | DOUBLE | Rango |
| `n_total` | INT UNSIGNED | Total de datos |

### `clase_frecuencia`
Cada intervalo/clase de la distribución con sus frecuencias.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `distribucion_id` | BIGINT UNSIGNED | FK → `distribucion_frecuencia` (CASCADE) |
| `orden` | SMALLINT UNSIGNED | Orden de la clase |
| `lim_inf` / `lim_sup` | DOUBLE | Límites de clase |
| `frontera_inf` / `frontera_sup` | DOUBLE | Fronteras reales |
| `marca_clase` | DOUBLE | Punto medio |
| `fi` | INT UNSIGNED | Frecuencia absoluta |
| `fi_acum` | INT UNSIGNED | Frecuencia acumulada |
| `hi` | DOUBLE | Frecuencia relativa |
| `hi_acum` | DOUBLE | Frecuencia relativa acumulada |

Restricción única: `uq_clase (distribucion_id, orden)`.

### `resumen_caja`
Resumen de cinco números y valores atípicos para el diagrama de caja.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `analisis_id` | BIGINT UNSIGNED | FK → `analisis` (CASCADE) |
| `columna_id` | BIGINT UNSIGNED | Columna analizada |
| `minimo` / `maximo` | DOUBLE | Extremos |
| `q1` / `mediana` / `q3` | DOUBLE | Cuartiles |
| `riq` | DOUBLE | Rango intercuartílico |
| `bigote_inf` / `bigote_sup` | DOUBLE | Bigotes |
| `atipicos` | JSON | Valores atípicos |

Restricción única: `uq_caja (analisis_id, columna_id)`.

### `grafica`
Configuración de cada gráfica generada para un análisis.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | BIGINT UNSIGNED | PK |
| `analisis_id` | BIGINT UNSIGNED | FK → `analisis` (CASCADE) |
| `tipo` | ENUM | `histograma`, `poligono`, `ojiva`, `caja`, `barras`, `pastel`, `dispersion`, `tallo_hoja` |
| `columna_id` | BIGINT UNSIGNED | Columna principal |
| `columna_b_id` | BIGINT UNSIGNED | Segunda columna |
| `config_json` | JSON | Configuración visual |
| `creada_en` | TIMESTAMP | Fecha |

```sql
CREATE TABLE distribucion_frecuencia (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analisis_id BIGINT UNSIGNED NOT NULL,
  columna_id  BIGINT UNSIGNED NOT NULL,
  metodo_k    ENUM('sturges','raiz','scott','manual') DEFAULT 'sturges',
  k_clases    SMALLINT UNSIGNED NOT NULL,
  ancho_clase DOUBLE NOT NULL,
  valor_min   DOUBLE,
  valor_max   DOUBLE,
  rango       DOUBLE,
  n_total     INT UNSIGNED,
  FOREIGN KEY (analisis_id) REFERENCES analisis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE clase_frecuencia (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distribucion_id BIGINT UNSIGNED NOT NULL,
  orden           SMALLINT UNSIGNED NOT NULL,
  lim_inf         DOUBLE NOT NULL,
  lim_sup         DOUBLE NOT NULL,
  frontera_inf    DOUBLE,
  frontera_sup    DOUBLE,
  marca_clase     DOUBLE NOT NULL,
  fi              INT UNSIGNED NOT NULL,
  fi_acum         INT UNSIGNED NOT NULL,
  hi              DOUBLE NOT NULL,
  hi_acum         DOUBLE NOT NULL,
  UNIQUE KEY uq_clase (distribucion_id, orden),
  FOREIGN KEY (distribucion_id) REFERENCES distribucion_frecuencia(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE resumen_caja (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analisis_id BIGINT UNSIGNED NOT NULL,
  columna_id  BIGINT UNSIGNED NOT NULL,
  minimo     DOUBLE,
  q1         DOUBLE,
  mediana    DOUBLE,
  q3         DOUBLE,
  maximo     DOUBLE,
  riq        DOUBLE,
  bigote_inf DOUBLE,
  bigote_sup DOUBLE,
  atipicos   JSON,
  UNIQUE KEY uq_caja (analisis_id, columna_id),
  FOREIGN KEY (analisis_id) REFERENCES analisis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grafica (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analisis_id  BIGINT UNSIGNED NOT NULL,
  tipo         ENUM('histograma','poligono','ojiva','caja','barras','pastel','dispersion','tallo_hoja') NOT NULL,
  columna_id   BIGINT UNSIGNED NULL,
  columna_b_id BIGINT UNSIGNED NULL,
  config_json  JSON,
  creada_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analisis_id) REFERENCES analisis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
