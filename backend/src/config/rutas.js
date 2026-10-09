import { fileURLToPath } from 'url';

// Rutas del monorepo, calculadas desde este archivo (funcionan sin importar
// desde qué carpeta se ejecute el comando).
const desde = (relativa) => fileURLToPath(new URL(relativa, import.meta.url));

export const RAIZ_REPO = desde('../../../');
export const ARCHIVO_ENV = desde('../../../.env');
export const DIR_MIGRACIONES = desde('../../../db/migrations/');
export const CATALOGO = desde('../../../db/seed/catalogo.json');
