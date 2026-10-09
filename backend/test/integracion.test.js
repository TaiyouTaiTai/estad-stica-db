// Prueba de punta a punta contra un MySQL REAL (migrado y con el seed cargado).
// Se salta salvo que INTEGRACION=1. La corre GitHub Actions en cada push;
// para correrla en tu máquina:  INTEGRACION=1 npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const activa = process.env.INTEGRACION === '1';
let servidor, base, token;

before(async () => {
  if (!activa) return;
  const { default: app } = await import('../src/app.js');
  servidor = app.listen(0);
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(async () => {
  if (!activa) return;
  servidor.close();
  const { default: pool } = await import('../src/config/db.js');
  await pool.end();
});

async function api(ruta, { metodo = 'GET', body } = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body)
  });
  const texto = await r.text();
  return { status: r.status, body: texto ? JSON.parse(texto) : null };
}

test('flujo completo: registro → dataset → cálculos → gráfica → análisis', { skip: !activa && 'define INTEGRACION=1' }, async () => {
  // Registro y login
  const correo = `prueba${Date.now()}@ejemplo.com`;
  let r = await api('/auth/registro', { metodo: 'POST', body: { correo, nombre: 'Prueba', clave: 'clave-segura' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await api('/auth/login', { metodo: 'POST', body: { correo, clave: 'mala-clave' } });
  assert.equal(r.status, 401);
  r = await api('/auth/login', { metodo: 'POST', body: { correo, clave: 'clave-segura' } });
  assert.equal(r.status, 200);
  token = r.body.token;

  // Catálogo cargado por el seed
  r = await api('/definiciones/media');
  assert.equal(r.status, 200, 'falta el seed: npm run seed');
  assert.ok(r.body.simbolos.length > 0);

  // Crear tabla (el ejemplo del contrato del hover + un dato inválido)
  r = await api('/datasets', {
    metodo: 'POST',
    body: { titulo: 'Edades', columnas: ['edad', 'ciudad'], filas: [[23, 'Lima'], [31, 'Quito'], [28, 'Lima'], ['N/A', 'Bogotá']] }
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const datasetId = r.body.id;

  r = await api(`/datasets/${datasetId}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.datos.columnas, ['edad', 'ciudad']);
  const [edad, ciudad] = r.body.columnas;
  assert.equal(edad.tipo_dato, 'numerico');
  assert.ok(edad.estadisticos_permitidos.includes('media'));
  assert.ok(!ciudad.estadisticos_permitidos.includes('media'));
  assert.ok(ciudad.estadisticos_permitidos.includes('moda'));

  // Cálculos guardados con el contrato del hover
  r = await api('/calculos', {
    metodo: 'POST',
    body: { dataset_id: datasetId, columna_id: edad.id, estadisticos: ['media', 'mediana', { clave: 'cuartil', parametro: 3 }] }
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const analisisId = r.body.analisis.id;
  const media = r.body.analisis.resultados.find(x => x.clave === 'media');
  assert.equal(media.sustitucion.resultado, 27.33);
  assert.deepEqual(media.datos_usados.filas, [0, 1, 2]);
  assert.equal(media.datos_usados.excluidos.length, 1);
  assert.equal(media.pasos[0].orden, 1);
  const cuartil = r.body.analisis.resultados.find(x => x.clave === 'cuartil');
  assert.equal(cuartil.parametro, 3);

  // Media de una columna nominal: se rechaza con el motivo del catálogo
  r = await api('/calculos', { metodo: 'POST', body: { dataset_id: datasetId, columna_id: ciudad.id, estadisticos: ['media'] } });
  assert.equal(r.status, 422);
  assert.equal(r.body.errores[0].clave, 'media');

  // Moda de texto
  r = await api('/calculos', { metodo: 'POST', body: { dataset_id: datasetId, columna_id: ciudad.id, estadisticos: ['moda'], analisis_id: analisisId } });
  assert.equal(r.status, 201);
  assert.equal(r.body.analisis.resultados.find(x => x.clave === 'moda').valor_txt, 'Lima');

  // Gráfica dentro del mismo análisis
  r = await api('/graficas', { metodo: 'POST', body: { dataset_id: datasetId, columna_id: ciudad.id, tipo: 'barras', analisis_id: analisisId } });
  assert.equal(r.status, 201, JSON.stringify(r.body));

  r = await api(`/analisis/${analisisId}`);
  assert.equal(r.body.resultados.length, 4);
  assert.equal(r.body.graficas.length, 1);
  assert.equal(r.body.graficas[0].config.tipo, 'barras');

  // Corregir la escala cambia lo que se permite
  r = await api(`/datasets/${datasetId}/columnas/${edad.id}`, { metodo: 'PATCH', body: { escala: 'ordinal', nombre: 'edad (años)' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await api(`/datasets/${datasetId}`);
  assert.ok(!r.body.columnas[0].estadisticos_permitidos.includes('media'));
  assert.equal(r.body.datos.columnas[0], 'edad (años)'); // datos_json sincronizado

  // Reemplazar datos borra los análisis viejos y conserva la escala corregida
  r = await api(`/datasets/${datasetId}`, { metodo: 'PUT', body: { columnas: ['edad (años)'], filas: [[1], [2], [3]] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await api(`/datasets/${datasetId}/analisis`);
  assert.deepEqual(r.body, []);
  r = await api(`/datasets/${datasetId}`);
  assert.equal(r.body.columnas[0].escala, 'ordinal');

  // Otro usuario no puede ver el dataset
  const tokenPropio = token;
  r = await api('/auth/registro', { metodo: 'POST', body: { correo: `otro${Date.now()}@ejemplo.com`, nombre: 'Otro', clave: 'clave-segura' } });
  token = r.body.token;
  r = await api(`/datasets/${datasetId}`);
  assert.equal(r.status, 404);
  token = tokenPropio;

  // Borrar
  r = await api(`/datasets/${datasetId}`, { metodo: 'DELETE' });
  assert.equal(r.status, 204);
  r = await api(`/datasets/${datasetId}`);
  assert.equal(r.status, 404);
});
