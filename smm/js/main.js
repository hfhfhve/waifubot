// Мини-SPA для SEO-Фабрики (One-page), GitHub Pages-совместимый. ВНИМАНИЕ: backend берём из localStorage или дефолтного URL.
const DEFAULT_BACKEND_URL = "http://waifubot.website:8000";
window.API_URL = localStorage.getItem("seoapi") || DEFAULT_BACKEND_URL;

function setStatus(text, ok = true) {
  const s = document.getElementById("status");
  s.textContent = text;
  s.style.color = ok ? "green" : "red";
}

async function request(path, init = {}) {
  const res = await fetch(window.API_URL + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error("HTTP " + res.status + ": " + txt);
  }
  return res.status === 204 ? null : res.json();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v; else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) node.append(c);
  return node;
}

async function loadProjects() {
  try {
    const items = await request("/api/projects");
    const host = document.getElementById("page-dashboard");
    host.innerHTML = "";
    const card = el("div", { className: "card" });
    card.append(el("h2", {}, "Проекты"));
    const list = el("ul", {});
    for (const p of items) {
      const li = el("li", {}, []);
      li.append(el("strong", {}, p.name), ` — ${p.domain || "домен не задан"}`);
      list.append(li);
    }
    card.append(list);
    host.append(card);
    setStatus("Backend связан. Включён API.");
  } catch (e) {
    setStatus("Ошибка связи с backend: " + e.message, false);
  }
}

function navigate(name) {
  for (const sec of document.querySelectorAll("section")) sec.style.display = "none";
  document.getElementById(`page-${name}`).style.display = "block";
  if (name === "dashboard") loadProjects();
  if (name === "settings") document.getElementById("api-url").value = window.API_URL;
}

document.getElementById("goto-dashboard").addEventListener("click", (e) => { e.preventDefault(); navigate("dashboard"); });
document.getElementById("goto-settings").addEventListener("click", (e) => { e.preventDefault(); navigate("settings"); });

document.getElementById("apply-api").addEventListener("click", () => {
  const v = document.getElementById("api-url").value.trim();
  if (v) {
    localStorage.setItem("seoapi", v);
    window.API_URL = v;
    setStatus("Backend URL сохранён: " + v);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("api-url").value = window.API_URL;
  navigate("dashboard");
});
