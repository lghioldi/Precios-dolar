// Consulta MonedAPI y guarda las cotizaciones del dólar en site/data.json.
// Lo ejecuta GitHub Actions cada 30 minutos (ver .github/workflows/update.yml).
// No necesita API Key: las cotizaciones de MonedAPI son públicas.
//
// Colores de las tarjetas: la propia API informa la variación diaria ("change"),
// que compara el valor de venta actual con el último de ayer.

import { readFile, writeFile } from 'node:fs/promises';

/* ========================= CONFIGURACIÓN ========================= */
const CONFIG = {
  url: 'https://monedapi.ar/api/v2/usd',
  file: 'site/data.json',
  // origen en la API -> id interno y nombre en pantalla
  origins: {
    OFICIAL: { id: 'oficial', label: 'Dólar oficial' },
    BLUE:    { id: 'blue',    label: 'Dólar blue' },
    BOLSA:   { id: 'bolsa',   label: 'Dólar MEP (bolsa)' },
    TARJETA: { id: 'tarjeta', label: 'Dólar tarjeta' },
  },
};
/* ================================================================= */

const num = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const withSign = (v) => `${v > 0 ? '+' : ''}${num.format(v)}%`;

async function fetchDollar() {
  const res = await fetch(CONFIG.url, {
    headers: { Accept: 'application/json', 'User-Agent': 'tablero-dolar (GitHub Actions)' },
  });
  if (!res.ok) throw new Error(`MonedAPI respondió HTTP ${res.status}`);
  let list;
  try { list = await res.json(); } catch { throw new Error('MonedAPI no devolvió JSON'); }
  if (!Array.isArray(list)) throw new Error('MonedAPI devolvió un formato inesperado');

  return Object.entries(CONFIG.origins).flatMap(([origin, { id, label }]) => {
    const q = list.find((x) => String(x.origin).toUpperCase() === origin);
    if (!q || typeof q.sell !== 'number') return [];

    // change = null significa "no hay contra qué comparar" (no es lo mismo que 0)
    const change = q.change ?? null;
    const trend = !change || change.amount === 0 ? 'flat' : change.amount > 0 ? 'up' : 'down';
    const compra = typeof q.buy === 'number' ? `Compra $ ${num.format(q.buy)}` : '';
    const variacion = change ? `${withSign(change.percent)} vs. ayer` : 'Sin dato de ayer';

    return [{
      id, label, price: q.sell, trend,
      at: q.lastScrapedAt ?? new Date().toISOString(),
      note: [compra, variacion].filter(Boolean).join(' · '),
    }];
  });
}

async function main() {
  let old = { items: {} };
  try { old = JSON.parse(await readFile(CONFIG.file, 'utf8')); } catch { /* primera vez */ }

  let results;
  try {
    results = await fetchDollar();
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
    return;
  }
  if (!results.length) {
    console.error('MonedAPI no trajo ninguna de las cotizaciones pedidas.');
    process.exitCode = 1;
    return;
  }

  const items = { ...old.items };
  for (const { id, label, price, at, trend, note } of results) items[id] = { label, price, at, trend, note };

  await writeFile(CONFIG.file, JSON.stringify({ updatedAt: new Date().toISOString(), items, errors: [] }, null, 2) + '\n');
  console.log('Datos guardados en', CONFIG.file);
}

main();
