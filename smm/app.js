/* SEO-Фабрика — API-клиент (vanilla JS) */

const API_BASE = (() => {
  const stored = localStorage.getItem('seo_api_base');
  if (stored) return stored;
  return `http://${location.hostname || 'localhost'}:8000/api`;
})();

function saveApiBase(url) {
  localStorage.setItem('seo_api_base', url);
}

async function req(path, opts = {}) {
  const url = API_BASE.replace(/\/$/, '') + path;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!response.ok) {
    let msg = text;
    try { msg = JSON.parse(text)?.detail || text; } catch {}
    throw new Error(`HTTP ${response.status}: ${msg}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

const api = {
  // Проекты
  listProjects:        ()              => req('/projects'),
  getProject:          (id)            => req(`/projects/${id}`),
  createProject:       (data)          => req('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject:       (id, data)      => req(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
  listTasks:           (id)            => req(`/projects/${id}/tasks`),
  // Страницы
  listPages:           (id)            => req(`/projects/${id}/pages`),
  getPage:             (id, pid)       => req(`/projects/${id}/pages/${pid}`),
  regeneratePage:      (pageId)        => req(`/pages/${pageId}/regenerate`, { method: 'POST' }),
  exportProject:       (id)            => `${API_BASE.replace(/\/$/, '')}/projects/${id}/export`,
  // Чат
  chatHistory:         (id)            => req(`/chat/${id}/history`),
  chatSend:            (id, msg)       => req(`/chat/${id}`, { method: 'POST', body: JSON.stringify({ message: msg }) }),
  chatExtractFrame:    (id)            => req(`/chat/${id}/frame`, { method: 'POST' }),
  // Настройки
  getSettings:         ()              => req('/settings'),
  updateSettings:      (settings)      => req('/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),
  getProviders:        ()              => req('/settings/providers'),
  getModels:           ()              => req('/settings/models'),
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
    pending: 'В очереди', queued: 'В очереди', running: 'Выполняется',
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