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
  'analyzeData', 'getPassport', 'savePassport',   // Блок 1 — оркестратор
  'uploadTable', 'previewTable', 'linkSheet',      // вход — таблица данных
  'listLibraries', 'buildFrame',                   // Блок 2 — каркас из библиотеки
  'getGateConfig', 'saveGateConfig',               // Блок 5 — настройка гейта
  'buildWiring', 'getWiring',                      // Блок 6 — обвязка
  'listWaves', 'createWave', 'publishWave',        // Блок 7 — волны
  'getFeedback', 'connectSearchConsole',           // Блок 8 — обратная связь
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
  exportUrl:      (id)      => `${API_BASE.replace(/\/+$/, '')}/projects/${id}/export`,

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

  /* ---- БЛОК 1 — Оркестратор (ещё нет на сервере) ---- */
  analyzeData:  (id)     => req(`/projects/${id}/analyze`, { method: 'POST' }),
  getPassport:  (id)     => req(`/projects/${id}/passport`),
  savePassport: (id, d)  => req(`/projects/${id}/passport`, { method: 'PUT', body: JSON.stringify(d) }),

  /* ---- ВХОД — таблица данных (ещё нет) ---- */
  uploadTable:  (id, fd) => req(`/projects/${id}/table`, { method: 'POST', body: fd, headers: {} }),
  previewTable: (id)     => req(`/projects/${id}/table/preview`),
  linkSheet:    (id, u)  => req(`/projects/${id}/table/sheet`, { method: 'POST', body: JSON.stringify({ url: u }) }),

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

  /* ---- БЛОК 8 — Обратная связь (ещё нет) ---- */
  getFeedback:          (id) => req(`/projects/${id}/feedback`),
  connectSearchConsole: (id) => req(`/projects/${id}/feedback/connect`, { method: 'POST' }),
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
  nausea:                 ['Тошнота', '5.4'],
  nausea_academic:        ['Академическая тошнота', '5.4'],
  stop_words:             ['Стоп-слова', '5.4'],
  water:                  ['Водность', '5.4'],
  readability:            ['Читаемость', '5.4'],
  h2_body:                ['Текст под H2', '5.4'],
  structure:              ['Структура', '5.4'],
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
