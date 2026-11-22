// Junta datos/temas.json + datos/partidos/*.json + datos/comparativas.json
// en web/datos.js, validando la estructura.
// Si datos/partidos/ está vacío, usa los datos de ejemplo de datos/_demo/.
//
// Uso: node scripts/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'datos');
const rel = (f) => path.relative(root, f);

const errores = [];
const avisos = [];

function leer(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.error(`✗ No se pudo leer ${rel(f)}: ${e.message}`);
    process.exit(1);
  }
}
const jsons = (d) =>
  fs.existsSync(d)
    ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(d, f))
    : [];

const temas = leer(path.join(dir, 'temas.json'));
let ficheros = jsons(path.join(dir, 'partidos'));
let demo = false;
let compFile = path.join(dir, 'comparativas.json');
if (!ficheros.length) {
  demo = true;
  ficheros = jsons(path.join(dir, '_demo', 'partidos'));
  compFile = path.join(dir, '_demo', 'comparativas.json');
}
const partidos = ficheros.map(leer).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
const comparativas = fs.existsSync(compFile) ? leer(compFile) : {};

// --- Validación ---
const T = Object.fromEntries(temas.map((t) => [t.id, t]));
const CONCRECION = ['alta', 'media', 'baja'];
const TIPOS = ['nueva', 'ampliacion', 'reforma', 'recorte', 'derogacion'];
const POSTURAS = ['si', 'no', 'matiz', 'sin'];
const idsPartido = new Set();
const idsProp = new Set();

for (const p of partidos) {
  const where = `partido ${p.id ?? '(sin id)'}`;
  for (const k of ['id', 'nombre', 'siglas', 'color', 'propuestas']) if (!(k in p)) errores.push(`${where}: falta "${k}"`);
  if (idsPartido.has(p.id)) errores.push(`${where}: id duplicado`);
  idsPartido.add(p.id);
  for (const x of p.propuestas ?? []) {
    const w = `${where} › ${x.id ?? '(propuesta sin id)'}`;
    for (const k of ['id', 'tema', 'titulo', 'resumen']) if (!x[k]) errores.push(`${w}: falta "${k}"`);
    if (idsProp.has(x.id)) errores.push(`${w}: id de propuesta duplicado`);
    idsProp.add(x.id);
    if (x.tema && !T[x.tema]) errores.push(`${w}: tema "${x.tema}" no existe en temas.json`);
    else if (x.subtema && !T[x.tema].subtemas?.some((s) => s.id === x.subtema))
      avisos.push(`${w}: subtema "${x.subtema}" no existe en el tema "${x.tema}"`);
    if (x.concrecion && !CONCRECION.includes(x.concrecion)) errores.push(`${w}: concrecion "${x.concrecion}" no válida`);
    if (x.tipo && !TIPOS.includes(x.tipo)) avisos.push(`${w}: tipo "${x.tipo}" no reconocido`);
    if (!x.cita) avisos.push(`${w}: sin cita literal`);
    if (!x.implicaciones && !x.breve) avisos.push(`${w}: sin implicaciones`);
  }
}
for (const [tema, c] of Object.entries(comparativas)) {
  if (!T[tema]) errores.push(`comparativas: tema "${tema}" no existe`);
  for (const e of c.ejes ?? [])
    for (const [pid, pos] of Object.entries(e.posiciones ?? {})) {
      if (!idsPartido.has(pid)) avisos.push(`comparativas › ${tema}: partido "${pid}" desconocido`);
      if (pos.postura && !POSTURAS.includes(pos.postura)) errores.push(`comparativas › ${tema}: postura "${pos.postura}" no válida`);
    }
}

if (avisos.length) {
  console.warn(`⚠ ${avisos.length} aviso(s):`);
  avisos.slice(0, 30).forEach((a) => console.warn('  - ' + a));
  if (avisos.length > 30) console.warn(`  … y ${avisos.length - 30} más`);
}
if (errores.length) {
  console.error(`✗ ${errores.length} error(es):`);
  errores.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

const salida = { generado: new Date().toISOString(), demo, temas, partidos, comparativas };
fs.writeFileSync(
  path.join(root, 'web', 'datos.js'),
  `// Generado por scripts/build.mjs — no editar a mano\nwindow.DATOS = ${JSON.stringify(salida)};\n`
);

console.log(`✓ web/datos.js generado${demo ? ' (DATOS DE DEMOSTRACIÓN)' : ''}`);
for (const p of partidos) console.log(`  ${p.siglas.padEnd(10)} ${String(p.propuestas.length).padStart(4)} propuestas`);
console.log(`  ${Object.keys(comparativas).length} temas con comparativa`);
