/* ==========================================================================
   SEO-Фабрика — ядро фронтенда

   Содержит три вещи:
     1. API-клиент  — все эндпоинты бэкенда + карта будущих
     2. UI-кит     — тосты, диалоги, панель, палитра, иконки
     3. Форматтеры — даты, числа, статусы, баллы

   Ниодного alert() и confirm() в интерфейсе больше нет.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   1. АДРЕС БЭКЕНДА
   -------------------------------------------------------------------------- */

const API_BASE = (() => {
  const stored = localStorage.getItem('seo_api_base');
  if (stored) return stored.replace(/\/+$/, '');
  const h = location.hostname;
  if (!h || h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000/api';
  if (h.endsWith('waifubot.website')) return 'https://seo.waifubot.website/api';
  return `${location.protocol}//${h}/api`;
})();

function saveApiBase(url) {
  localStorage.setItem('seo_api_base', String(url || '').replace(/\/+$/, ''));
}

/* Состояние связи — показывается в подвале левой колонки. */
const wire = {
  ok: null,
  lastError: '',
  listeners: [],
  onChange(fn) { this.listeners.push(fn); fn(this); },
  set(ok, err) {
    if (this.ok === ok && this.lastError === (err || '')) return;
    this.ok = ok; this.lastError = err || '';
    this.listeners.forEach(fn => { try { fn(this); } catch (e) {} });
  },
};

async function req(path, opts = {}) {
  const url = API_BASE.replace(/\/+$/, '') + path;
  let response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(opts.headers || {}),
      },
      ...opts,
    });
  } catch (e) {
    wire.set(false, 'сеть');
    throw new Error(
      `Нет связи с бэкендом (${url}). Проверьте, что сервер запущен, ` +
      `адрес в настройках верный и SSL-сертификат валиден.`
    );
  }

  if (response.status === 204) { wire.set(true); return null; }

  const text = await response.text();

  if (!response.ok) {
    let msg = text;
    let detail = null;
    try { detail = JSON.parse(text)?.detail ?? null; } catch (e) {}
    if (detail && typeof detail === 'object') msg = detail.message || JSON.stringify(detail);
    else if (detail) msg = detail;

    if (response.status === 404 || response.status === 405) {
      const err = new Error(
        `${msg || 'Not Found'} — эндпоинт недоступен: ${url}. ` +
        `Вероятно, на сервере старая версия бэкенда.`
      );
      err.missingEndpoint = true;
      err.status = response.status;
      wire.set(true);
      throw err;
    }
    const err = new Error(`HTTP ${response.status}: ${msg}`);
    err.status = response.status;
    wire.set(true);
    throw err;
  }

  wire.set(true);
  try { return JSON.parse(text); } catch (e) { return text; }
}

/* --------------------------------------------------------------------------
   2. API

   Блоки 1, 2, 5.2, 6, 7, 8 из плана ещё не реализованы на сервере.
   Их методы объявлены здесь заранее и помечены в API_SOON.
   Интерфейс уже построен под них — когда эндпоинт появится,
   достаточно убрать его имя из API_SOON.
   -------------------------------------------------------------------------- */

const API_SOON = new Set([
  'listLibraries', 'buildFrame',                   // Блок 2 — каркас из библиотеки
  'buildWiring', 'getWiring',                      // Блок 6 — обвязка
  'listWaves', 'createWave', 'publishWave',        // Блок 7 — волны
]);

const api = {
  /* ---- Проекты ---- */
  listProjects:   ()         => req('/projects'),
  getProject:     (id)       => req(`/projects/${id}`),
  createProject:  (d)        => req('/projects', { method: 'POST', body: JSON.stringify(d) }),
  updateProject:  (id, d)    => req(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteProject:  (id)       => req(`/projects/${id}`, { method: 'DELETE' }),

  /* ---- Каркас (шаблон) ---- */
  saveTemplate:    (id, d)   => req(`/projects/${id}/templates`, { method: 'POST', body: JSON.stringify(d) }),
  approveTemplate: (id, tid) => req(`/projects/${id}/templates/${tid}/approve`, { method: 'POST' }),
  previewTemplate: (id, tid) => req(`/projects/${id}/templates/${tid}/preview`, { method: 'POST' }),

  /* ---- Ключи ---- */
  listKeys:  (id)        => req(`/projects/${id}/keys`),
  addKeys:   (id, d)     => req(`/projects/${id}/keys`, { method: 'POST', body: JSON.stringify(d) }),
  deleteKey: (id, keyId) => req(`/projects/${id}/keys/${keyId}`, { method: 'DELETE' }),

  /* ---- Генерация ---- */
  startGeneration:     (id, p)  => req(`/projects/${id}/generate?parallel=${p || 1}`, { method: 'POST' }),
  stopGeneration:      (id)     => req(`/projects/${id}/stop`, { method: 'POST' }),
  recomputeUniqueness: (id)     => req(`/projects/${id}/recompute-uniqueness`, { method: 'POST' }),
  listTasks:           (id)     => req(`/projects/${id}/tasks`),
  retryTasks:  (id, ids, p) => req(`/projects/${id}/tasks/retry?parallel=${p || 3}`, {
                                  method: 'POST', body: JSON.stringify({ ids: ids || [] }) }),
  taskAttempts: (id, tid)   => req(`/projects/${id}/tasks/${tid}/attempts`),

  /* ---- Страницы ---- */
  listPages:      (id)      => req(`/projects/${id}/pages`),
  getPage:        (id, pid) => req(`/projects/${id}/pages/${pid}`),
  deletePage:     (id, pid) => req(`/projects/${id}/pages/${pid}`, { method: 'DELETE' }),
  deletePages:    (id, ids) => req(`/projects/${id}/pages/delete`, { method: 'POST', body: JSON.stringify({ ids }) }),
  regeneratePage: (pid)     => req(`/pages/${pid}/regenerate`, { method: 'POST' }),
  exportUrl:      (id, only) => `${API_BASE.replace(/\/+$/, '')}/projects/${id}/export` + (only ? `?only=${encodeURIComponent(only)}` : ''),

  /* ---- Чат ---- */
  chatHistory:      (id)      => req(`/chat/${id}/history`),
  chatSend:         (id, m)   => req(`/chat/${id}`, { method: 'POST', body: JSON.stringify({ message: m }) }),
  chatExtractFrame: (id)      => req(`/chat/${id}/frame`, { method: 'POST' }),
  chatMessage:      (id, mid) => req(`/chat/${id}/message/${mid}`),

  /* ---- Настройки ---- */
  getSettings:    ()   => req('/settings'),
  updateSettings: (s)  => req('/settings', { method: 'PUT', body: JSON.stringify({ settings: s }) }),
  getProviders:   ()   => req('/settings/providers'),
  getModels:      ()   => req('/settings/models'),
  testCustomApi:  (b, k) => req('/settings/test-custom-api', {
                             method: 'POST', body: JSON.stringify({ base_url: b, api_key: k }) }),
  listCustomEndpoints:  ()   => req('/settings/custom-endpoints'),
  addCustomEndpoint:    (d)  => req('/settings/custom-endpoints', { method: 'POST', body: JSON.stringify(d) }),
  deleteCustomEndpoint: (id) => req(`/settings/custom-endpoints/${id}`, { method: 'DELETE' }),
  testCustomEndpoint:   (id) => req(`/settings/custom-endpoints/${id}/test`, { method: 'POST' }),

  /* ---- БЛОК 1 — Паспорт проекта (готово) ---- */
  analyzeData:  (id)     => req(`/projects/${id}/analyze`, { method: 'POST' }),
  getPassport:  (id)     => req(`/projects/${id}/passport`),
  savePassport: (id, d)  => req(`/projects/${id}/passport`, { method: 'PUT', body: JSON.stringify(d) }),

  /* ---- ВХОД — таблица данных (upload/preview — готовы) ---- */
  uploadTable:  (id, fd) => req(`/projects/${id}/table`, { method: 'POST', body: fd, headers: {} }),
  previewTable: (id)     => req(`/projects/${id}/table/preview`),
  linkSheet:    (id, d)  => req(`/projects/${id}/table/sheet`, { method: 'POST', body: JSON.stringify(d) }),

  /* ---- БЛОК 2 — Библиотеки и проектировщик (ещё нет) ---- */
  listLibraries: ()      => req('/libraries'),
  buildFrame:    (id, d) => req(`/projects/${id}/build-frame`, { method: 'POST', body: JSON.stringify(d) }),

  /* ---- БЛОК 5 — Настройка гейта (ещё нет) ---- */
  getGateConfig:  (id)    => req(`/projects/${id}/gate`),
  saveGateConfig: (id, d) => req(`/projects/${id}/gate`, { method: 'PUT', body: JSON.stringify(d) }),

  /* ---- БЛОК 6 — Обвязка (ещё нет) ---- */
  buildWiring: (id, d) => req(`/projects/${id}/wiring`, { method: 'POST', body: JSON.stringify(d) }),
  getWiring:   (id)    => req(`/projects/${id}/wiring`),

  /* ---- БЛОК 7 — Волны (ещё нет) ---- */
  listWaves:   (id)     => req(`/projects/${id}/waves`),
  createWave:  (id, d)  => req(`/projects/${id}/waves`, { method: 'POST', body: JSON.stringify(d) }),
  publishWave: (id, w)  => req(`/projects/${id}/waves/${w}/publish`, { method: 'POST' }),

  /* ---- БЛОК 8 — Search Console (готово) ---- */
  getGsc:   (id)       => req(`/projects/${id}/gsc`),
  saveGsc:  (id, d)    => req(`/projects/${id}/gsc`, { method: 'PUT', body: JSON.stringify(d) }),
  syncGsc:  (id, days) => req(`/projects/${id}/gsc/sync?days=${encodeURIComponent(days || 28)}`, { method: 'POST' }),
  testGsc:  (key)      => req('/settings/gsc-test', { method: 'POST', body: JSON.stringify({ key: key || '' }) }),

  /* ---- ДИЗАЙН-ОСНОВА — темы и макеты (готово) ---- */
  listThemes:   ()      => req('/themes'),
  getDesign:    (id)    => req(`/projects/${id}/design`),
  saveDesign:   (id, d) => req(`/projects/${id}/design`, { method: 'PUT', body: JSON.stringify(d) }),
  repaintDesign:(id)    => req(`/projects/${id}/design/apply`, { method: 'POST' }),
};

/** Готов ли этот метод на бэкенде. */
function apiReady(name) { return !API_SOON.has(name); }

/* --------------------------------------------------------------------------
   3. ИКОНКИ  (один штриховой набор, 1.6px, 24×24)
   -------------------------------------------------------------------------- */

const ICONS = {
  table:    'M3 9h18M9 9v12M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z',
  compass:  'M12 22a10 10 0 100-20 10 10 0 000 20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1z',
  layout:   'M4 4h16v16H4zM4 10h16M10 10v10',
  spark:    'M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1L7 17M17 7l2.1-2.1M12 9a3 3 0 100 6 3 3 0 000-6z',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  pages:    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',
  link:     'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.8 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.8-1.7',
  waves:    'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
  radar:    'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  sliders:  'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  search:   'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  plus:     'M12 5v14M5 12h14',
  x:        'M18 6L6 18M6 6l12 12',
  check:    'M20 6L9 17l-5-5',
  chevron:  'M9 18l6-6-6-6',
  caret:    'M6 9l6 6 6-6',
  play:     'M6 4l14 8-14 8V4z',
  stop:     'M6 6h12v12H6z',
  redo:     'M1 4v6h6M23 20v-6h-6M20.5 9A9 9 0 006 5.3L1 10M3.5 15A9 9 0 0018 18.7L23 14',
  eye:      'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
  trash:    'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6',
  gear:     'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  home:     'M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z',
  alert:    'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  info:     'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
  ok:       'M12 22a10 10 0 100-20 10 10 0 000 20zM8 12l3 3 5-6',
  bad:      'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6',
  lock:     'M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1zM8 11V7a4 4 0 018 0v4',
  upload:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  sheet:    'M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zM3 9h18M3 15h18M9 3v18M15 3v18',
  code:     'M16 18l6-6-6-6M8 6l-6 6 6 6',
  keyboard: 'M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2zM6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M9 12h6M8 16h8',
  moon:     'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  sun:      'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  filter:   'M22 3H2l8 9.5V19l4 2v-8.5L22 3z',
  copy:     'M9 9h10a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V11a2 2 0 012-2zM5 15H4a2 2 0 01-2-2V3a2 2 0 012-2h10a2 2 0 012 2v1',
  file:     'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7',
  bolt:     'M13 2L3 14h8l-1 8 10-12h-8l1-8z',
  key:      'M21 2l-2 2m-7.6 7.6a5 5 0 11-7.1 7.1 5 5 0 017.1-7.1zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3',
  target:   'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  clock:    'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  list:     'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  refresh:  'M23 4v6h-6M1 20v-6h6M20.5 9A9 9 0 005.6 5.6L1 10m22 4l-4.6 4.4A9 9 0 013.5 15',
};

/**
 * SVG-иконка из набора.
 * @param {string} name имя из ICONS
 * @param {number} size размер в px
 * @param {string} cls  доп. классы
 */
function ico(name, size = 16, cls = '') {
  const d = ICONS[name];
  if (!d) return '';
  const paths = d.split(/\s{2,}|(?<=\d)\s(?=M)/).filter(Boolean);
  const body = paths.map(p => `<path d="${p.trim()}"/>`).join('');
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
         `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ` +
         `aria-hidden="true">${body}</svg>`;
}

/* --------------------------------------------------------------------------
   4. ФОРМАТТЕРЫ
   -------------------------------------------------------------------------- */

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escAttr(s) { return escHtml(s).replace(/\n/g, ' '); }

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) +
         ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** «3 мин назад», «2 дн назад» */
function relTime(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 45) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  if (s < 2592000) return `${Math.floor(s / 86400)} дн назад`;
  return fmtDate(iso);
}

function fmtNum(n) {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  return v.toLocaleString('ru-RU');
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  if (v === 0) return '$0';
  if (v < 0.01) return '$' + v.toFixed(5);
  return '$' + v.toFixed(3);
}

/** Правильное окончание: plural(5,'страница','страницы','страниц') */
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* --------------------------------------------------------------------------
   5. СТАТУСЫ
   -------------------------------------------------------------------------- */

const STATUS = {
  draft:      { label: 'Черновик',      tone: 'neutral' },
  active:     { label: 'Активен',       tone: 'info' },
  generating: { label: 'Генерируется', tone: 'live' },
  done:       { label: 'Готов',         tone: 'ok' },
  error:      { label: 'Ошибка',        tone: 'bad' },
  cancelled:  { label: 'Отменён',      tone: 'neutral' },
  pending:    { label: 'В очереди',    tone: 'neutral' },
  queued:     { label: 'Взят в задачу', tone: 'info' },
  running:    { label: 'Выполняется',  tone: 'live' },
  success:    { label: 'Успешно',      tone: 'ok' },
  failed:     { label: 'Ошибка',        tone: 'bad' },
  ready:      { label: 'Готова',        tone: 'ok' },
  approved:   { label: 'Утверждён',    tone: 'ok' },
};

function statusLabel(s) { return (STATUS[s] || {}).label || s || '—'; }
function statusTone(s)  { return (STATUS[s] || {}).tone  || 'neutral'; }

function pill(status) {
  const t = statusTone(status);
  return `<span class="pill ${t}"><i class="dot"></i>${escHtml(statusLabel(status))}</span>`;
}

/** Паспорт модели: кого просили и кто реально ответил. */
function modelTag(o) {
  if (!o) return '';
  const asked = o.model || '', got = o.model_returned || '';
  const prov = o.provider ? escHtml(o.provider) + '/' : '';
  if (!asked && !got) return `<span class="model-tag">модель не записана</span>`;
  if (got && asked && got !== asked) {
    return `<span class="model-tag warn" title="Провайдер ответил другой моделью">` +
           `${ico('alert', 11)} ${escHtml(asked)} → ${escHtml(got)}</span>`;
  }
  if (got) return `<span class="model-tag ok" title="Подтверждено ответом API">${ico('check', 11)} ${prov}${escHtml(got)}</span>`;
  return `<span class="model-tag" title="Провайдер не вернул имя модели">${prov}${escHtml(asked)}</span>`;
}

/** Балл → буква и тон. Пороги совпадают с гейтом бэкенда. */
function grade(score) {
  const s = Number(score);
  if (!isFinite(s)) return { g: '—', cls: 'g-none' };
  if (s >= 88) return { g: 'A', cls: 'g-a' };
  if (s >= 78) return { g: 'B', cls: 'g-b' };
  if (s >= 68) return { g: 'C', cls: 'g-c' };
  if (s >= 55) return { g: 'D', cls: 'g-d' };
  return { g: 'F', cls: 'g-f' };
}

/** Русские названия проверок гейта + к какому уровню относятся. */
const CHECK_INFO = {
  html_integrity:         ['Целостность HTML', '5.1'],
  placeholders_left:      ['Оставшиеся заглушки', '5.1'],
  single_h1:              ['Ровно один H1', '5.1'],
  has_title:              ['Есть title', '5.1'],
  has_description:        ['Есть description', '5.1'],
  title_length:           ['Длина title', '5.1'],
  description_length:     ['Длина description', '5.1'],
  heading_order:          ['Порядок заголовков', '5.1'],
  facts:                  ['Факты из строки', '5.2'],
  facts_coverage:         ['Покрытие данных', '5.2'],
  facts_invented:         ['Выдуманные цифры', '5.2'],
  uniqueness:             ['Уникальность по словам', '5.3'],
  self_repetition:        ['Самоповторы', '5.3'],
  intra_page_similarity:  ['Повторы блоков внутри', '5.3'],
  volume:                 ['Объём текста', '5.4'],
  stop_phrases:           ['Стоп-слова (справка)', '5.4'],
  h2_body:                ['Текст под H2', '5.4'],
  h2_count:               ['Число H2', '5.4'],
  h2_has_text:            ['Текст под каждым H2', '5.4'],
  structure:              ['Структура', '5.4'],
  meta_title:             ['Длина title', '5.1'],
  meta_description:       ['Длина description', '5.1'],
  h1_single:              ['Ровно один H1', '5.1'],
  html_complete:          ['HTML не оборван', '5.1'],
  empty_holes:            ['Заглушки и пустые блоки', '5.1'],
  slug_collision:         ['Совпадение slug', '5.1'],
  schema:                 ['JSON по каркасу', '5.1'],
  right_entity:           ['Страница про свой ключ', '5.3'],
};

function checkTitle(name) { return (CHECK_INFO[name] || [name])[0]; }
function checkLevel(name) { return (CHECK_INFO[name] || [null, '5.4'])[1]; }

/* --------------------------------------------------------------------------
   6. ТЕМА
   -------------------------------------------------------------------------- */

const THEMES = {
  light: { name: 'Светлая', desc: 'Белый холст, спокойные серые, синий акцент',
           swatches: ['#ffffff', '#f9f8f7', '#e6e5e3', '#2c2c2b', '#2783de'] },
  dark:  { name: 'Тёмная',  desc: 'Глубокий графит, мягкие границы, тот же акцент',
           swatches: ['#191919', '#202020', '#333331', '#ffffff', '#5e9fe8'] },
};

function getTheme() {
  try {
    const t = localStorage.getItem('seo_theme');
    if (t === 'light' || t === 'dark') return t;
  } catch (e) {}
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(name) {
  const t = THEMES[name] ? name : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('seo_theme', t); } catch (e) {}
  return t;
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  toast.info(next === 'dark' ? 'Тёмная тема' : 'Светлая тема');
  document.querySelectorAll('[data-theme-ico]').forEach(el => {
    el.innerHTML = ico(next === 'dark' ? 'sun' : 'moon', 16);
  });
  return next;
}

/* --------------------------------------------------------------------------
   7. ТОСТЫ
   -------------------------------------------------------------------------- */

const toast = (() => {
  let host = null;

  function mount() {
    if (host) return host;
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    return host;
  }

  function show(kind, title, text, ms) {
    const h = mount();
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    const icoName = kind === 'ok' ? 'ok' : kind === 'bad' ? 'bad' : kind === 'warn' ? 'alert' : 'info';
    el.innerHTML =
      `<span class="toast-ico">${ico(icoName, 17)}</span>` +
      `<div class="toast-body"><div class="toast-title">${escHtml(title)}</div>` +
      (text ? `<div class="toast-text">${escHtml(text)}</div>` : '') + `</div>` +
      `<button class="toast-x" aria-label="Закрыть">${ico('x', 14)}</button>`;
    h.appendChild(el);

    const kill = () => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 220);
    };
    el.querySelector('.toast-x').onclick = kill;
    const life = ms == null ? (kind === 'bad' ? 9000 : 4200) : ms;
    if (life > 0) setTimeout(kill, life);
    return kill;
  }

  return {
    ok:   (t, s, ms) => show('ok',   t, s, ms),
    bad:  (t, s, ms) => show('bad',  t, s, ms),
    warn: (t, s, ms) => show('warn', t, s, ms),
    info: (t, s, ms) => show('info', t, s, ms),
    /** Ошибка от API — с разбором причины. */
    err(prefix, e) {
      const m = (e && e.message) ? e.message : String(e);
      if (e && e.missingEndpoint) return show('warn', prefix, 'Этот эндпоинт ещё не реализован на бэкенде.');
      return show('bad', prefix, m);
    },
    /** Заглушка: функция запланирована, но не сделана. */
    soon(what, why) {
      return show('info', what + ' — в работе', why || 'Интерфейс готов, осталось подключить бэкенд.', 5200);
    },
  };
})();

/* --------------------------------------------------------------------------
   8. ДИАЛОГ ПОДТВЕРЖДЕНИЯ  (замена confirm)
   -------------------------------------------------------------------------- */

function confirmDialog(opts) {
  const o = Object.assign({
    title: 'Подтвердите действие',
    text: '',
    confirm: 'Продолжить',
    cancel: 'Отмена',
    danger: false,
    icon: null,
  }, opts || {});

  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      `<div class="scrim"></div>` +
      `<div class="modal" role="dialog" aria-modal="true">` +
        `<div class="modal-head">` +
          `<div class="modal-ico ${o.danger ? 'bad' : 'info'}">` +
            ico(o.icon || (o.danger ? 'alert' : 'info'), 19) + `</div>` +
          `<div class="modal-title">${escHtml(o.title)}</div>` +
          (o.text ? `<div class="modal-text">${o.html ? o.text : escHtml(o.text)}</div>` : '') +
        `</div>` +
        `<div class="modal-foot">` +
          `<button class="btn" data-no>${escHtml(o.cancel)}</button>` +
          `<button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-yes>${escHtml(o.confirm)}</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(wrap);

    const done = v => {
      document.removeEventListener('keydown', onKey);
      wrap.remove();
      resolve(v);
    };
    const onKey = e => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter') done(true);
    };

    wrap.querySelector('[data-yes]').onclick = () => done(true);
    wrap.querySelector('[data-no]').onclick  = () => done(false);
    wrap.querySelector('.scrim').onclick     = () => done(false);
    document.addEventListener('keydown', onKey);
    setTimeout(() => wrap.querySelector('[data-yes]').focus(), 40);
  });
}

/* --------------------------------------------------------------------------
   9. ПРАВАЯ ПАНЕЛЬ  (замена модалок для деталей)
   -------------------------------------------------------------------------- */

const drawer = (() => {
  let scrim = null, box = null, onClose = null;

  function ensure() {
    if (box) return;
    scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.hidden = true;
    scrim.onclick = () => close();

    box = document.createElement('aside');
    box.className = 'drawer';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    document.body.append(scrim, box);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !box.hidden) close();
    });
  }

  /**
   * @param {{eyebrow?:string,title:string,tools?:string,tabs?:Array,body:string,foot?:string,wide?:boolean}} o
   */
  function open(o) {
    ensure();
    box.classList.toggle('is-wide', !!o.wide);
    box.innerHTML =
      `<div class="drawer-head">` +
        `<div class="drawer-head-body">` +
          (o.eyebrow ? `<div class="drawer-eyebrow">${escHtml(o.eyebrow)}</div>` : '') +
          `<div class="drawer-title">${escHtml(o.title)}</div>` +
        `</div>` +
        (o.tools || '') +
        `<button class="icon-btn" data-dclose aria-label="Закрыть">${ico('x', 17)}</button>` +
      `</div>` +
      (o.tabsHtml || '') +
      `<div class="drawer-body ${o.flush ? 'flush' : ''}" data-dbody>${o.body || ''}</div>` +
      (o.foot ? `<div class="drawer-foot">${o.foot}</div>` : '');

    box.querySelector('[data-dclose]').onclick = () => close();
    scrim.hidden = false;
    box.hidden = false;
    onClose = o.onClose || null;
    document.body.style.overflow = 'hidden';
    return box;
  }

  function setBody(html) {
    if (!box) return;
    const b = box.querySelector('[data-dbody]');
    if (b) b.innerHTML = html;
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    scrim.hidden = true;
    document.body.style.overflow = '';
    if (onClose) { const f = onClose; onClose = null; f(); }
  }

  return { open, close, setBody, el: () => box, isOpen: () => box && !box.hidden };
})();

/* --------------------------------------------------------------------------
   10. КОМАНДНАЯ ПАЛИТРА  (Cmd/Ctrl + K)
   -------------------------------------------------------------------------- */

const cmdk = (() => {
  let wrap = null, input = null, list = null;
  let items = [], filtered = [], cur = 0;

  function ensure() {
    if (wrap) return;
    wrap = document.createElement('div');
    wrap.className = 'cmdk-wrap';
    wrap.hidden = true;
    wrap.innerHTML =
      `<div class="cmdk" role="dialog" aria-modal="true" aria-label="Команды">` +
        `<div class="cmdk-input-row">${ico('search', 17)}` +
          `<input type="text" placeholder="Куда перейти или что сделать…" autocomplete="off" spellcheck="false">` +
          `<kbd>Esc</kbd></div>` +
        `<div class="cmdk-list"></div>` +
      `</div>`;
    document.body.appendChild(wrap);
    input = wrap.querySelector('input');
    list  = wrap.querySelector('.cmdk-list');

    wrap.onclick = e => { if (e.target === wrap) close(); };
    input.oninput = () => { cur = 0; render(); };
    input.onkeydown = e => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(cur + 1, filtered.length - 1); render(true); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); cur = Math.max(cur - 1, 0); render(true); }
      if (e.key === 'Enter')     { e.preventDefault(); run(filtered[cur]); }
    };

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); }
    });
  }

  function register(list_) { items = list_ || []; }

  function render(keepQuery) {
    const q = input.value.trim().toLowerCase();
    filtered = q
      ? items.filter(i => (i.label + ' ' + (i.group || '') + ' ' + (i.keywords || '')).toLowerCase().includes(q))
      : items.slice();
    if (cur >= filtered.length) cur = Math.max(0, filtered.length - 1);

    if (!filtered.length) {
      list.innerHTML = `<div class="cmdk-empty">Ничего не нашлось</div>`;
      return;
    }
    let html = '', lastGroup = null;
    filtered.forEach((it, i) => {
      if (it.group && it.group !== lastGroup) {
        html += `<div class="cmdk-group">${escHtml(it.group)}</div>`;
        lastGroup = it.group;
      }
      html += `<button class="cmdk-item ${i === cur ? 'is-cur' : ''}" data-i="${i}">` +
              `<span class="ci">${ico(it.icon || 'chevron', 16)}</span>` +
              `<span class="cl">${escHtml(it.label)}</span>` +
              (it.hint ? `<span class="cs">${escHtml(it.hint)}</span>` : '') +
              `</button>`;
    });
    list.innerHTML = html;
    list.querySelectorAll('.cmdk-item').forEach(b => {
      b.onclick = () => run(filtered[parseInt(b.dataset.i, 10)]);
    });
    if (keepQuery) {
      const el = list.querySelector('.is-cur');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }

  function run(it) {
    if (!it) return;
    close();
    setTimeout(() => { try { it.run(); } catch (e) { toast.err('Не вышло', e); } }, 30);
  }

  function open() {
    ensure();
    wrap.hidden = false;
    input.value = '';
    cur = 0;
    render();
    setTimeout(() => input.focus(), 30);
  }
  function close() { if (wrap) wrap.hidden = true; }
  function toggle() { ensure(); wrap.hidden ? open() : close(); }

  return { register, open, close, toggle };
})();

/* --------------------------------------------------------------------------
   11. МЕЛКИЕ ПОМОЩНИКИ
   -------------------------------------------------------------------------- */

/** Блокирует кнопку со спиннером на время асинхронного действия. */
async function withBusy(btn, fn) {
  if (!btn) return fn();
  const wasDisabled = btn.disabled;
  btn.classList.add('is-busy');
  btn.disabled = true;
  try { return await fn(); }
  finally { btn.classList.remove('is-busy'); btn.disabled = wasDisabled; }
}

/** Скелетон таблицы на время загрузки. */
function skeletonRows(cols, rows = 4) {
  let out = '';
  for (let r = 0; r < rows; r++) {
    out += '<tr>';
    for (let c = 0; c < cols; c++) {
      const w = c === 0 ? 26 : (c % 3 === 0 ? 54 : 100);
      out += `<td><div class="sk sk-line" style="width:${w}%"></div></td>`;
    }
    out += '</tr>';
  }
  return out;
}

function emptyRow(cols, title, text, action) {
  return `<tr><td colspan="${cols}" class="tbl-empty">` +
    `<div class="empty" style="padding:26px 10px;">` +
      `<div class="empty-title">${escHtml(title)}</div>` +
      (text ? `<div class="empty-text">${escHtml(text)}</div>` : '') +
      (action ? `<div class="empty-act">${action}</div>` : '') +
    `</div></td></tr>`;
}

/** Копирование в буфер с уведомлением. */
async function copyText(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    toast.ok((what || 'Скопировано') + ' в буфер');
  } catch (e) {
    toast.warn('Не удалось скопировать', 'Браузер запретил доступ к буферу.');
  }
}

/** Скачать текст как файл. */
function downloadText(name, text, mime) {
  const b = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Авторост текстового поля по содержимому. */
function autoGrow(el, max = 190) {
  if (!el) return;
  const fit = () => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  };
  el.addEventListener('input', fit);
  fit();
}

/** Вытащить все {{плейсхолдеры}} из текста. */
function extractPlaceholders(html) {
  return [...new Set((String(html || '').match(/\{\{([^}]+)\}\}/g) || [])
    .map(x => x.replace(/[{}]/g, '').trim()))];
}

/**
 * Клиентская проверка обрезанного HTML — зеркало серверного html_integrity().
 * Ловит обрыв ответа модели ещё до отправки на бэкенд.
 */
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const OPTIONAL_CLOSE = new Set(['li','p','td','th','tr','option','dt','dd','thead','tbody','tfoot']);

function htmlIntegrity(html) {
  const problems = [];
  const raw = String(html || '');
  if (!raw.trim()) return ['HTML пустой'];

  const lastLt = raw.lastIndexOf('<'), lastGt = raw.lastIndexOf('>');
  if (lastLt > lastGt) {
    problems.push('Разметка обрывается посреди тега: ' + raw.slice(lastLt, lastLt + 40));
    if ((raw.slice(lastLt).split('"').length - 1) % 2 === 1) problems.push('Незакрытая кавычка в атрибуте');
  }
  const opens = (raw.match(/\{\{/g) || []).length, closes = (raw.match(/\}\}/g) || []).length;
  if (opens !== closes) problems.push(`Непарные скобки плейсхолдеров: ${opens} «{{» против ${closes} «}}»`);
  if (raw.includes('```')) problems.push('Остался markdown-забор ```');

  const stack = [];
  let stray = 0;
  const re = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)\s*>/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const name = m[2].toLowerCase();
    if (VOID_TAGS.has(name) || m[3]) continue;
    if (!m[1]) stack.push(name);
    else if (stack.includes(name)) { while (stack.length) { if (stack.pop() === name) break; } }
    else stray++;
  }
  const unclosed = stack.filter(t => !OPTIONAL_CLOSE.has(t));
  if (unclosed.length) problems.push(`Не закрыто тегов: ${unclosed.length} (${unclosed.slice(0, 6).map(t => '<' + t + '>').join(', ')})`);
  if (stray) problems.push(`Закрывающих тегов без пары: ${stray}`);

  const t = raw.trim();
  if (!t.endsWith('>') && !t.endsWith('}')) problems.push('Финал не похож на конец разметки');
  return problems;
}

/* --------------------------------------------------------------------------
   12. БИБЛИОТЕКИ ИЗ ПЛАНА  (Блок 1 и Блок 2)

   Пока живут на клиенте. Когда появится GET /libraries —
   эти три константы заменяются ответом бэкенда.
   -------------------------------------------------------------------------- */

const LIB_PAGE_TYPES = [
  { id: 'db_slice', icon: 'table',  name: 'Срез базы',
    when: 'Много строк с фактами', ex: 'Карточка карты Таро',
    design: 'Карточка сущности: главная таблица характеристик, разделы, FAQ' },
  { id: 'matrix',   icon: 'layout', name: 'Матрица A×B',
    when: 'Два списка перемножаются', ex: 'Лев + Дева',
    design: 'Двухколоночное сравнение, шкала, вывод' },
  { id: 'calc',     icon: 'bolt',   name: 'Расчёт',
    when: 'Есть числа для вычисления', ex: 'Нумерология по дате',
    design: 'Калькулятор сверху, объяснение, примеры' },
  { id: 'status',   icon: 'clock',  name: 'Статус с датой',
    when: 'Данные устаревают', ex: 'Работает ли VPN сегодня',
    design: 'Большая плашка с датой, таблица состояний, история изменений' },
  { id: 'digest',   icon: 'list',   name: 'Сводка из источников',
    when: 'Данные разбросаны', ex: 'Сравнение 30 мнений',
    design: 'Таблица источников, расхождения, итог' },
];

const LIB_STRATEGIES = [
  { id: 'complete', icon: 'target', name: 'Полнота',
    gives: 'Всё в одном месте, чего нет у конкурентов', needs: 'Широкая таблица' },
  { id: 'compute',  icon: 'bolt',   name: 'Вычисление',
    gives: 'Цифра, которую надо было считать руками', needs: 'Формула + числа' },
  { id: 'compare',  icon: 'layout', name: 'Сравнение',
    gives: 'Сведённые вместе разрозненные данные', needs: 'Несколько источников' },
  { id: 'fresh',    icon: 'clock',  name: 'Свежесть',
    gives: 'Актуально на сегодня', needs: 'Дата + регулярное обновление' },
  { id: 'measured', icon: 'radar',  name: 'Собственное измерение',
    gives: 'То, что померил только ты', needs: 'Свои замеры' },
];


/* --------------------------------------------------------------------------
   12Б. ПРЕВЬЮ ТЕМЫ

   Фото дизайнов рисуем сами из токенов темы: миниатюра всегда
   совпадает с тем, что реально попадёт на страницу, и не требует
   картинок в репозитории.
   -------------------------------------------------------------------------- */

function themePreviewSvg(vars, opts) {
  const v = vars || {};
  const g = (k, fb) => v[k] || fb;
  const bg = g('--t-bg', '#111');
  const surf = g('--t-surface', 'rgba(255,255,255,.06)');
  const surf2 = g('--t-surface-2', 'rgba(255,255,255,.1)');
  const text = g('--t-text', '#fff');
  const muted = g('--t-muted', '#999');
  const acc = g('--t-accent', '#d9ae5f');
  const acc2 = g('--t-accent-2', acc);
  const line = g('--t-line', 'rgba(255,255,255,.2)');
  const r = Math.min(14, parseInt(g('--t-radius', '12px'), 10) || 12);
  const id = 'tg' + Math.random().toString(36).slice(2, 8);
  const tall = (opts && opts.tall) || false;
  const h = tall ? 190 : 132;

  const bar = (x, y, w, wid, col, op) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${wid}" rx="${wid / 2}" fill="${col}" opacity="${op}"/>`;
  const card = (x, y, w, ch) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${ch}" rx="${r}" fill="${surf}" stroke="${line}"/>`;

  return `<svg class="theme-shot" viewBox="0 0 240 ${h}" role="img" aria-hidden="true">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${acc}" stop-opacity=".55"/>` +
      `<stop offset="1" stop-color="${acc2}" stop-opacity=".18"/>` +
    `</linearGradient></defs>` +
    `<rect width="240" height="${h}" fill="${bg}"/>` +
    `<rect x="0" y="0" width="240" height="18" fill="${surf2}"/>` +
    bar(12, 7, 30, 5, acc, 1) + bar(66, 8, 20, 4, muted, .8) +
    bar(92, 8, 20, 4, muted, .8) + bar(118, 8, 20, 4, muted, .8) +
    `<rect x="196" y="5" width="32" height="9" rx="4.5" fill="${acc}"/>` +
    `<rect x="12" y="28" width="216" height="38" rx="${r}" fill="url(#${id})"/>` +
    bar(22, 38, 96, 8, text, .92) + bar(22, 52, 150, 5, text, .5) +
    card(12, 74, 104, 34) + card(124, 74, 104, 34) +
    bar(22, 84, 60, 5, text, .8) + bar(22, 94, 84, 4, muted, .8) +
    bar(134, 84, 60, 5, text, .8) + bar(134, 94, 84, 4, muted, .8) +
    (tall
      ? card(12, 116, 216, 30) + bar(22, 126, 120, 5, text, .8) +
        bar(22, 136, 180, 4, muted, .75) +
        `<rect x="12" y="154" width="216" height="24" rx="${r}" fill="${acc}" opacity=".9"/>`
      : bar(12, 118, 216, 6, acc, .35)) +
    `</svg>`;
}

/* --------------------------------------------------------------------------
   13. СТАРТ
   -------------------------------------------------------------------------- */

applyTheme(getTheme());

/** Общие горячие клавиши для всех страниц. */
document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
  if (typing) return;
  if (e.key === '?' ) { e.preventDefault(); showShortcuts(); }
  if (e.key === 't' && !e.metaKey && !e.ctrlKey) { toggleTheme(); }
});

function showShortcuts() {
  const rows = [
    ['⌘ K / Ctrl K', 'Командная палитра'],
    ['1 … 9',        'Перейти на этап по номеру'],
    ['G',            'Запустить генерацию'],
    ['R',            'Обновить текущий этап'],
    ['T',            'Переключить тему'],
    ['Esc',          'Закрыть панель или окно'],
    ['?',            'Эта справка'],
  ];
  drawer.open({
    eyebrow: 'Справка',
    title: 'Горячие клавиши',
    body: `<div class="checks-list">` + rows.map(r =>
      `<div class="check-row ok"><span class="check-name">${escHtml(r[1])}</span>` +
      `<span class="check-val"><kbd>${escHtml(r[0])}</kbd></span></div>`).join('') + `</div>`,
  });
}

/* --------------------------------------------------------------------------
   ВХОД · ТАБЛИЦА ДАННЫХ (CSV / TSV / Excel)
   Работает на экране «Данные» через api.uploadTable / api.previewTable.
   Шаг 1 — разбор файла без записи (apply=false),
   шаг 2 — заливка строк выбранной колонкой-ключом.
   -------------------------------------------------------------------------- */

function initTableUpload() {
  const host = document.getElementById('srcPaste');
  const sources = document.getElementById('dataSources');
  if (!host || !sources) return;                  // мы не на странице проекта
  if (document.getElementById('srcTable')) return;

  const PID = new URLSearchParams(location.search).get('id');

  const box = document.createElement('div');
  box.id = 'srcTable';
  box.className = 'mt-3';
  box.hidden = true;
  box.innerHTML = `
    <div class="up-drop" id="tblDrop">
      <div class="up-drop-t">Перетащите файл сюда или нажмите</div>
      <div class="up-drop-s">CSV, TSV, XLSX · до 12 МБ · первая строка — заголовки колонок</div>
    </div>
    <input type="file" class="up-file" id="tblFile" accept=".csv,.tsv,.txt,.xlsx,.xlsm">
    <div class="up-row">
      <div class="field">
        <div class="field-label">Колонка-ключ</div>
        <select class="select input-sm" id="tblKeyCol" disabled>
          <option value="">первая колонка</option>
        </select>
      </div>
      <div class="field">
        <div class="field-label">Режим</div>
        <select class="select input-sm" id="tblMode">
          <option value="add">Добавить к текущим</option>
          <option value="replace">Заменить все строки</option>
        </select>
      </div>
      <button class="btn btn-primary" id="tblUpload" disabled>Загрузить строки</button>
      <span class="up-name" id="tblName"></span>
    </div>
    <div class="up-prev" id="tblPrev"></div>`;
  host.insertAdjacentElement('afterend', box);

  /* Живая таблица: тот же разбор, только источник — ссылка на лист. */
  const sheetBox = document.createElement('div');
  sheetBox.id = 'srcSheet';
  sheetBox.className = 'mt-3';
  sheetBox.hidden = true;
  sheetBox.innerHTML = `
    <div class="field">
      <div class="field-label">Ссылка на Google Sheets</div>
      <input class="input" id="shUrl" placeholder="https://docs.google.com/spreadsheets/d/…">
      <div class="field-hint">
        В таблице: «Поделиться» → «Всем, у кого есть ссылка» → роль «Читатель».
        Ключи и доступы Google не нужны — лист читается напрямую.
        Ссылка запоминается: потом достаточно нажать «Загрузить строки».
      </div>
    </div>
    <div class="up-row">
      <div class="field">
        <div class="field-label">Колонка-ключ</div>
        <select class="select input-sm" id="shKeyCol" disabled>
          <option value="">первая колонка</option>
        </select>
      </div>
      <div class="field">
        <div class="field-label">Режим</div>
        <select class="select input-sm" id="shMode">
          <option value="sync">Обновлять факты у своих строк</option>
          <option value="add">Только добавлять новые</option>
          <option value="replace">Заменить все строки</option>
        </select>
      </div>
      <button class="btn" id="shCheck">Проверить лист</button>
      <button class="btn btn-primary" id="shSync" disabled>Загрузить строки</button>
      <span class="up-name" id="shName"></span>
    </div>
    <div class="up-prev" id="shPrev"></div>`;
  box.insertAdjacentElement('afterend', sheetBox);

  const drop   = box.querySelector('#tblDrop');
  const input  = box.querySelector('#tblFile');
  const keySel = box.querySelector('#tblKeyCol');
  const mode   = box.querySelector('#tblMode');
  const btn    = box.querySelector('#tblUpload');
  const nameEl = box.querySelector('#tblName');
  const prev   = box.querySelector('#tblPrev');

  let picked = null;        // выбранный файл
  let busy = false;
  let loadedSaved = false;
  let savedMeta = null;

  /* Карта колонок + первые строки. */
  function renderPreview(meta, into) {
    const out = into || prev;
    if (!meta || !(meta.columns || []).length) { out.innerHTML = ''; return; }
    const cols = meta.columns;
    const varied = cols.filter(c => (c.variability || 0) >= 0.5).length;
    const rows = meta.sample || [];

    const head = `
      <div class="metrics mt-3">
        <div class="metric"><div class="metric-k">Строк</div>
          <div class="metric-v">${fmtNum(meta.rows_total || 0)}</div></div>
        <div class="metric"><div class="metric-k">Колонок</div>
          <div class="metric-v">${cols.length}</div></div>
        <div class="metric"><div class="metric-k">Различаются</div>
          <div class="metric-v">${varied}</div>
          <div class="metric-note">чем больше разных колонок, тем выше потолок уникальности</div></div>
        <div class="metric"><div class="metric-k">Ключ</div>
          <div class="metric-v lg">${escHtml(meta.key_column || '—')}</div></div>
      </div>`;

    const map = `<div class="cols mt-3">` + cols.map(c => {
      const pct = Math.round((c.variability || 0) * 100);
      const tone = pct >= 50 ? 'ok' : (pct >= 15 ? 'warn' : 'bad');
      return `<div class="col-card">
        <div class="col-name"><span>${escHtml(c.name)}</span>
          <span class="pill ${tone}">${pct}%</span></div>
        <div class="col-note">${escHtml(c.sample || 'пусто')}</div>
        <div class="col-nums">заполнено ${Math.round((c.fill_rate || 0) * 100)}% · уникальных ${fmtNum(c.unique || 0)}</div>
        <div class="bar"><i class="bar-fill" style="width:${pct}%"></i></div>
      </div>`;
    }).join('') + `</div>`;

    const names = cols.map(c => c.name);
    const table = !rows.length ? '' : `
      <div class="hr-label">Первые строки</div>
      <div class="up-prev-wrap">
        <table class="up-prev-tbl">
          <thead><tr>${names.map(n =>
            `<th>${escHtml(n)}${n === meta.key_column ? ' · ключ' : ''}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r =>
            `<tr>${names.map(n => `<td>${escHtml(String(r[n] == null ? '' : r[n]))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;

    out.innerHTML = head + map + table;
  }

  /* Отправка файла. apply=false — только разобрать и показать. */
  async function send(apply) {
    if (!picked || !PID || busy) return null;
    busy = true;
    btn.disabled = true;
    const label = btn.textContent;
    if (apply) btn.textContent = 'Загружаю…';
    else prev.innerHTML = `<div class="muted mt-3">Разбираю файл…</div>`;
    try {
      const fd = new FormData();
      fd.append('file', picked);
      fd.append('key_column', apply ? (keySel.value || '') : '');
      fd.append('replace', apply && mode.value === 'replace' ? 'true' : 'false');
      fd.append('apply', apply ? 'true' : 'false');
      const meta = await api.uploadTable(PID, fd);
      renderPreview(meta);
      return meta;
    } catch (e) {
      prev.innerHTML = `<div class="note bad mt-3"><div class="note-body">${escHtml(e.message || 'Ошибка загрузки')}</div></div>`;
      toast.err('Таблица данных', e);
      return null;
    } finally {
      busy = false;
      btn.textContent = label;
      btn.disabled = !picked;
    }
  }

  async function choose(file) {
    if (!file) return;
    picked = file;
    nameEl.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} КБ`;
    btn.disabled = false;
    const meta = await send(false);
    keySel.innerHTML = '';
    keySel.disabled = true;
    if (meta && (meta.columns || []).length) {
      meta.columns.forEach(c => {
        const o = document.createElement('option');
        o.value = c.name;
        o.textContent = `${c.name} · уник. ${c.unique}`;
        keySel.appendChild(o);
      });
      keySel.value = meta.key_column || meta.columns[0].name;
      keySel.disabled = false;
      keySel.onchange = () => {
        const c = meta.columns.find(x => x.name === keySel.value);
        if (c && (c.variability || 0) < 1) {
          toast.info('Ключ с повторами',
            `В колонке «${c.name}» есть одинаковые значения — дубли будут пропущены`);
        }
      };
    }
  }

  /* Выбор файла: клик и drag-n-drop */
  drop.onclick = () => input.click();
  input.onchange = () => choose(input.files && input.files[0]);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('is-over');
  }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) choose(f);
  });

  /* Заливка строк */
  btn.onclick = async () => {
    if (mode.value === 'replace') {
      const ok = await confirmDialog({
        title: 'Заменить все строки?',
        text: 'Текущие строки удалятся вместе с их задачами и страницами.',
        confirm: 'Заменить',
        danger: true,
      });
      if (!ok) return;
    }
    const meta = await send(true);
    if (!meta) return;
    const msg = `Добавлено ${fmtNum(meta.created || 0)} из ${fmtNum(meta.rows_total || 0)}` +
      (meta.skipped_duplicates ? `, дублей ${meta.skipped_duplicates}` : '') +
      (meta.skipped_empty ? `, без ключа ${meta.skipped_empty}` : '');
    toast.ok('Строки загружены', msg);
    const reload = document.getElementById('keysReload');
    if (reload) reload.click();                   // перерисовать таблицу строк
  };

  /* ---- Живая таблица ---- */

  const shUrl   = sheetBox.querySelector('#shUrl');
  const shKey   = sheetBox.querySelector('#shKeyCol');
  const shMode  = sheetBox.querySelector('#shMode');
  const shCheck = sheetBox.querySelector('#shCheck');
  const shSync  = sheetBox.querySelector('#shSync');
  const shName  = sheetBox.querySelector('#shName');
  const shPrev  = sheetBox.querySelector('#shPrev');

  let shBusy = false;

  function shFillKeys(meta) {
    const cols = (meta && meta.columns) || [];
    if (!cols.length) return;
    shKey.innerHTML = '';
    cols.forEach(c => {
      const o = document.createElement('option');
      o.value = c.name;
      o.textContent = `${c.name} · уник. ${c.unique}`;
      shKey.appendChild(o);
    });
    shKey.value = meta.key_column || cols[0].name;
    shKey.disabled = false;
  }

  /* apply=false — только прочитать лист и показать карту колонок. */
  async function shSend(apply) {
    const url = (shUrl.value || '').trim();
    if (!url || !PID || shBusy) return null;
    shBusy = true;
    shCheck.disabled = true;
    shSync.disabled = true;
    const label = shSync.textContent;
    if (apply) shSync.textContent = 'Загружаю…';
    else shPrev.innerHTML = `<div class="muted mt-3">Читаю лист…</div>`;
    try {
      const meta = await api.linkSheet(PID, {
        url,
        key_column: apply ? (shKey.value || '') : '',
        apply,
        replace: apply && shMode.value === 'replace',
        sync: shMode.value === 'sync',
      });
      renderPreview(meta, shPrev);
      shFillKeys(meta);
      shName.textContent = `в листе ${fmtNum(meta.rows_total || 0)} ` +
        plural(meta.rows_total || 0, 'строка', 'строки', 'строк');
      return meta;
    } catch (e) {
      shPrev.innerHTML = `<div class="note bad mt-3"><div class="note-body">${escHtml(e.message || 'Не удалось прочитать лист')}</div></div>`;
      toast.err('Google Sheets', e);
      return null;
    } finally {
      shBusy = false;
      shCheck.disabled = false;
      shSync.textContent = label;
      shSync.disabled = !(shUrl.value || '').trim();
    }
  }

  shUrl.oninput = () => { shSync.disabled = !(shUrl.value || '').trim(); };
  shCheck.onclick = () => shSend(false);
  shSync.onclick = async () => {
    if (shMode.value === 'replace') {
      const ok = await confirmDialog({
        title: 'Заменить все строки?',
        text: 'Текущие строки удалятся вместе с их задачами и страницами.',
        confirm: 'Заменить',
        danger: true,
      });
      if (!ok) return;
    }
    const meta = await shSend(true);
    if (!meta) return;
    const msg = `Добавлено ${fmtNum(meta.created || 0)}` +
      (meta.updated ? `, обновлено ${fmtNum(meta.updated)}` : '') +
      (meta.skipped_duplicates ? `, без изменений ${fmtNum(meta.skipped_duplicates)}` : '') +
      (meta.skipped_empty ? `, без ключа ${fmtNum(meta.skipped_empty)}` : '');
    toast.ok('Лист синхронизирован', msg);
    const reload = document.getElementById('keysReload');
    if (reload) reload.click();
  };

  /* У карточек CSV и Sheets теперь реальная форма, а не заглушка. */
  ['csv', 'sheet'].forEach(src => {
    const card = sources.querySelector(`.pick-card[data-src="${src}"]`);
    if (!card) return;
    const need = card.querySelector('.pick-need');
    if (need) need.remove();
    const soon = card.querySelector('.pill.soon');
    if (soon) { soon.className = 'pill ok'; soon.textContent = 'Готово'; }
  });

  /* Сохранённая карта колонок тянется один раз и годится обоим источникам. */
  async function loadSaved() {
    if (loadedSaved) return savedMeta;
    loadedSaved = true;
    try { savedMeta = await api.previewTable(PID); }
    catch (_) { savedMeta = null; }               // превью необязательно
    return savedMeta;
  }

  sources.addEventListener('click', async e => {
    const card = e.target.closest && e.target.closest('.pick-card');
    if (!card) return;
    const src = card.dataset.src;
    const isCsv = src === 'csv';
    const isSheet = src === 'sheet';
    box.hidden = !isCsv;
    sheetBox.hidden = !isSheet;
    if (!isCsv && !isSheet) return;
    // своим обработчиком страница показала заглушку — убираем её
    const stub = document.getElementById('srcStub');
    if (stub) stub.hidden = true;
    const paste = document.getElementById('srcPaste');
    if (paste) paste.hidden = true;
    if (!PID) return;
    const saved = await loadSaved();
    if (!saved || !(saved.columns || []).length) return;
    renderPreview(saved, isSheet ? shPrev : prev);
    if (isSheet) {
      if (!shUrl.value && saved.sheet_url) shUrl.value = saved.sheet_url;
      if (saved.source === 'sheet') shFillKeys(saved);
      shSync.disabled = !(shUrl.value || '').trim();
    }
  });
}

/* --------------------------------------------------------------------------
   ГЕЙТ КАЧЕСТВА — пороги и отключение проверок.

   Главное: часть проверок Google не использует вообще — тошнота,
   водность, индексы читаемости, meta keywords. Они выключены на
   бэкенде и показаны здесь с пометкой, чтобы было видно почему.
   -------------------------------------------------------------------------- */

let GATE_CFG = null;
let gateBound = false;

const GATE_GOOGLE = {
  uses:     ['ok',      'Google учитывает'],
  indirect: ['warn',    'влияет косвенно'],
  ignores:  ['neutral', 'Google не смотрит'],
};

function gatePid() { return new URLSearchParams(location.search).get('id'); }

async function initGateConfig(force) {
  const host = document.getElementById('gateChecks');
  const pid = gatePid();
  if (!host || !pid) return;
  if (GATE_CFG && !force) { renderGateConfig(); return; }

  host.innerHTML = '<div class="stub-text">Загружаем настройки гейта…</div>';
  try {
    GATE_CFG = await api.getGateConfig(pid);
  } catch (e) {
    GATE_CFG = null;
    host.innerHTML = '<div class="stub-text">' +
      escHtml(e.message || 'Настройки гейта не загрузились') + '</div>';
    return;
  }
  bindGateConfig();
  renderGateConfig();
}

function renderGateConfig() {
  if (!GATE_CFG) return;
  const cfg = GATE_CFG.config || {};
  const put = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

  put('gateMinChars', cfg.min_chars || 0);
  put('gateUniq', Math.round((Number(cfg.uniqueness_min) || 0) * 100));
  put('gateSelfRep', cfg.self_repetition_max);
  put('gateIntra', cfg.intra_page_max);
  put('gatePass', cfg.pass_score);
  put('gateRedo', cfg.redo_score);

  const checks = GATE_CFG.checks || [];
  const off = checks.filter(c => !c.enabled).length;
  const pill = document.getElementById('gateOffPill');
  if (pill) pill.textContent = off ? ('выключено ' + off) : 'все включены';

  const groups = [
    ['5.1', '5.1 · Блокировки'],
    ['5.2', '5.2 · Факты'],
    ['5.3', '5.3 · Уникальность'],
    ['5.4', '5.4 · Качество текста'],
  ];

  const html = groups.map(([lvl, title]) => {
    const items = checks.filter(c => c.level === lvl);
    if (!items.length) return '';
    return `<div class="hr-label">${escHtml(title)}</div>` +
      `<div class="checks-list">` + items.map(c => {
        const g = GATE_GOOGLE[c.google] || GATE_GOOGLE.indirect;
        const total = (c.ok || 0) + (c.fail || 0);
        const stat = total ? `${c.ok}/${total}` : '—';
        return `<label class="check-row" title="${escAttr(c.key)}">` +
          `<span class="check-name">` +
            `<input type="checkbox" class="check" data-gate-key="${escAttr(c.key)}"` +
              `${c.enabled ? ' checked' : ''}${c.locked ? ' disabled' : ''}> ` +
            `${escHtml(c.label)} <span class="pill ${g[0]}">${escHtml(g[1])}</span>` +
            (c.locked ? ` <span class="pill neutral">обязательная</span>` : '') +
            `<span class="muted" style="display:block;margin-top:2px;">${escHtml(c.note || '')}</span>` +
          `</span>` +
          `<span class="check-val">${stat}</span>` +
        `</label>`;
      }).join('') + `</div>`;
  }).join('');

  document.getElementById('gateChecks').innerHTML = html;

  const note = document.getElementById('gateNote');
  if (note) {
    note.innerHTML =
      '<b>Что убрано и почему.</b> Тошнота (классическая и академическая), водность, ' +
      'индекс читаемости Флеша и meta keywords выключены: Google прямо говорит, что ' +
      'понятия оптимальной плотности слов не существует, алгоритмов на базовых индексах ' +
      'читаемости нет, а тег keywords игнорируется с 2009 года. Отключённые проверки ' +
      'не считаются при генерации и вычищаются из уже готовых страниц при сохранении.';
  }

  /* подписи развилки — из тех же настроек */
  const ranges = document.querySelectorAll('#view-gate .fork-range');
  if (ranges.length === 3) {
    ranges[0].textContent = '≥ ' + cfg.pass_score;
    ranges[1].textContent = cfg.redo_score + ' — ' + cfg.pass_score;
    ranges[2].textContent = '< ' + cfg.redo_score;
  }
}

function bindGateConfig() {
  if (gateBound) return;
  gateBound = true;

  const save = document.getElementById('gateSave');
  if (save) save.onclick = () => saveGateConfigUI(save);

  const reset = document.getElementById('gateReset');
  if (reset) reset.onclick = () => {
    if (!GATE_CFG) return;
    const def = GATE_CFG.defaults || {};
    GATE_CFG.config = Object.assign({}, def);
    const offDef = def.disabled || [];
    GATE_CFG.checks = (GATE_CFG.checks || []).map(c =>
      Object.assign({}, c, { enabled: offDef.indexOf(c.key) === -1 }));
    renderGateConfig();
    toast.info('Значения по умолчанию', 'Нажмите «Сохранить», чтобы применить');
  };
}

async function saveGateConfigUI(btn) {
  const pid = gatePid();
  if (!pid || !GATE_CFG) return;

  const num = (id, def) => {
    const el = document.getElementById(id);
    const v = el ? parseFloat(String(el.value).replace(',', '.')) : NaN;
    return Number.isFinite(v) ? v : def;
  };

  const disabled = Array.from(document.querySelectorAll('[data-gate-key]'))
    .filter(el => !el.checked && !el.disabled)
    .map(el => el.getAttribute('data-gate-key'));

  const body = {
    min_chars: Math.round(num('gateMinChars', 0)),
    uniqueness_min: Math.max(0, Math.min(95, num('gateUniq', 80))) / 100,
    self_repetition_max: num('gateSelfRep', 0.08),
    intra_page_max: num('gateIntra', 0.6),
    pass_score: Math.round(num('gatePass', 80)),
    redo_score: Math.round(num('gateRedo', 60)),
    disabled: disabled,
    apply_to_existing: true,
  };

  const run = async () => {
    try {
      const res = await api.saveGateConfig(pid, body);
      const parts = [];
      if (res && res.cleaned) parts.push('очищено страниц: ' + res.cleaned);
      if (res && res.restored) parts.push('стали готовыми: ' + res.restored);
      toast.ok('Гейт сохранён', parts.join(', ') || 'Настройки применены');
      await initGateConfig(true);
      if (typeof loadPages === 'function') await loadPages(true);
      if (typeof renderGate === 'function') renderGate();
    } catch (e) {
      toast.err('Не удалось сохранить гейт', e);
    }
  };

  if (btn && typeof withBusy === 'function') await withBusy(btn, run);
  else await run();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTableUpload);
} else {
  initTableUpload();
}
