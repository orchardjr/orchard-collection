import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
let plants = [];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function prettifyKey(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function renderLogin(message = "") {
  app.innerHTML = `
    <section class="auth-shell">
      <div class="auth-card">
        <p class="eyebrow">Private plant archive</p>
        <h1>Orchard Collection</h1>
        <p class="subtext">Sign in to open your live Hoya collection. Your session remains securely stored on this device until you sign out.</p>
        <form id="login-form" class="form-grid">
          <label>
            Email
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="primary" type="submit">Sign in</button>
          <div class="form-error" id="login-error">${escapeHTML(message)}</div>
        </form>
      </div>
    </section>`;

  document.querySelector("#login-form").addEventListener("submit", handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const errorBox = document.querySelector("#login-error");
  const formData = new FormData(form);

  button.disabled = true;
  button.textContent = "Signing in…";
  errorBox.textContent = "";

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (error) {
    errorBox.textContent = error.message;
    button.disabled = false;
    button.textContent = "Sign in";
  }
}

function appHeader(email = "") {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">OC</div>
        <div class="brand-copy">
          <strong>Orchard Collection</strong>
          <span>${escapeHTML(email)}</span>
        </div>
      </div>
      <button class="secondary" id="sign-out">Sign out</button>
    </header>`;
}

async function loadPlants() {
  const { data, error } = await supabase
    .from("plants")
    .select("*")
    .order("accession", { ascending: true });

  if (error) throw error;
  plants = data ?? [];
  return plants;
}

function getPlantSummary(plant) {
  const medium = plant.medium || "Medium not recorded";
  const status = plant.status || "Active";
  const location = plant.location || plant.support || "Location not recorded";
  return { medium, status, location };
}

function renderDashboard(user) {
  const active = plants.filter(p => String(p.status || "").toLowerCase() !== "inactive").length;
  const variegated = plants.filter(p => p.variegated === true || String(p.variegated).toLowerCase() === "true").length;
  const peduncles = plants.reduce((sum, p) => sum + (Number(p.peduncles) || 0), 0);

  app.innerHTML = `
    <div class="app-shell">
      ${appHeader(user.email)}
      <div class="content">
        <section class="hero">
          <div>
            <p class="eyebrow">Live Supabase collection</p>
            <h1>Your plants, finally connected.</h1>
            <p>Every card below is loading directly from your private database. Search by accession, cultivar, condition, medium, or location.</p>
          </div>
          <aside class="hero-panel">
            <div class="big-number">${plants.length}</div>
            <span>plants in Orchard Collection</span>
          </aside>
        </section>

        <section class="stats" aria-label="Collection summary">
          <div class="stat"><strong>${active}</strong><span>Active plants</span></div>
          <div class="stat"><strong>${variegated}</strong><span>Variegated plants</span></div>
          <div class="stat"><strong>${peduncles}</strong><span>Recorded peduncles</span></div>
          <div class="stat"><strong>${new Set(plants.map(p => p.medium).filter(Boolean)).size}</strong><span>Growing media</span></div>
        </section>

        <div class="toolbar">
          <div class="search-wrap">
            <input id="plant-search" type="search" placeholder="Search your collection…" autocomplete="off" />
          </div>
        </div>

        <section id="plant-grid" class="plant-grid"></section>
      </div>
    </div>`;

  document.querySelector("#sign-out").addEventListener("click", signOut);
  const search = document.querySelector("#plant-search");
  search.addEventListener("input", () => renderPlantCards(search.value));
  renderPlantCards("");
}

function renderPlantCards(query) {
  const grid = document.querySelector("#plant-grid");
  const term = query.trim().toLowerCase();
  const filtered = plants.filter(plant =>
    Object.values(plant).some(value => String(value ?? "").toLowerCase().includes(term))
  );

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty">No plants match “${escapeHTML(query)}”.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(plant => {
    const summary = getPlantSummary(plant);
    return `
      <a class="plant-card" href="?plant=${encodeURIComponent(plant.accession)}">
        <div class="card-top">
          <span class="accession">${escapeHTML(plant.accession || "UNASSIGNED")}</span>
          <span class="status-dot" title="${escapeHTML(summary.status)}"></span>
        </div>
        <div class="card-body">
          <h2>${escapeHTML(plant.name || "Unnamed plant")}</h2>
          <div class="card-meta">
            <span>${escapeHTML(summary.status)}</span>
            <span>${escapeHTML(summary.medium)}</span>
            <span>${escapeHTML(summary.location)}</span>
          </div>
        </div>
      </a>`;
  }).join("");
}

function renderPlantDetail(user, plant) {
  if (!plant) {
    app.innerHTML = `
      <div class="app-shell">
        ${appHeader(user.email)}
        <div class="content detail-shell">
          <a class="back-link" href="./">← Back to collection</a>
          <div class="error-panel">That accession number was not found in your collection.</div>
        </div>
      </div>`;
    document.querySelector("#sign-out").addEventListener("click", signOut);
    return;
  }

  const hiddenKeys = new Set(["id", "owner_id", "created_at", "updated_at", "name", "accession"]);
  const rows = Object.entries(plant)
    .filter(([key, value]) => !hiddenKeys.has(key) && value !== null && value !== "" && !Array.isArray(value) && typeof value !== "object")
    .map(([key, value]) => `
      <div class="data-row">
        <span>${escapeHTML(prettifyKey(key))}</span>
        <span>${escapeHTML(typeof value === "boolean" ? (value ? "Yes" : "No") : value)}</span>
      </div>`)
    .join("");

  const created = plant.created_at ? new Date(plant.created_at).toLocaleDateString() : "Not recorded";
  const updated = plant.updated_at ? new Date(plant.updated_at).toLocaleDateString() : "Not recorded";

  app.innerHTML = `
    <div class="app-shell">
      ${appHeader(user.email)}
      <div class="content detail-shell">
        <a class="back-link" href="./">← Back to collection</a>
        <section class="detail-hero">
          <span class="accession">${escapeHTML(plant.accession)}</span>
          <h1>${escapeHTML(plant.name || "Unnamed plant")}</h1>
        </section>
        <section class="detail-grid">
          <article class="detail-panel">
            <h3>Plant record</h3>
            <div class="data-list">${rows || '<p class="subtext">No additional data has been recorded.</p>'}</div>
          </article>
          <article class="detail-panel">
            <h3>Database history</h3>
            <div class="data-list">
              <div class="data-row"><span>Created</span><span>${escapeHTML(created)}</span></div>
              <div class="data-row"><span>Last updated</span><span>${escapeHTML(updated)}</span></div>
              <div class="data-row"><span>NFC URL</span><span>${escapeHTML(location.origin + location.pathname + "?plant=" + plant.accession)}</span></div>
            </div>
          </article>
        </section>
      </div>
    </div>`;

  document.querySelector("#sign-out").addEventListener("click", signOut);
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) showToast(error.message);
}

async function renderAuthenticated(session) {
  app.innerHTML = `<section class="loading-screen"><div class="brand-mark">OC</div><p>Loading your plants…</p></section>`;
  try {
    await loadPlants();
    const accession = new URLSearchParams(location.search).get("plant");
    if (accession) {
      renderPlantDetail(session.user, plants.find(p => p.accession === accession));
    } else {
      renderDashboard(session.user);
    }
  } catch (error) {
    app.innerHTML = `
      <div class="app-shell">
        ${appHeader(session.user.email)}
        <div class="content">
          <div class="error-panel">
            <strong>Your login worked, but the plants could not be loaded.</strong><br><br>
            ${escapeHTML(error.message)}
          </div>
        </div>
      </div>`;
    document.querySelector("#sign-out").addEventListener("click", signOut);
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session) renderAuthenticated(session);
  else renderLogin();
});
