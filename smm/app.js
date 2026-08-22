
/* SEO-Фабрика — API-клиент (vanilla JS) */

const API_BASE = (() => {
  // 1. Пользователь указал вручную в настройках — берём оттуда
  const stored = localStorage.getItem('seo_api_base');
  if (stored) return stored.replace(/\/$/, '');
  // 2. Локальная разработка (файл:// или localhost)
  const h = location.hostname;
  if (!h || h === 'localhost' || h === '127.0.0.1') {
    return 'http://localhost:8000/api';
  }
  // 3. Продакшн на waifubot.website
  if (h.endsWith('waifubot.website')) {
    return 'https://seo.waifubot.website/api';
  }
  // 4. Общий fallback: same-origin /api
  return `${location.protocol}//${h}/api`;
})();

function saveApiBase(url) {
  localStorage.setItem('seo_api_base', url.replace(/\/$/, ''));
}

async function req(path, opts = {}) {
  const url = API_BASE.replace(/\/$/, '') + path;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(opts.headers || {}),
      },
      ...opts,
    });
    if (response.status === 204) return null;
    const text = await response.text();
    if (!response.ok) {
      let msg = text;
      let detail = null;
      try { detail = JSON.parse(text)?.detail ?? null; } catch {}
      if (detail && typeof detail === 'object') {
        // Бэкенд отдаёт структуру {error, message, problems} — например,
        // когда каркас обрезан. Не превращаем его в [object Object].
        msg = detail.message || JSON.stringify(detail);
      } else if (detail) {
        msg = detail;
      }
      // Диагностика: эндпоинта нет на сервере (устаревший деплой бэкенда)
      if (response.status === 404 || response.status === 405) {
        msg = `${msg || 'Not Found'} — эндпоинт недоступен: ${url}. ` +
              `Вероятно, на сервере запущена старая версия бэкенда — обновите деплой.`;
      }
      throw new Error(`HTTP ${response.status}: ${msg}`);
    }
    try { return JSON.parse(text); } catch { return text; }
  } catch (e) {
    // TypeError = network error (CORS, DNS, SSL, fetch failed)
    if (e instanceof TypeError) {
      throw new Error(
        `Не удалось соединиться с бэкендом (${url}). ` +
        `Проверьте: сервер запущен, URL в настройках верный, SSL-сертификат валиден.`
      );
    }
    throw e;
  }
}

const api = {
  // Проекты
  listProjects:        ()              => req('/projects'),
  getProject:          (id)            => req(`/projects/${id}`),
  createProject:       (data)          => req('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject:       (id, data)      => req(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject:       (id)            => req(`/projects/${id}`, { method: 'DELETE' }),
  // Шаблоны
  saveTemplate:        (id, data)      => req(`/projects/${id}/templates`, { method: 'POST', body: JSON.stringify(data) }),
  approveTemplate:     (id, tid)       => req(`/projects/${id}/templates/${tid}/approve`, { method: 'POST' }),
  previewTemplate:     (id, tid)       => req(`/projects/${id}/templates/${tid}/preview`, { method: 'POST' }),
  // Ключи
  listKeys:            (id)            => req(`/projects/${id}/keys`),
  addKeys:             (id, data)      => req(`/projects/${id}/keys`, { method: 'POST', body: JSON.stringify(data) }),
  deleteKey:           (id, keyId)     => req(`/projects/${id}/keys/${keyId}`, { method: 'DELETE' }),
  // Генерация
  startGeneration:     (id, parallel)  => req(`/projects/${id}/generate?parallel=${parallel || 1}`, { method: 'POST' }),
  stopGeneration:      (id)            => req(`/projects/${id}/stop`, { method: 'POST' }),
  recomputeUniqueness: (id)            => req(`/projects/${id}/recompute-uniqueness`, { method: 'POST' }),
  listTasks:           (id)            => req(`/projects/${id}/tasks`),
  // Страницы
  listPages:           (id)            => req(`/projects/${id}/pages`),
  getPage:             (id, pid)       => req(`/projects/${id}/pages/${pid}`),
  deletePage:          (id, pid)       => req(`/projects/${id}/pages/${pid}`, { method: 'DELETE' }),
  deletePages:         (id, ids)       => req(`/projects/${id}/pages/delete`, { method: 'POST', body: JSON.stringify({ ids }) }),
  regeneratePage:      (pageId)        => req(`/pages/${pageId}/regenerate`, { method: 'POST' }),
  exportProject:       (id)            => `${API_BASE.replace(/\/$/, '')}/projects/${id}/export`,
  // Чат
  chatHistory:         (id)            => req(`/chat/${id}/history`),
  chatSend:            (id, msg)       => req(`/chat/${id}`, { method: 'POST', body: JSON.stringify({ message: msg }) }),
  chatExtractFrame:    (id)            => req(`/chat/${id}/frame`, { method: 'POST' }),
  chatMessage:         (id, mid)       => req(`/chat/${id}/message/${mid}`),
  // Настройки
  getSettings:         ()              => req('/settings'),
  updateSettings:      (settings)      => req('/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),
  getProviders:        ()              => req('/settings/providers'),
  getModels:           ()              => req('/settings/models'),
  // Тест кастомного OpenAI-совместимого API через бэкенд (обход CORS браузера)
  testCustomApi:       (baseUrl, key)  => req('/settings/test-custom-api', {
                                            method: 'POST',
                                            body: JSON.stringify({ base_url: baseUrl, api_key: key }),
                                          }),
  // Сохранённые кастомные ключи: их может быть несколько одновременно
  listCustomEndpoints:  ()             => req('/settings/custom-endpoints'),
  addCustomEndpoint:    (data)         => req('/settings/custom-endpoints', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomEndpoint: (id)           => req(`/settings/custom-endpoints/${id}`, { method: 'DELETE' }),
  testCustomEndpoint:   (id)           => req(`/settings/custom-endpoints/${id}/test`, { method: 'POST' }),
};

// ── Utils ──────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status) {
  const map = {
    draft: 'Черновик', active: 'Активен', generating: 'Генерируется…',
    done: 'Готов', error: 'Ошибка',
    // pending и queued раньше оба подписывались как «В очереди», и было не понять,
    // ждёт ли ключ запуска или по нему уже создана задача.
    pending: 'В очереди', queued: 'Взят в задачу', running: 'Выполняется',
    success: 'Успех', failed: 'Ошибка', cancelled: 'Отменён',
    ready: 'Готов', approved: 'Утверждён',
  };
  return map[status] || status;
}

function statusBadgeClass(status) {
  const map = {
    draft: 'draft', active: 'active', generating: 'generating',
    done: 'done', error: 'error',
    pending: 'pending', queued: 'queued', running: 'running',
    success: 'success', failed: 'failed', cancelled: 'cancelled',
    ready: 'ready', approved: 'approved',
  };
  return map[status] || 'pending';
}

function badge(status) {
  return `<span class="badge ${statusBadgeClass(status)}">${statusLabel(status)}</span>`;
}

// ── Цветовые темы ───────────────────────────────────
const THEMES = {
  workshop: { name: 'Наборный цех', note: 'Светлая типографская: бумага, тушь, синяя печать',
              swatches: ['#ecede7', '#ffffff', '#2536c8', '#15171c', '#c2410c'] },
  sapphire: { name: 'Сапфир и персик', note: 'Сапфир, оружейный металл и платина, согретые персиком и коричневым',
              swatches: ['#191e25', '#2a333d', '#5b8def', '#eef1f6', '#f0915a'] },
};

function getTheme() {
  try { return localStorage.getItem('seo_theme') || 'workshop'; } catch (e) { return 'workshop'; }
}

function applyTheme(name) {
  const t = THEMES[name] ? name : 'workshop';
  if (t === 'workshop') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('seo_theme', t); } catch (e) {}
  return t;
}

// ── Паспорт модели ─────────────────────────────────
// Показывает, какую модель просили и какая реально ответила.
function modelTag(obj) {
  if (!obj) return '';
  const asked = obj.model || '';
  const got = obj.model_returned || '';
  if (!asked && !got) return '<span class="model-tag">модель не записана</span>';
  const prov = obj.provider ? escHtml(obj.provider) + ' / ' : '';
  if (got && asked && got !== asked) {
    return `<span class="model-tag warn" title="Провайдер ответил другой моделью!">⚠ просили ${prov}${escHtml(asked)} → ответила ${escHtml(got)}</span>`;
  }
  if (got) return `<span class="model-tag ok" title="Подтверждено ответом API">✓ ${prov}${escHtml(got)}</span>`;
  return `<span class="model-tag" title="Провайдер не вернул имя модели">${prov}${escHtml(asked)} (не подтверждено)</span>`;
}

