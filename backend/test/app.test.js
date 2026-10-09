// Prueba de humo de la API: rutas, autenticación y validación.
// No necesita MySQL: solo prueba lo que ocurre ANTES de llegar a la base de datos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let servidor, base, token;

before(async () => {
  // Configuración de prueba (dotenv no pisa variables que ya existen)
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'test', DB_PASSWORD: '', DB_NAME: 'test',
    JWT_SECRET: 'x'.repeat(40), JWT_EXPIRES: '1h', CORS_ORIGIN: ''
  });
  const { default: app } = await import('../src/app.js');
  const { firmarToken } = await import('../src/middlewares/auth.js');
  token = firmarToken({ id: 1, correo: 'a@b.c' });
  servidor = app.listen(0);
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(async () => {
  servidor.close();
  const { default: pool } = await import('../src/config/db.js');
  await pool.end();
});

const pedir = (ruta, { metodo = 'GET', body, conToken = true } = {}) => fetch(base + ruta, {
  method: metodo,
  headers: {
    ...(body && { 'Content-Type': 'application/json' }),
    ...(conToken && { Authorization: `Bearer ${token}` })
  },
  body: typeof body === 'string' ? body : body && JSON.stringify(body)
});

test('ruta inexistente → 404 en JSON', async () => {
  const r = await pedir('/no-existe');
  assert.equal(r.status, 404);
  assert.match((await r.json()).error, /no encontrada/);
});

test('sin token → 401', async () => {
  const r = await pedir('/datasets', { conToken: false });
  assert.equal(r.status, 401);
});

test('token falso → 401', async () => {
  const r = await fetch(`${base}/datasets`, { headers: { Authorization: 'Bearer abc' } });
  assert.equal(r.status, 401);
});

test('cálculo con datos inválidos → 400 con detalle por campo (antes: 500)', async () => {
  const r = await pedir('/calculos', { metodo: 'POST', body: { estadisticos: [] } });
  assert.equal(r.status, 400);
  const campos = (await r.json()).detalles.map(d => d.campo);
  assert.ok(campos.includes('dataset_id'));
  assert.ok(campos.includes('estadisticos'));
});

test('tipo de gráfica desconocido → 400', async () => {
  const r = await pedir('/graficas', { metodo: 'POST', body: { dataset_id: 1, columna_id: 1, tipo: 'radar' } });
  assert.equal(r.status, 400);
});

test('JSON mal formado → 400', async () => {
  const r = await pedir('/datasets', { metodo: 'POST', body: '{malo' });
  assert.equal(r.status, 400);
});

test('PATCH de columna rechaza campos fuera de la lista blanca', async () => {
  const r = await pedir('/datasets/1/columnas/1', { metodo: 'PATCH', body: { tipo_dato: 'texto' } });
  assert.equal(r.status, 400);
});

test('registro valida correo y contraseña', async () => {
  const r = await pedir('/auth/registro', { metodo: 'POST', conToken: false, body: { correo: 'no-es-correo', nombre: 'A', clave: '123' } });
  assert.equal(r.status, 400);
});

test('si la base de datos no responde, el health lo dice sin filtrar detalles', async () => {
  const r = await pedir('/health', { conToken: false });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { ok: false, db: false });
});
