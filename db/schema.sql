-- ============================================================
-- estadistica-visual — Esquema completo (foto actual de la DB)
-- Motor: MySQL 8.0+ | Charset: utf8mb4 | Engine: InnoDB
-- ------------------------------------------------------------
-- Este archivo representa el estado COMPLETO del esquema.
-- Para cambios incrementales usa db/migrations/ (ver db/README.md).
-- ============================================================

CREATE DATABASE IF NOT EXISTS estadistica_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE estadistica_app;

-- ============================================================
-- Control de migraciones
-- Este archivo equivale a aplicar TODAS las migraciones listadas al final;
-- así `npm run migrate` sabe que no debe volver a ejecutarlas.
-- ============================================================

CREATE TABLE _migraciones (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  archivo     VARCHAR(120) NOT NULL UNIQUE,
  aplicada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Usuarios y matriz de datos
-- ============================================================

CREATE TABLE usuario (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  correo      VARCHAR(190) NOT NULL UNIQUE,
  nombre      VARCHAR(120) NOT NULL,
  hash_clave  VARCHAR(255) NOT NULL,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dataset (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id     BIGINT UNSIGNED NOT NULL,
  titulo         VARCHAR(200) NOT NULL,
  origen         ENUM('excel','csv','manual') DEFAULT 'manual',
  n_filas        INT UNSIGNED DEFAULT 0,
  n_columnas     SMALLINT UNSIGNED DEFAULT 0,
  datos_json     JSON NOT NULL,
  avisos_json    JSON,
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE,
  INDEX idx_dataset_usuario (usuario_id, creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dataset_columna (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dataset_id  BIGINT UNSIGNED NOT NULL,
  posicion    SMALLINT UNSIGNED NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  tipo_dato   ENUM('numerico','texto','fecha','booleano','mixto') NOT NULL,
  escala      ENUM('nominal','ordinal','intervalo','razon') NOT NULL,
  naturaleza  ENUM('discreta','continua','na') DEFAULT 'na',
  unidad      VARCHAR(40),
  decimales   TINYINT UNSIGNED DEFAULT 2,
  n_validos   INT UNSIGNED DEFAULT 0,
  n_nulos     INT UNSIGNED DEFAULT 0,
  UNIQUE KEY uq_col (dataset_id, posicion),
  FOREIGN KEY (dataset_id) REFERENCES dataset(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Catálogo didáctico (contenido semilla — ver db/seed/)
-- ============================================================

CREATE TABLE definicion_estadistico (
  id                SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave             VARCHAR(50) NOT NULL UNIQUE,
  nombre            VARCHAR(120) NOT NULL,
  categoria         ENUM('tendencia_central','posicion','dispersion','forma','frecuencia','asociacion') NOT NULL,
  formula_latex     TEXT NOT NULL,
  formula_texto     VARCHAR(300),
  descripcion       TEXT NOT NULL,
  cuando_usar       TEXT,
  malinterpretacion TEXT,
  requiere_ordenado BOOLEAN DEFAULT FALSE,
  requiere_agrupado BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE simbolo_formula (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  definicion_id SMALLINT UNSIGNED NOT NULL,
  simbolo_latex VARCHAR(60) NOT NULL,
  significado   VARCHAR(250) NOT NULL,
  orden         TINYINT DEFAULT 0,
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

-- ============================================================
-- Cálculos y resultados (corazón del hover educativo)
-- ============================================================

CREATE TABLE analisis (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dataset_id   BIGINT UNSIGNED NOT NULL,
  usuario_id   BIGINT UNSIGNED NOT NULL,
  nombre       VARCHAR(150),
  filtros_json JSON,
  creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES dataset(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
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
  valor_json    JSON NULL,
  n_usado       INT UNSIGNED,
  sustitucion   JSON,
  pasos         JSON,
  datos_usados  JSON,
  calculado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analisis_id) REFERENCES analisis(id) ON DELETE CASCADE,
  FOREIGN KEY (columna_id) REFERENCES dataset_columna(id) ON DELETE CASCADE,
  FOREIGN KEY (columna_b_id) REFERENCES dataset_columna(id) ON DELETE SET NULL,
  FOREIGN KEY (definicion_id) REFERENCES definicion_estadistico(id)
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

-- ============================================================
-- Migraciones que este esquema ya incluye (agrega una línea por cada nueva)
-- ============================================================

INSERT INTO _migraciones (archivo) VALUES
  ('001_init.sql');
