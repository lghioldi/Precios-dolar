'use strict';

/* ========================= CONFIGURACIÓN ========================= */
const CONFIG = {
  dataUrl: 'data.json',      // lo genera GitHub Actions
  intervalMs: 1800000,       // 30 minutos
};
/* ================================================================= */

const STORAGE_KEY = 'dolar.ultimos';
const $ = (sel) => document.querySelector(sel);

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const fmtPrice = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatStamp = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'Sin fecha' : fmtDate.format(d); };

const svg = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  oficial: svg('<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>'),
  blue: svg('<rect x="3" y="7" width="18" height="10" rx="1.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 10v4M17.5 10v4"/>'),
  bolsa: svg('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-4 3 3 5-6"/>'),
  tarjeta: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>'),
};
const TRENDS = {
  up:   { symbol: '▲', label: 'Subió' },
  down: { symbol: '▼', label: 'Bajó' },
  flat: { symbol: '●', label: 'Sin cambios' },
};
const ASSETS = [
  { id: 'oficial', name: 'Dólar oficial',    unit: 'Pesos por dólar · venta' },
  { id: 'blue',    name: 'Dólar blue',       unit: 'Pesos por dólar · venta' },
  { id: 'bolsa',   name: 'Dólar MEP (bolsa)', unit: 'Pesos por dólar · venta' },
  { id: 'tarjeta', name: 'Dólar tarjeta',    unit: 'Pesos por dólar · venta' },
];

let shown = load();       // últimos valores recibidos (también quedan en localStorage)
let busy = false;

function buildCards() {
  $('#grid').innerHTML = ASSETS.map((a) => `
    <article class="card" id="card-${a.id}" data-trend="flat">
      <div class="card-head">
        <span class="icon">${ICONS[a.id]}</span>
        <h2>${a.name}</h2>
        <span class="trend" role="img" aria-label="Sin cambios">●</span>
      </div>
      <p class="price"><span class="cur">$</span><span class="val">--</span></p>
      <p class="unit">${a.unit}</p>
      <p class="note"></p>
      <p class="stamp">Sin datos todavía</p>
    </article>`).join('');
}

function renderCard(id, { animate = false, error = '' } = {}) {
  const card = $(`#card-${id}`);
  const data = shown[id];
  const trend = TRENDS[data?.trend] ? data.trend : 'flat';

  card.dataset.trend = trend;
  const t = card.querySelector('.trend');
  t.textContent = TRENDS[trend].symbol;
  t.setAttribute('aria-label', TRENDS[trend].label);

  if (data?.label) card.querySelector('h2').textContent = data.label;
  card.querySelector('.val').textContent = data ? fmtPrice.format(data.price) : '--';
  card.querySelector('.stamp').textContent = data ? `Actualizado: ${formatStamp(data.at)}` : 'Sin datos todavía';

  const note = card.querySelector('.note');
  note.classList.toggle('err', Boolean(error));
  note.textContent = error || data?.note || '';

  if (animate) {
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
  }
}

function setLoading(on) {
  document.body.classList.toggle('loading', on);
  $('#refreshBtn').disabled = on;
  $('#refreshLabel').textContent = on ? 'Actualizando…' : 'Actualizar ahora';
}

function showAlert(msg) {
  const box = $('#alert');
  box.hidden = !msg;
  box.textContent = msg;
}

async function refresh() {
  if (busy) return;
  busy = true;
  setLoading(true);
  showAlert('');

  try {
    const res = await fetch(`${CONFIG.dataUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = json.items ?? {};

    for (const a of ASSETS) {
      if (items[a.id]) { shown[a.id] = items[a.id]; renderCard(a.id, { animate: true }); }
      else renderCard(a.id, { error: shown[a.id] ? 'Sin dato nuevo. Se muestra el último valor guardado.' : 'Todavía no hay datos para esta cotización.' });
    }
    save(shown);
    if (json.errors?.length) showAlert('Alguna fuente no respondió en la última actualización. Se muestran los últimos valores disponibles.');
  } catch {
    ASSETS.forEach((a) => renderCard(a.id, { error: shown[a.id] ? 'No se pudo actualizar. Se muestra el último valor guardado.' : 'No se pudo cargar el dato.' }));
    showAlert('No se pudieron cargar las cotizaciones. Revisá tu conexión y probá de nuevo.');
  } finally {
    setLoading(false);
    busy = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  buildCards();
  ASSETS.forEach((a) => renderCard(a.id));
  $('#refreshBtn').addEventListener('click', refresh);
  refresh();
  setInterval(refresh, CONFIG.intervalMs);
});
