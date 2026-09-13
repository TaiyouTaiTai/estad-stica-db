-- ============================================
-- Base de datos: app de estadística asistida
-- Motor: MySQL 8.0+ | Charset: utf8mb4 | Engine: InnoDB
-- ============================================

CREATE DATABASE IF NOT EXISTS estadistica_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE estadistica_app;

-- ============================================
-- BLOQUE 1 — Usuarios y archivos
-- ============================================

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

-- ============================================
-- BLOQUE 2 — Estructura de la matriz
-- ============================================

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

-- ============================================
-- BLOQUE 3 — Catálogo didáctico
-- ============================================

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

-- ============================================
-- BLOQUE 4 — Cálculos y resultados
-- ============================================

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

-- ============================================
-- BLOQUE 5 — Frecuencias y gráficas
-- ============================================

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