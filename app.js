import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

const app=document.querySelector("#app");
const toast=document.querySelector("#toast");
const modalRoot=document.querySelector("#modal-root");
const photoPicker=document.querySelector("#photo-picker");

let session=null;
let plants=[];
let activities=[];
let photos=[];
let currentPlant=null;
let collectionView="cards";
let currentTab="dashboard";
let collectionQuery="";

const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const val=(o,keys,fallback="Not recorded")=>{for(const k of keys)if(o?.[k]!==null&&o?.[k]!==undefined&&o?.[k]!=="")return o[k];return fallback};
const pretty=k=>k.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase());
const fmtDate=v=>{if(!v)return"Not recorded";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})};
const daysSince=v=>{if(!v)return null;const d=new Date(v);if(Number.isNaN(d.getTime()))return null;return Math.floor((Date.now()-d.getTime())/86400000)};
const iconFor=t=>({watered:"💧",fertilized:"🧪","new leaf":"🌱",bloom:"🌸",repotted:"🪴",propagated:"✂️",note:"📝",photo:"📷"}[String(t).toLowerCase()]||"•");

function showToast(m){toast.textContent=m;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2500)}
function closeModal(){modalRoot.innerHTML=""}
function imageURL(p){const own=photos.find(x=>x.plant_accession===p.accession)?.photo_url;return own||val(p,["hero_image","photo_url","image_url","cover_photo","primary_photo"],"")}
function plantActivities(accession){return activities.filter(x=>x.plant_accession===accession).sort((a,b)=>new Date(b.occurred_at||b.created_at)-new Date(a.occurred_at||a.created_at))}
function plantPhotos(accession){return photos.filter(x=>x.plant_accession===accession).sort((a,b)=>new Date(b.taken_at||b.created_at)-new Date(a.taken_at||a.created_at))}
function lastActivity(accession,type){return plantActivities(accession).find(x=>String(x.activity_type).toLowerCase()===type)}
function duePlants(type,intervalField){return plants.filter(p=>{const n=Number(p[intervalField]);if(!n)return false;const last=lastActivity(p.accession,type);if(!last)return true;return daysSince(last.occurred_at||last.created_at)>=n})}
function greeting(){const h=new Date().getHours();return h<12?"Good morning":h<18?"Good afternoon":"Good evening"}
function money(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat(undefined,{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(n):"—"}

function renderLogin(message=""){
  app.innerHTML=`<section class="auth-shell"><div class="auth-card">
    <img src="/logo-horizontal.svg" alt="Orchard Collection" class="login-logo">
    <p class="subtext">Sign in to open your private botanical collection.</p>
    <form id="login" class="form-grid">
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="primary">Sign in</button><div class="form-error">${esc(message)}</div>
    </form>
  </div></section>`;
  document.querySelector("#login").onsubmit=async e=>{
    e.preventDefault();
    const f=e.currentTarget,b=f.querySelector("button"),err=f.querySelector(".form-error"),d=new FormData(f);
    b.disabled=true;b.textContent="Signing in…";err.textContent="";
    const{error}=await supabase.auth.signInWithPassword({email:d.get("email"),password:d.get("password")});
    if(error){err.textContent=error.message;b.disabled=false;b.textContent="Sign in"}
  };
}

async function loadAll(){
  const [p,a,ph]=await Promise.all([
    supabase.from("plants").select("*").order("accession",{ascending:true}),
    supabase.from("activity_log").select("*").order("occurred_at",{ascending:false}),
    supabase.from("photos").select("*").order("taken_at",{ascending:false})
  ]);
  if(p.error)throw p.error;if(a.error)throw a.error;if(ph.error)throw ph.error;
  plants=p.data||[];activities=a.data||[];photos=ph.data||[];
}

function shell(content,tab=currentTab){
  return `<div class="app-shell">
    <header class="topbar">
      <div class="brand"><img src="/logo-mark.svg" alt="" class="brand-logo"><div class="brand-copy"><strong>Orchard Collection</strong><span>${esc(session?.user?.email||"")}</span></div></div>
      <button id="signout" class="secondary compact">Sign out</button>
    </header>
    <main class="content content-with-nav">${content}</main>
    <nav class="bottom-nav" aria-label="Primary navigation">
      <button data-tab="dashboard" class="${tab==="dashboard"?"active":""}"><span>⌂</span><b>Dashboard</b></button>
      <button data-tab="collection" class="${tab==="collection"?"active":""}"><span>🌿</span><b>Collection</b></button>
      <button id="quick-add" class="quick-add-main" aria-label="Quick add"><span>＋</span></button>
      <button data-tab="favorites" class="${tab==="favorites"?"active":""}"><span>♡</span><b>Favorites</b></button>
      <button data-tab="settings" class="${tab==="settings"?"active":""}"><span>⚙︎</span><b>Settings</b></button>
    </nav>
  </div>`;
}

function bindShell(){
  document.querySelector("#signout")?.addEventListener("click",()=>supabase.auth.signOut());
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>navigate(b.dataset.tab));
  document.querySelector("#quick-add")?.addEventListener("click",openQuickAdd);
}

function navigate(tab){
  currentTab=tab;
  currentPlant=null;
  const url=new URL(location.href);
  url.searchParams.delete("plant");
  url.hash=tab;
  history.pushState({}, "", url);
  renderCurrent();
}

window.addEventListener("popstate",()=>{
  const a=new URLSearchParams(location.search).get("plant");
  if(a){currentPlant=plants.find(p=>p.accession===a);renderPlantDetail(currentPlant);return}
  currentTab=(location.hash||"#dashboard").slice(1);
  renderCurrent();
});

function renderCurrent(){
  if(currentTab==="collection")return renderCollectionScreen();
  if(currentTab==="favorites")return renderFavorites();
  if(currentTab==="settings")return renderSettings();
  renderDashboard();
}

function renderDashboard(){
  const waterDue=duePlants("watered","water_every_days");
  const feedDue=duePlants("fertilized","fertilize_every_days");
  const recent=activities.filter(a=>daysSince(a.occurred_at||a.created_at)<=7);
  const blooming=activities.filter(a=>String(a.activity_type).toLowerCase()==="bloom"&&daysSince(a.occurred_at||a.created_at)<=30);
  const newLeaves=activities.filter(a=>String(a.activity_type).toLowerCase()==="new leaf"&&daysSince(a.occurred_at||a.created_at)<=30);
  const totalValue=plants.reduce((s,p)=>s+(Number(p.current_value)||Number(p.purchase_price)||0),0);
  const favorites=plants.filter(p=>p.favorite);
  const recentPlants=[...new Set(recent.map(a=>a.plant_accession))].map(a=>plants.find(p=>p.accession===a)).filter(Boolean).slice(0,5);

  app.innerHTML=shell(`
    <section class="dashboard-welcome">
      <p class="eyebrow">${esc(greeting())}</p>
      <h1>Welcome back.</h1>
      <p>Your collection is synced and ready.</p>
    </section>

    <section class="dashboard-hero">
      <div><strong>${plants.length}</strong><span>plants documented</span></div>
      <div><strong>${money(totalValue)}</strong><span>estimated collection value</span></div>
    </section>

    <section class="dashboard-stats">
      <button class="dashboard-stat" data-jump="water"><span>💧</span><strong>${waterDue.length}</strong><small>Need water</small></button>
      <button class="dashboard-stat" data-jump="feed"><span>🧪</span><strong>${feedDue.length}</strong><small>Need fertilizer</small></button>
      <button class="dashboard-stat"><span>🌸</span><strong>${blooming.length}</strong><small>Blooms this month</small></button>
      <button class="dashboard-stat"><span>🌱</span><strong>${newLeaves.length}</strong><small>New leaves</small></button>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">Today</p><h2>Needs attention</h2></div><button class="ghost compact" id="view-all-plants">View collection</button></div>
      <div class="attention-list">
        ${waterDue.slice(0,4).map(p=>attentionRow(p,"Water due","💧")).join("")}
        ${feedDue.slice(0,4).map(p=>attentionRow(p,"Fertilizer due","🧪")).join("")}
        ${!waterDue.length&&!feedDue.length?'<div class="empty-state">Everything is caught up today.</div>':""}
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">Highlights</p><h2>Favorite plants</h2></div><button class="ghost compact" id="view-favorites">View all</button></div>
      <div class="mini-card-row">${favorites.length?favorites.slice(0,5).map(miniCard).join(""):'<div class="empty-state">Tap the heart on a plant to add your first favorite.</div>'}</div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">Recently active</p><h2>Collection activity</h2></div></div>
      <div class="mini-card-row">${recentPlants.length?recentPlants.map(miniCard).join(""):'<div class="empty-state">Log care or add photos to populate recent activity.</div>'}</div>
    </section>
  `,"dashboard");
  bindShell();
  document.querySelector("#view-all-plants").onclick=()=>navigate("collection");
  document.querySelector("#view-favorites").onclick=()=>navigate("favorites");
  document.querySelectorAll("[data-open-plant]").forEach(b=>b.onclick=()=>openPlant(b.dataset.openPlant));
}

function attentionRow(p,label,icon){
  return `<button class="attention-row" data-open-plant="${esc(p.accession)}"><span class="attention-icon">${icon}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.accession)} · ${esc(label)}</small></span><span>›</span></button>`;
}
function miniCard(p){
  const img=imageURL(p);
  return `<button class="mini-plant-card ${img?"has-photo":""}" data-open-plant="${esc(p.accession)}" ${img?`style="background-image:url('${esc(img)}')"`:""}><span>${esc(p.accession)}</span><strong>${esc(p.name)}</strong></button>`;
}

function renderCollectionScreen(){
  app.innerHTML=shell(`
    <section class="screen-heading"><p class="eyebrow">Browse</p><h1>Collection</h1><p>Search, sort, and open any plant.</p></section>
    <div class="collection-toolbar">
      <input id="collection-search" type="search" value="${esc(collectionQuery)}" placeholder="Search plants, locations, media…">
      <select id="collection-sort">
        <option value="accession">Accession</option>
        <option value="name">Name</option>
        <option value="location">Location</option>
        <option value="condition">Condition</option>
      </select>
      <button id="toggle-view" class="secondary compact">${collectionView==="cards"?"Locations":"Cards"}</button>
    </div>
    <section id="collection-results"></section>
  `,"collection");
  bindShell();
  const search=document.querySelector("#collection-search");
  search.oninput=()=>{collectionQuery=search.value;renderCollectionResults()};
  document.querySelector("#collection-sort").onchange=renderCollectionResults;
  document.querySelector("#toggle-view").onclick=()=>{collectionView=collectionView==="cards"?"locations":"cards";renderCollectionScreen()};
  renderCollectionResults();
}

function filteredSortedPlants(){
  const term=collectionQuery.trim().toLowerCase();
  let list=plants.filter(p=>Object.values(p).some(v=>String(v??"").toLowerCase().includes(term)));
  const sort=document.querySelector("#collection-sort")?.value||"accession";
  list=[...list].sort((a,b)=>String(val(a,[sort],"")).localeCompare(String(val(b,[sort],""))));
  return list;
}

function renderCollectionResults(){
  const target=document.querySelector("#collection-results");
  const list=filteredSortedPlants();
  if(!list.length){target.innerHTML='<div class="empty-state">No matching plants.</div>';return}
  if(collectionView==="cards"){
    target.innerHTML=`<div class="plant-grid">${list.map(plantCard).join("")}</div>`;
  }else{
    const groups={};
    for(const p of list){const loc=val(p,["location","support"],"Unassigned");(groups[loc]??=[]).push(p)}
    target.innerHTML=Object.entries(groups).sort().map(([loc,items])=>`<section class="location-section"><div class="location-header"><h2>${esc(loc)}</h2><span>${items.length}</span></div><div class="plant-grid">${items.map(plantCard).join("")}</div></section>`).join("");
  }
  bindPlantCards();
}

function plantCard(p){
  const img=imageURL(p);
  return `<article class="plant-card ${img?"has-photo":""}" ${img?`style="background-image:url('${esc(img)}')"`:""}>
    <button class="favorite-toggle ${p.favorite?"is-favorite":""}" data-favorite="${esc(p.id)}" aria-label="Toggle favorite">${p.favorite?"♥":"♡"}</button>
    <button class="plant-card-open" data-open-plant="${esc(p.accession)}">
      <div class="card-top"><span class="accession">${esc(p.accession)}</span></div>
      <div class="card-body"><h2>${esc(p.name)}</h2><div class="card-meta"><span>${esc(val(p,["condition"],"Not rated"))}</span><span>${esc(val(p,["location","support"],"Unassigned"))}</span></div></div>
    </button>
  </article>`;
}
function bindPlantCards(){
  document.querySelectorAll("[data-open-plant]").forEach(b=>b.onclick=()=>openPlant(b.dataset.openPlant));
  document.querySelectorAll("[data-favorite]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.favorite)});
}

async function toggleFavorite(id){
  const p=plants.find(x=>String(x.id)===String(id));
  if(!p)return;
  const next=!p.favorite;
  const{data,error}=await supabase.from("plants").update({favorite:next}).eq("id",p.id).select().single();
  if(error){showToast(error.message);return}
  Object.assign(p,data);
  showToast(next?"Added to favorites":"Removed from favorites");
  renderCurrent();
}

function renderFavorites(){
  const favs=plants.filter(p=>p.favorite);
  app.innerHTML=shell(`
    <section class="screen-heading"><p class="eyebrow">Your showcase</p><h1>Favorites</h1><p>Rare plants, current obsessions, and specimens you want close at hand.</p></section>
    <section class="plant-grid">${favs.length?favs.map(plantCard).join(""):'<div class="empty-state">No favorites yet. Open Collection and tap a heart.</div>'}</section>
  `,"favorites");
  bindShell();bindPlantCards();
}

function renderSettings(){
  app.innerHTML=shell(`
    <section class="screen-heading"><p class="eyebrow">Preferences</p><h1>Settings</h1><p>Manage your account and collection behavior.</p></section>
    <section class="settings-list">
      <article><div><strong>Account</strong><span>${esc(session.user.email)}</span></div><button class="secondary compact" id="settings-signout">Sign out</button></article>
      <article><div><strong>Theme</strong><span>Orchard Forest</span></div><span>Active</span></article>
      <article><div><strong>Home Screen</strong><span>Standalone PWA enabled</span></div><span>✓</span></article>
      <article><div><strong>NFC links</strong><span>Direct plant URLs are active</span></div><span>✓</span></article>
      <article><div><strong>Collection export</strong><span>Coming in a later phase</span></div><span>Soon</span></article>
    </section>
  `,"settings");
  bindShell();
  document.querySelector("#settings-signout").onclick=()=>supabase.auth.signOut();
}

function openQuickAdd(){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal quick-add-modal">
    <div class="modal-header"><div><p class="eyebrow">Quick add</p><h2>What would you like to do?</h2></div><button class="icon-button" id="close-modal">×</button></div>
    <div class="quick-add-grid">
      <button data-quick="plant">＋<span>Add plant</span></button>
      <button data-quick="water">💧<span>Log watering</span></button>
      <button data-quick="photo">📷<span>Add photo</span></button>
      <button data-quick="leaf">🌱<span>New leaf</span></button>
      <button data-quick="bloom">🌸<span>Bloom</span></button>
      <button data-quick="repot">🪴<span>Repot</span></button>
    </div>
  </div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>handleQuickAction(b.dataset.quick));
}

function handleQuickAction(type){
  closeModal();
  if(type==="plant")return openAddPlantModal();
  const map={water:"Watered",photo:"Photo",leaf:"New Leaf",bloom:"Bloom",repot:"Repotted"};
  openPlantPicker(map[type]);
}

function openPlantPicker(action){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>Select a plant</h2><button class="icon-button" id="close-modal">×</button></div>
    <input id="picker-search" type="search" placeholder="Search plants…">
    <div id="picker-results" class="picker-list"></div>
  </div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  const input=document.querySelector("#picker-search");
  const draw=()=>{
    const term=input.value.toLowerCase();
    document.querySelector("#picker-results").innerHTML=plants.filter(p=>`${p.accession} ${p.name}`.toLowerCase().includes(term)).slice(0,30).map(p=>`<button data-pick="${esc(p.accession)}"><strong>${esc(p.name)}</strong><span>${esc(p.accession)}</span></button>`).join("");
    document.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{
      const p=plants.find(x=>x.accession===b.dataset.pick);closeModal();currentPlant=p;
      if(action==="Photo"){openPlant(p.accession);setTimeout(()=>photoPicker.click(),250)}
      else openActivityModal(action,p);
    });
  };
  input.oninput=draw;draw();
}

function openAddPlantModal(){
  const next=Math.max(0,...plants.map(p=>Number(String(p.accession||"").match(/\d+/)?.[0]||0)))+1;
  const accession=`HOYA-${String(next).padStart(4,"0")}`;
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>Add plant</h2><button class="icon-button" id="close-modal">×</button></div>
    <form id="add-plant-form" class="form-grid">
      <label>Accession<input name="accession" value="${accession}" required></label>
      <label>Plant name<input name="name" required></label>
      <label>Location<input name="location"></label>
      <label>Medium<input name="medium"></label>
      <label>Condition<input name="condition" value="Good"></label>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">Cancel</button><button class="primary">Add plant</button></div>
    </form>
  </div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#add-plant-form").onsubmit=async e=>{
    e.preventDefault();
    const f=e.currentTarget,b=f.querySelector(".primary"),d=new FormData(f);
    b.disabled=true;b.textContent="Adding…";
    const payload={owner_id:session.user.id,accession:d.get("accession"),name:d.get("name"),status:"Active",condition:d.get("condition")||null,location:d.get("location")||null,medium:d.get("medium")||null,favorite:false};
    const{data,error}=await supabase.from("plants").insert(payload).select().single();
    if(error){showToast(error.message);b.disabled=false;b.textContent="Add plant";return}
    plants.push(data);plants.sort((a,b)=>a.accession.localeCompare(b.accession));closeModal();showToast("Plant added");openPlant(data.accession);
  };
}

function openPlant(accession){
  const p=plants.find(x=>x.accession===accession);
  if(!p)return;
  currentPlant=p;
  const url=new URL(location.href);url.hash="";url.searchParams.set("plant",accession);history.pushState({}, "", url);
  renderPlantDetail(p);
}

function renderPlantDetail(p){
  if(!p)return;
  const img=imageURL(p),events=plantActivities(p.accession),pics=plantPhotos(p.accession);
  const nfc=`${location.origin}${location.pathname}?plant=${encodeURIComponent(p.accession)}`;
  app.innerHTML=shell(`
    <a class="back-link" id="back-to-tab">← Back</a>
    <section class="detail-hero ${img?"has-photo":""}" ${img?`style="background-image:url('${esc(img)}')"`:""}>
      <button class="favorite-hero ${p.favorite?"is-favorite":""}" id="favorite-hero">${p.favorite?"♥":"♡"}</button>
      <div class="detail-title"><span class="accession">${esc(p.accession)}</span><h1>${esc(p.name)}</h1><p>${esc(val(p,["status"],"Active"))} · ${esc(val(p,["condition"],"Not rated"))}</p>
      <div class="detail-actions"><button id="edit-plant" class="primary">Edit plant</button><button id="copy-nfc" class="secondary">Copy NFC link</button><button id="delete-plant" class="ghost">Delete</button></div></div>
    </section>
    <section class="quick-bar">
      ${["Watered","Fertilized","New Leaf","Bloom","Repotted"].map(x=>`<button class="quick-action" data-action="${x}"><b>${iconFor(x)}</b><span>${x}</span></button>`).join("")}
      <button class="quick-action" id="add-photo"><b>📷</b><span>Add photo</span></button>
    </section>
    <section class="detail-grid">
      <div class="stack">
        <article class="panel"><h3>Care snapshot</h3><div class="care-grid">
          <div class="care-card"><strong>${esc(val(p,["water_every_days"],"—"))}${p.water_every_days?" days":""}</strong><span>Watering interval</span></div>
          <div class="care-card"><strong>${esc(val(p,["fertilize_every_days"],"—"))}${p.fertilize_every_days?" days":""}</strong><span>Fertilizing interval</span></div>
          <div class="care-card"><strong>${esc(val(p,["peduncles"],0))}</strong><span>Peduncles</span></div>
          <div class="care-card"><strong>${esc(val(p,["location","support"],"Unassigned"))}</strong><span>Location</span></div>
        </div></article>
        <article class="panel"><h3>Timeline</h3><div class="timeline">${events.length?events.map(eventHTML).join(""):'<p class="subtext">No events yet.</p>'}</div></article>
      </div>
      <div class="stack">
        <article class="panel"><h3>Photo gallery</h3>${pics.length?`<div class="gallery">${pics.map(photoHTML).join("")}</div>`:'<p class="subtext">No photos yet.</p>'}</article>
        <article class="panel"><h3>Plant record</h3><div class="data-list">${recordRows(p)}</div></article>
        <article class="panel"><h3>NFC link</h3><div class="nfc-url">${esc(nfc)}</div></article>
      </div>
    </section>
  `,currentTab);
  bindShell();
  document.querySelector("#back-to-tab").onclick=()=>navigate(currentTab);
  document.querySelector("#favorite-hero").onclick=()=>toggleFavorite(p.id);
  document.querySelector("#copy-nfc").onclick=async()=>{await navigator.clipboard.writeText(nfc);showToast("Copied")};
  document.querySelector("#edit-plant").onclick=()=>openPlantEditModal(p);
  document.querySelector("#delete-plant").onclick=()=>confirmDeletePlant(p);
  document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>openActivityModal(b.dataset.action,p));
  document.querySelector("#add-photo").onclick=()=>photoPicker.click();
  document.querySelectorAll("[data-edit-event]").forEach(b=>b.onclick=()=>openEventEditModal(b.dataset.editEvent));
  document.querySelectorAll("[data-delete-event]").forEach(b=>b.onclick=()=>confirmDeleteEvent(b.dataset.deleteEvent));
  document.querySelectorAll("[data-delete-photo]").forEach(b=>b.onclick=e=>{e.stopPropagation();confirmDeletePhoto(b.dataset.deletePhoto)});
  document.querySelectorAll("[data-full]").forEach(img=>img.onclick=()=>openPhoto(img.dataset.full));
}

function eventHTML(e){return `<div class="event"><div class="event-icon">${iconFor(e.activity_type)}</div><div class="event-body"><strong>${esc(e.activity_type||"Activity")}</strong><time>${esc(fmtDate(e.occurred_at||e.created_at))}</time>${e.notes?`<p>${esc(e.notes)}</p>`:""}<div class="event-controls"><button class="mini-button" data-edit-event="${esc(e.id)}">Edit</button><button class="mini-button danger-button" data-delete-event="${esc(e.id)}">Delete</button></div></div></div>`}
function photoHTML(x){return `<div class="photo-tile"><img src="${esc(x.photo_url)}" alt="${esc(x.caption||"Plant photo")}" data-full="${esc(x.photo_url)}"><button class="photo-delete" data-delete-photo="${esc(x.id)}">×</button></div>`}
function recordRows(p){
  const keys=["genus","medium","support","location","fertilizer","purchase_price","current_value","acquired_date","notes"];
  return keys.filter(k=>p[k]!==null&&p[k]!==undefined&&p[k]!=="").map(k=>`<div class="data-row"><span>${esc(pretty(k))}</span><span>${esc(k.includes("price")||k.includes("value")?money(p[k]):p[k])}</span></div>`).join("")||'<p class="subtext">No additional information recorded.</p>';
}

function openActivityModal(type,p=currentPlant){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>${esc(type)}</h2><button class="icon-button" id="close-modal">×</button></div><form id="activity-form"><label>Optional note<textarea name="notes"></textarea></label><div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">Cancel</button><button class="primary">Save</button></div></form></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#activity-form").onsubmit=async e=>{
    e.preventDefault();const b=e.currentTarget.querySelector(".primary"),d=new FormData(e.currentTarget);b.disabled=true;b.textContent="Saving…";
    const{data,error}=await supabase.from("activity_log").insert({owner_id:session.user.id,plant_id:p.id,plant_accession:p.accession,activity_type:type,notes:d.get("notes")||null,occurred_at:new Date().toISOString()}).select().single();
    if(error){showToast(error.message);b.disabled=false;b.textContent="Save";return}
    activities.unshift(data);closeModal();showToast(`${type} logged`);renderPlantDetail(p);
  };
}

function openPlantEditModal(p){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>Edit plant</h2><button class="icon-button" id="close-modal">×</button></div><form id="plant-edit-form" class="form-grid">
    <label>Name<input name="name" value="${esc(p.name||"")}" required></label>
    <label>Status<input name="status" value="${esc(p.status||"Active")}"></label>
    <label>Condition<input name="condition" value="${esc(p.condition||"")}"></label>
    <label>Location<input name="location" value="${esc(p.location||"")}"></label>
    <label>Support<input name="support" value="${esc(p.support||"")}"></label>
    <label>Medium<input name="medium" value="${esc(p.medium||"")}"></label>
    <label>Water every (days)<input name="water_every_days" type="number" min="0" value="${esc(p.water_every_days??"")}"></label>
    <label>Fertilize every (days)<input name="fertilize_every_days" type="number" min="0" value="${esc(p.fertilize_every_days??"")}"></label>
    <label>Fertilizer<input name="fertilizer" value="${esc(p.fertilizer||"")}"></label>
    <label>Current value<input name="current_value" type="number" step=".01" min="0" value="${esc(p.current_value??"")}"></label>
    <label>Notes<textarea name="notes">${esc(p.notes||"")}</textarea></label>
    <div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">Cancel</button><button class="primary">Save changes</button></div>
  </form></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#plant-edit-form").onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget,b=f.querySelector(".primary"),d=new FormData(f);b.disabled=true;b.textContent="Saving…";
    const payload={name:d.get("name"),status:d.get("status")||null,condition:d.get("condition")||null,location:d.get("location")||null,support:d.get("support")||null,medium:d.get("medium")||null,water_every_days:d.get("water_every_days")===""?null:Number(d.get("water_every_days")),fertilize_every_days:d.get("fertilize_every_days")===""?null:Number(d.get("fertilize_every_days")),fertilizer:d.get("fertilizer")||null,current_value:d.get("current_value")===""?null:Number(d.get("current_value")),notes:d.get("notes")||null,updated_at:new Date().toISOString()};
    const{data,error}=await supabase.from("plants").update(payload).eq("id",p.id).select().single();
    if(error){showToast(error.message);b.disabled=false;b.textContent="Save changes";return}
    Object.assign(p,data);closeModal();showToast("Plant updated");renderPlantDetail(p);
  };
}

function openEventEditModal(id){
  const e=activities.find(x=>String(x.id)===String(id));if(!e)return;
  const when=(e.occurred_at||e.created_at||new Date().toISOString()).slice(0,16);
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>Edit entry</h2><button class="icon-button" id="close-modal">×</button></div><form id="event-edit-form" class="form-grid"><label>Type<input name="activity_type" value="${esc(e.activity_type||"")}"></label><label>Date<input name="occurred_at" type="datetime-local" value="${esc(when)}"></label><label>Notes<textarea name="notes">${esc(e.notes||"")}</textarea></label><div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">Cancel</button><button class="primary">Save</button></div></form></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#event-edit-form").onsubmit=async ev=>{
    ev.preventDefault();const d=new FormData(ev.currentTarget),b=ev.currentTarget.querySelector(".primary");b.disabled=true;
    const{data,error}=await supabase.from("activity_log").update({activity_type:d.get("activity_type")||"Activity",notes:d.get("notes")||null,occurred_at:new Date(d.get("occurred_at")).toISOString()}).eq("id",e.id).select().single();
    if(error){showToast(error.message);b.disabled=false;return}
    Object.assign(e,data);closeModal();showToast("Entry updated");renderPlantDetail(currentPlant);
  };
}

function confirmationModal(title,message,label,fn){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>${esc(title)}</h2><button class="icon-button" id="close-modal">×</button></div><p class="subtext">${esc(message)}</p><div class="modal-actions"><button class="ghost" id="cancel-modal">Cancel</button><button class="primary danger-confirm" id="confirm-delete">${esc(label)}</button></div></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;document.querySelector("#confirm-delete").onclick=fn;
}
function confirmDeleteEvent(id){const e=activities.find(x=>String(x.id)===String(id));confirmationModal("Delete entry","This cannot be undone.","Delete",async()=>{const{error}=await supabase.from("activity_log").delete().eq("id",e.id);if(error)return showToast(error.message);activities=activities.filter(x=>x.id!==e.id);closeModal();renderPlantDetail(currentPlant)})}
function confirmDeletePhoto(id){const p=photos.find(x=>String(x.id)===String(id));confirmationModal("Delete photo","The file and gallery record will be removed.","Delete",async()=>{if(p.storage_path){const r=await supabase.storage.from("plant-photos").remove([p.storage_path]);if(r.error)return showToast(r.error.message)}const{error}=await supabase.from("photos").delete().eq("id",p.id);if(error)return showToast(error.message);photos=photos.filter(x=>x.id!==p.id);closeModal();renderPlantDetail(currentPlant)})}
function confirmDeletePlant(p){confirmationModal("Delete plant",`Delete ${p.accession} and its history?`,"Delete plant",async()=>{const paths=plantPhotos(p.accession).map(x=>x.storage_path).filter(Boolean);if(paths.length){const r=await supabase.storage.from("plant-photos").remove(paths);if(r.error)return showToast(r.error.message)}await supabase.from("activity_log").delete().eq("plant_id",p.id);await supabase.from("photos").delete().eq("plant_id",p.id);const{error}=await supabase.from("plants").delete().eq("id",p.id);if(error)return showToast(error.message);plants=plants.filter(x=>x.id!==p.id);activities=activities.filter(x=>x.plant_id!==p.id);photos=photos.filter(x=>x.plant_id!==p.id);closeModal();navigate("collection")})}
function openPhoto(url){modalRoot.innerHTML=`<div class="modal-backdrop" id="photo-backdrop"><div class="modal photo-modal"><img src="${esc(url)}"></div></div>`;document.querySelector("#photo-backdrop").onclick=e=>{if(e.target.id==="photo-backdrop")closeModal()}}

photoPicker.addEventListener("change",async()=>{
  const file=photoPicker.files?.[0];if(!file||!currentPlant)return;
  if(!file.size){showToast("The selected image is empty.");photoPicker.value="";return}
  try{
    const bytes=await file.arrayBuffer();const mime=file.type||"image/jpeg";const blob=new Blob([bytes],{type:mime});
    const safe=(file.name||`photo-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g,"-");
    const path=`${session.user.id}/${currentPlant.accession}/${Date.now()}-${safe}`;
    showToast("Uploading photo…");
    const up=await supabase.storage.from("plant-photos").upload(path,blob,{contentType:mime,cacheControl:"3600"});
    if(up.error)throw up.error;
    const{data:pub}=supabase.storage.from("plant-photos").getPublicUrl(path);
    const ins=await supabase.from("photos").insert({owner_id:session.user.id,plant_id:currentPlant.id,plant_accession:currentPlant.accession,photo_url:pub.publicUrl,storage_path:path,taken_at:new Date().toISOString()}).select().single();
    if(ins.error)throw ins.error;photos.unshift(ins.data);
    const act=await supabase.from("activity_log").insert({owner_id:session.user.id,plant_id:currentPlant.id,plant_accession:currentPlant.accession,activity_type:"Photo",notes:"Photo added",occurred_at:new Date().toISOString()}).select().single();
    if(!act.error)activities.unshift(act.data);
    showToast("Photo added");renderPlantDetail(currentPlant);
  }catch(e){showToast(e.message||"Upload failed")}finally{photoPicker.value=""}
});

async function renderAuthenticated(s){
  session=s;
  app.innerHTML=`<section class="loading-screen"><img src="/logo-mark.svg" alt="Orchard Collection" class="splash-logo"><p>Loading your collection…</p></section>`;
  try{
    await loadAll();
    const accession=new URLSearchParams(location.search).get("plant");
    if(accession){currentPlant=plants.find(p=>p.accession===accession);renderPlantDetail(currentPlant)}
    else{currentTab=(location.hash||"#dashboard").slice(1);renderCurrent()}
  }catch(e){
    app.innerHTML=`<section class="loading-screen"><p>${esc(e.message)}</p></section>`;
  }
}

supabase.auth.onAuthStateChange((_event,s)=>s?renderAuthenticated(s):renderLogin());
