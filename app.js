import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "https://esm.sh/qrcode@1.5.4";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import { ORCHARD_DOMAINS, plantPublicURL } from "./src/services/production.js";

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
let labelBatch=[];
let appTheme=localStorage.getItem("oc-theme")||"dark";
let commandOpen=false;

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
function dueInfo(p,type,intervalField){
  const interval=Number(p[intervalField]); if(!interval)return null;
  const last=lastActivity(p.accession,type);
  if(!last)return {daysOverdue:0,label:"No previous log"};
  const elapsed=daysSince(last.occurred_at||last.created_at);
  const overdue=elapsed-interval;
  return {daysOverdue:overdue,label:overdue>0?`${overdue} day${overdue===1?"":"s"} overdue`:overdue===0?"Due today":`Due in ${Math.abs(overdue)} day${Math.abs(overdue)===1?"":"s"}`};
}
function latestPhotoAge(p){const photo=plantPhotos(p.accession)[0];return photo?daysSince(photo.taken_at||photo.created_at):null}
function stalePhotoPlants(){return plants.filter(p=>{const age=latestPhotoAge(p);return age===null||age>=60})}
function recentActivityFor(type,days=30){return activities.filter(a=>String(a.activity_type).toLowerCase()===type.toLowerCase()&&daysSince(a.occurred_at||a.created_at)<=days)}
function greeting(){const h=new Date().getHours();return h<12?"Good morning":h<18?"Good afternoon":"Good evening"}
function money(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat(undefined,{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(n):"—"}

function isMarketingHost(){
  return location.hostname==="orchardcollection.ca"||location.hostname==="www.orchardcollection.ca";
}

function renderMarketingSite(){
  document.title="Orchard Collection — Professional plant collection management";
  document.querySelector('meta[name="description"]')?.setAttribute("content","A professional collection manager for serious plant collectors, with care records, growth photography, QR and NFC links, and Brother label printing.");
  document.body.classList.add("marketing-body");
  app.innerHTML=`
    <div class="marketing-site">
      <header class="marketing-nav">
        <a class="marketing-brand" href="/" aria-label="Orchard Collection home"><img src="/logo-mark.svg" alt=""><span>Orchard Collection</span></a>
        <nav><a href="#features">Features</a><a href="#collectors">Built for collectors</a><a class="marketing-login" href="${ORCHARD_DOMAINS.app}">Launch app</a></nav>
      </header>
      <main>
        <section class="marketing-hero">
          <div class="marketing-hero-copy">
            <p class="marketing-kicker">Professional collection management</p>
            <h1>Your plants deserve more than a spreadsheet.</h1>
            <p class="marketing-lede">Document every specimen, care event, photograph, label and NFC tag in one private, collector-focused workspace.</p>
            <div class="marketing-cta-row"><a class="marketing-primary" href="${ORCHARD_DOMAINS.app}">Launch Orchard Collection</a><a class="marketing-secondary" href="#features">Explore features</a></div>
            <div class="marketing-trust"><span>Private by design</span><span>QR + NFC ready</span><span>Brother label workflows</span></div>
          </div>
          <div class="marketing-product" aria-label="Orchard Collection dashboard preview">
            <div class="product-window-bar"><i></i><i></i><i></i><span>app.orchardcollection.ca</span></div>
            <div class="product-preview-head"><div><small>Good afternoon</small><strong>Your collection</strong></div><b>OC</b></div>
            <div class="product-stat-grid"><article><span>Plants</span><strong>128</strong></article><article><span>Care today</span><strong>6</strong></article><article><span>Favorites</span><strong>24</strong></article></div>
            <div class="product-list"><div><i>🌿</i><span><strong>Monstera deliciosa ‘Albo’</strong><small>MON-0013 · Moss pole</small></span><em>Healthy</em></div><div><i>◉</i><span><strong>Hoya ETS-10 Splash</strong><small>HOY-0047 · Cabinet</small></span><em>Photo due</em></div><div><i>✦</i><span><strong>Optimara Little Ottawa</strong><small>AV-0018 · Wick watered</small></span><em>Water today</em></div></div>
          </div>
        </section>
        <section id="features" class="marketing-section">
          <div class="section-intro"><p class="marketing-kicker">Everything in its place</p><h2>Built around the way collectors actually work.</h2></div>
          <div class="feature-grid">
            <article><span>01</span><h3>Living plant records</h3><p>Keep accession numbers, provenance, substrate, location, value, notes and photographs together.</p></article>
            <article><span>02</span><h3>Care history</h3><p>Log watering, fertilizer, repotting, blooms and new growth with a chronological visual timeline.</p></article>
            <article><span>03</span><h3>Professional labels</h3><p>Design QR-ready botanical labels sized for Brother QL continuous rolls and batch printing.</p></article>
            <article><span>04</span><h3>Permanent NFC links</h3><p>Encode stable plant URLs using app.orchardcollection.ca so tags remain useful for years.</p></article>
          </div>
        </section>
        <section id="collectors" class="collector-banner"><div><p class="marketing-kicker">Collector-first</p><h2>From Hoyas and orchids to African violets, aroids and carnivorous plants.</h2></div><a class="marketing-primary" href="${ORCHARD_DOMAINS.app}">Open the app</a></section>
      </main>
      <footer class="marketing-footer"><div class="marketing-brand"><img src="/logo-mark.svg" alt=""><span>Orchard Collection</span></div><p>Designed in Niagara, Canada · © ${new Date().getFullYear()} Orchard Collection</p></footer>
    </div>`;
}

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
  const navItems=[
    ["dashboard","⌂","Dashboard"],
    ["collection","🌿","Collection"],
    ["labels","▰","Label Center"],
    ["favorites","♡","Favorites"],
    ["settings","⚙︎","Settings"]
  ];
  return `<div class="app-shell v3-shell" data-theme="${esc(appTheme)}">
    <aside class="sidebar">
      <div class="sidebar-brand"><img src="/logo-mark.svg" alt=""><div><strong>Orchard Collection</strong><span>Professional</span></div></div>
      <nav class="sidebar-nav">${navItems.map(([id,icon,label])=>`<button data-tab="${id}" class="${tab===id?"active":""}"><span>${icon}</span><b>${label}</b></button>`).join("")}</nav>
      <div class="sidebar-footer"><button id="command-button" class="command-trigger"><span>⌘</span><b>Command palette</b><kbd>⌘ K</kbd></button><button id="theme-toggle" class="theme-toggle">${appTheme==="dark"?"☀︎ Light mode":"◐ Dark mode"}</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar professional-topbar">
        <button id="mobile-menu" class="icon-button mobile-only">☰</button>
        <div class="brand mobile-brand"><img src="/logo-mark.svg" alt="" class="brand-logo"><div class="brand-copy"><strong>Orchard Collection</strong><span>Professional</span></div></div>
        <div class="topbar-actions"><button id="top-command" class="secondary compact">⌘ Search</button><button id="signout" class="secondary compact">Sign out</button></div>
      </header>
      <header class="mobile-appbar">
        <img src="/logo-mark.svg" alt="" class="mobile-appbar-logo">
        <div><small>Orchard Collection</small><strong>${esc(navItems.find(item=>item[0]===tab)?.[2]||"Collection")}</strong></div>
        <button id="mobile-search" class="mobile-appbar-action" aria-label="Search Orchard Collection">⌕</button>
      </header>
      <main class="content content-with-nav professional-content page-enter">${content}</main>
    </div>
    <nav class="bottom-nav professional-bottom-nav" aria-label="Primary navigation">
      <button data-tab="dashboard" class="${tab==="dashboard"?"active":""}"><span>⌂</span><b>Home</b></button>
      <button data-tab="collection" class="${tab==="collection"?"active":""}"><span>🌿</span><b>Plants</b></button>
      <button id="quick-add" class="quick-add-main" aria-label="Quick add"><span>＋</span></button>
      <button data-tab="labels" class="${tab==="labels"?"active":""}"><span>▰</span><b>Labels</b></button>
      <button data-tab="settings" class="${tab==="settings"?"active":""}"><span>⚙︎</span><b>Settings</b></button>
    </nav>
  </div>`;
}

function bindShell(){
  document.querySelector("#signout")?.addEventListener("click",()=>supabase.auth.signOut());
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>navigate(b.dataset.tab));
  document.querySelector("#quick-add")?.addEventListener("click",openQuickAdd);
  document.querySelector("#command-button")?.addEventListener("click",openCommandPalette);
  document.querySelector("#top-command")?.addEventListener("click",openCommandPalette);
  document.querySelector("#mobile-search")?.addEventListener("click",openCommandPalette);
  document.querySelector("#theme-toggle")?.addEventListener("click",toggleTheme);
  document.querySelector("#mobile-menu")?.addEventListener("click",()=>document.querySelector(".sidebar")?.classList.toggle("open"));
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


function toggleTheme(){
  appTheme=appTheme==="dark"?"light":"dark";
  localStorage.setItem("oc-theme",appTheme);
  document.documentElement.dataset.theme=appTheme;
  renderCurrent();
}
function openCommandPalette(){
  commandOpen=true;
  modalRoot.innerHTML=`<div class="command-backdrop"><section class="command-palette"><div class="command-search"><span>⌕</span><input id="command-input" autocomplete="off" placeholder="Search plants or run a command…"><kbd>esc</kbd></div><div id="command-results" class="command-results"></div><footer><span>↑↓ Navigate</span><span>↵ Open</span></footer></section></div>`;
  const input=document.querySelector("#command-input"),results=document.querySelector("#command-results");
  const commands=[
    {label:"Open Dashboard",hint:"Navigation",run:()=>navigate("dashboard")},
    {label:"Browse Collection",hint:"Navigation",run:()=>navigate("collection")},
    {label:"Open Label Center",hint:"Printing",run:()=>navigate("labels")},
    {label:"Add a new plant",hint:"Action",run:openAddPlant},
    {label:"Log plant care",hint:"Action",run:openQuickAdd},
    {label:"Show favorites",hint:"Collection",run:()=>navigate("favorites")},
    {label:"Toggle light/dark mode",hint:"Appearance",run:toggleTheme}
  ];
  let active=0,items=[];
  const draw=()=>{
    const q=input.value.trim().toLowerCase();
    const plantItems=plants.filter(p=>`${p.name} ${p.accession} ${p.genus||""}`.toLowerCase().includes(q)).slice(0,8).map(p=>({label:p.name,hint:p.accession,run:()=>openPlant(p.accession)}));
    items=(q?plantItems.concat(commands.filter(c=>c.label.toLowerCase().includes(q))):commands.concat(plants.slice(0,5).map(p=>({label:p.name,hint:p.accession,run:()=>openPlant(p.accession)})))).slice(0,12);
    active=Math.min(active,Math.max(0,items.length-1));
    results.innerHTML=items.map((it,i)=>`<button class="${i===active?"active":""}" data-command-index="${i}"><span><strong>${esc(it.label)}</strong><small>${esc(it.hint)}</small></span><b>↵</b></button>`).join("")||'<div class="empty-state">No matching plants or commands.</div>';
    results.querySelectorAll("button").forEach(b=>b.onclick=()=>execute(Number(b.dataset.commandIndex)));
  };
  const execute=i=>{const item=items[i];if(!item)return;closeModal();commandOpen=false;item.run()};
  input.oninput=()=>{active=0;draw()};
  input.onkeydown=e=>{if(e.key==="ArrowDown"){e.preventDefault();active=Math.min(active+1,items.length-1);draw()}if(e.key==="ArrowUp"){e.preventDefault();active=Math.max(active-1,0);draw()}if(e.key==="Enter"){e.preventDefault();execute(active)}if(e.key==="Escape"){closeModal();commandOpen=false}};
  document.querySelector(".command-backdrop").onclick=e=>{if(e.target.classList.contains("command-backdrop")){closeModal();commandOpen=false}};
  draw();setTimeout(()=>input.focus(),20);
}
window.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openCommandPalette()}
  if(e.key==="Escape"&&commandOpen){closeModal();commandOpen=false}
});
function renderCurrent(){
  if(currentTab==="collection")return renderCollectionScreen();
  if(currentTab==="labels")return renderLabelCenter();
  if(currentTab==="favorites")return renderFavorites();
  if(currentTab==="settings")return renderSettings();
  renderDashboard();
}

function renderDashboard(){
  const waterDue=duePlants("watered","water_every_days").sort((a,b)=>(dueInfo(b,"watered","water_every_days")?.daysOverdue||0)-(dueInfo(a,"watered","water_every_days")?.daysOverdue||0));
  const feedDue=duePlants("fertilized","fertilize_every_days").sort((a,b)=>(dueInfo(b,"fertilized","fertilize_every_days")?.daysOverdue||0)-(dueInfo(a,"fertilized","fertilize_every_days")?.daysOverdue||0));
  const blooming=recentActivityFor("bloom",30);
  const newLeaves=recentActivityFor("new leaf",30);
  const repots=recentActivityFor("repotted",30);
  const totalValue=plants.reduce((s,p)=>s+(Number(p.current_value)||Number(p.purchase_price)||0),0);
  const favorites=plants.filter(p=>p.favorite);
  const stalePhotos=stalePhotoPlants();
  const recentEvents=activities.slice(0,8);

  app.innerHTML=shell(`
    <section class="dashboard-welcome professional-hero">
      <p class="eyebrow">${esc(greeting())}</p>
      <h1>Your collection today.</h1>
      <p>${waterDue.length||feedDue.length?`${waterDue.length+feedDue.length} care task${waterDue.length+feedDue.length===1?"":"s"} need attention.`:"Everything is caught up."}</p>
    </section>

    <section class="dashboard-hero">
      <div><strong>${plants.length}</strong><span>plants documented</span></div>
      <div><strong>${money(totalValue)}</strong><span>estimated collection value</span></div>
    </section>

    <section class="dashboard-stats">
      <button class="dashboard-stat" id="open-water-queue"><span>💧</span><strong>${waterDue.length}</strong><small>Need water</small></button>
      <button class="dashboard-stat" id="open-feed-queue"><span>🧪</span><strong>${feedDue.length}</strong><small>Need fertilizer</small></button>
      <button class="dashboard-stat"><span>🌸</span><strong>${blooming.length}</strong><small>Blooms this month</small></button>
      <button class="dashboard-stat"><span>🌱</span><strong>${newLeaves.length}</strong><small>New leaves</small></button>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">Care queue</p><h2>Needs attention</h2></div><button class="ghost compact" id="batch-care">Batch log</button></div>
      <div class="smart-care-grid">
        <article class="smart-care-card">
          <div class="smart-care-head"><span>💧</span><div><strong>Watering</strong><small>${waterDue.length} due</small></div></div>
          <div class="smart-care-list">${waterDue.slice(0,5).map(p=>smartCareRow(p,"watered","water_every_days")).join("")||'<div class="empty-state compact-empty">Caught up</div>'}</div>
          ${waterDue.length?'<button class="secondary full-width" id="view-water-queue">View watering queue</button>':""}
        </article>
        <article class="smart-care-card">
          <div class="smart-care-head"><span>🧪</span><div><strong>Fertilizing</strong><small>${feedDue.length} due</small></div></div>
          <div class="smart-care-list">${feedDue.slice(0,5).map(p=>smartCareRow(p,"fertilized","fertilize_every_days")).join("")||'<div class="empty-state compact-empty">Caught up</div>'}</div>
          ${feedDue.length?'<button class="secondary full-width" id="view-feed-queue">View fertilizer queue</button>':""}
        </article>
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">This month</p><h2>Growth summary</h2></div></div>
      <div class="growth-summary">
        <article><span>🌸</span><strong>${blooming.length}</strong><small>Blooms logged</small></article>
        <article><span>🌱</span><strong>${newLeaves.length}</strong><small>New leaves</small></article>
        <article><span>🪴</span><strong>${repots.length}</strong><small>Repots</small></article>
        <article><span>📷</span><strong>${photos.filter(p=>daysSince(p.taken_at||p.created_at)<=30).length}</strong><small>Photos added</small></article>
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">Photo freshness</p><h2>Needs a new photo</h2></div><button class="ghost compact" id="view-photo-reminders">View all</button></div>
      <div class="mini-card-row">${stalePhotos.length?stalePhotos.slice(0,6).map(photoReminderCard).join(""):'<div class="empty-state">Every plant has a recent photo.</div>'}</div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">Highlights</p><h2>Favorite plants</h2></div><button class="ghost compact" id="view-favorites">View all</button></div>
      <div class="mini-card-row">${favorites.length?favorites.slice(0,5).map(miniCard).join(""):'<div class="empty-state">Tap the heart on a plant to add your first favorite.</div>'}</div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading"><div><p class="eyebrow">Latest</p><h2>Recent activity</h2></div></div>
      <div class="recent-activity-list">${recentEvents.length?recentEvents.map(recentActivityRow).join(""):'<div class="empty-state">No recent activity yet.</div>'}</div>
    </section>
  `,"dashboard");

  bindShell();
  document.querySelector("#open-water-queue")?.addEventListener("click",()=>openCareQueue("Watered","water_every_days"));
  document.querySelector("#open-feed-queue")?.addEventListener("click",()=>openCareQueue("Fertilized","fertilize_every_days"));
  document.querySelector("#view-water-queue")?.addEventListener("click",()=>openCareQueue("Watered","water_every_days"));
  document.querySelector("#view-feed-queue")?.addEventListener("click",()=>openCareQueue("Fertilized","fertilize_every_days"));
  document.querySelector("#batch-care")?.addEventListener("click",openBatchCareMenu);
  document.querySelector("#view-photo-reminders")?.addEventListener("click",openPhotoReminderQueue);
  document.querySelector("#view-favorites")?.addEventListener("click",()=>navigate("favorites"));
  document.querySelectorAll("[data-open-plant]").forEach(b=>b.onclick=()=>openPlant(b.dataset.openPlant));
  document.querySelectorAll("[data-quick-care]").forEach(b=>b.onclick=()=>quickLogSingle(b.dataset.quickCare,b.dataset.accession));
}
function smartCareRow(p,type,intervalField){
  const info=dueInfo(p,type,intervalField);
  return `<div class="smart-care-row"><button data-open-plant="${esc(p.accession)}"><strong>${esc(p.name)}</strong><small>${esc(info?.label||"Due")}</small></button><button class="care-check" data-quick-care="${type}" data-accession="${esc(p.accession)}">✓</button></div>`;
}
function photoReminderCard(p){
  const age=latestPhotoAge(p),img=imageURL(p);
  return `<button class="mini-plant-card ${img?"has-photo":""}" data-open-plant="${esc(p.accession)}" ${img?`style="background-image:url('${esc(img)}')"`:""}><span>${esc(p.accession)}</span><strong>${esc(p.name)}</strong><small>${age===null?"No photos yet":`${age} days since photo`}</small></button>`;
}
function recentActivityRow(a){
  const p=plants.find(x=>x.accession===a.plant_accession);
  return `<button class="recent-activity-row" data-open-plant="${esc(a.plant_accession)}"><span class="attention-icon">${iconFor(a.activity_type)}</span><span><strong>${esc(p?.name||a.plant_accession||"Plant")}</strong><small>${esc(a.activity_type||"Activity")} · ${esc(fmtDate(a.occurred_at||a.created_at))}</small></span><span>›</span></button>`;
}
function attentionRow(p,label,icon){
  return `<button class="attention-row" data-open-plant="${esc(p.accession)}"><span class="attention-icon">${icon}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.accession)} · ${esc(label)}</small></span><span>›</span></button>`;
}
function miniCard(p){
  const img=imageURL(p);
  return `<button class="mini-plant-card ${img?"has-photo":""}" data-open-plant="${esc(p.accession)}" ${img?`style="background-image:url('${esc(img)}')"`:""}><span>${esc(p.accession)}</span><strong>${esc(p.name)}</strong></button>`;
}


async function quickLogSingle(type,accession){
  const p=plants.find(x=>x.accession===accession); if(!p)return;
  const label=type.charAt(0).toUpperCase()+type.slice(1);
  const {data,error}=await supabase.from("activity_log").insert({owner_id:session.user.id,plant_id:p.id,plant_accession:p.accession,activity_type:label,notes:null,occurred_at:new Date().toISOString()}).select().single();
  if(error){showToast(error.message);return}
  activities.unshift(data);showToast(`${p.name} logged`);renderDashboard();
}
function openCareQueue(type,intervalField){
  const normalized=type.toLowerCase();
  const list=duePlants(normalized,intervalField).sort((a,b)=>(dueInfo(b,normalized,intervalField)?.daysOverdue||0)-(dueInfo(a,normalized,intervalField)?.daysOverdue||0));
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal care-queue-modal"><div class="modal-header"><div><p class="eyebrow">Care queue</p><h2>${esc(type)}</h2></div><button class="icon-button" id="close-modal">×</button></div><div class="queue-select-all"><label><input type="checkbox" id="select-all-care"> Select all</label><span>${list.length} due</span></div><div class="care-queue-list">${list.map(p=>{const info=dueInfo(p,normalized,intervalField);return `<label class="care-queue-row"><input type="checkbox" value="${esc(p.id)}"><span><strong>${esc(p.name)}</strong><small>${esc(p.accession)} · ${esc(info?.label||"Due")}</small></span></label>`}).join("")||'<div class="empty-state">Nothing due.</div>'}</div>${list.length?'<div class="modal-actions"><button class="ghost" id="cancel-modal">Cancel</button><button class="primary" id="log-selected-care">Log selected</button></div>':""}</div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelector("#cancel-modal")?.addEventListener("click",closeModal);
  document.querySelector("#select-all-care")?.addEventListener("change",e=>document.querySelectorAll(".care-queue-row input").forEach(cb=>cb.checked=e.target.checked));
  document.querySelector("#log-selected-care")?.addEventListener("click",async()=>{
    const ids=[...document.querySelectorAll(".care-queue-row input:checked")].map(x=>x.value);
    if(!ids.length){showToast("Select at least one plant");return}
    const chosen=plants.filter(p=>ids.includes(String(p.id)));
    const rows=chosen.map(p=>({owner_id:session.user.id,plant_id:p.id,plant_accession:p.accession,activity_type:type,notes:"Batch logged",occurred_at:new Date().toISOString()}));
    const button=document.querySelector("#log-selected-care");button.disabled=true;button.textContent="Saving…";
    const {data,error}=await supabase.from("activity_log").insert(rows).select();
    if(error){showToast(error.message);button.disabled=false;button.textContent="Log selected";return}
    activities.unshift(...data);closeModal();showToast(`${chosen.length} plants logged`);renderDashboard();
  });
}
function openBatchCareMenu(){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><div><p class="eyebrow">Batch care</p><h2>Choose an action</h2></div><button class="icon-button" id="close-modal">×</button></div><div class="quick-add-grid"><button id="batch-water">💧<span>Water plants</span></button><button id="batch-feed">🧪<span>Fertilize plants</span></button></div></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelector("#batch-water").onclick=()=>openCareQueue("Watered","water_every_days");
  document.querySelector("#batch-feed").onclick=()=>openCareQueue("Fertilized","fertilize_every_days");
}
function openPhotoReminderQueue(){
  const list=stalePhotoPlants().sort((a,b)=>(latestPhotoAge(b)??9999)-(latestPhotoAge(a)??9999));
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal care-queue-modal"><div class="modal-header"><div><p class="eyebrow">Photo reminders</p><h2>Needs a new photo</h2></div><button class="icon-button" id="close-modal">×</button></div><div class="picker-list">${list.map(p=>`<button data-pick-photo="${esc(p.accession)}"><strong>${esc(p.name)}</strong><span>${latestPhotoAge(p)===null?"No photo":`${latestPhotoAge(p)} days ago`}</span></button>`).join("")}</div></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelectorAll("[data-pick-photo]").forEach(b=>b.onclick=()=>{closeModal();openPlant(b.dataset.pickPhoto);setTimeout(()=>photoPicker.click(),250)});
}



const QL820_PROFILE={id:"ql820nwb",name:"Brother QL-820NWB",dpi:300,maxWidthMm:62,media:[12,29,38,50,54,62],continuous:true,cutter:true};
const LABEL_TEMPLATES={
  botanical:{name:"Botanical Collection",description:"Clean accession label with QR code",widthMm:62,lengthMm:90,elements:[
    {id:"brand",type:"text",field:"static",value:"ORCHARD COLLECTION",x:5,y:5,w:39,h:6,fontSize:3.2,weight:700,align:"left"},
    {id:"name",type:"text",field:"name",x:5,y:14,w:39,h:18,fontSize:6.2,weight:700,align:"left"},
    {id:"accession",type:"text",field:"accession",x:5,y:36,w:39,h:8,fontSize:4.8,weight:700,align:"left"},
    {id:"location",type:"text",field:"location",x:5,y:47,w:39,h:6,fontSize:3.1,weight:400,align:"left"},
    {id:"qr",type:"qr",field:"url",x:47,y:7,w:10,h:10}
  ]},
  display:{name:"Display Collection",description:"Large name for display plants",widthMm:62,lengthMm:100,elements:[
    {id:"name",type:"text",field:"name",x:5,y:8,w:67,h:24,fontSize:8,weight:700,align:"left"},
    {id:"accession",type:"text",field:"accession",x:5,y:38,w:42,h:8,fontSize:5,weight:600,align:"left"},
    {id:"location",type:"text",field:"location",x:5,y:49,w:42,h:7,fontSize:3.5,weight:400,align:"left"},
    {id:"qr",type:"qr",field:"url",x:77,y:7,w:17,h:17}
  ]},
  propagation:{name:"Propagation",description:"Mother plant and propagation date",widthMm:62,lengthMm:90,elements:[
    {id:"flag",type:"text",field:"static",value:"PROPAGATION",x:5,y:5,w:45,h:6,fontSize:3.2,weight:700,align:"left"},
    {id:"name",type:"text",field:"name",x:5,y:14,w:50,h:17,fontSize:6,weight:700,align:"left"},
    {id:"accession",type:"text",field:"accession",x:5,y:35,w:40,h:8,fontSize:4.8,weight:700,align:"left"},
    {id:"date",type:"text",field:"today",x:5,y:47,w:45,h:6,fontSize:3.2,weight:400,align:"left"},
    {id:"qr",type:"qr",field:"url",x:68,y:7,w:17,h:17}
  ]},
  qr:{name:"QR Access Tag",description:"Compact scan-first inventory label",widthMm:62,lengthMm:62,elements:[
    {id:"qr",type:"qr",field:"url",x:4,y:4,w:26,h:26},
    {id:"accession",type:"text",field:"accession",x:33,y:7,w:24,h:9,fontSize:5,weight:700,align:"left"},
    {id:"name",type:"text",field:"name",x:33,y:19,w:24,h:20,fontSize:4.1,weight:600,align:"left"}
  ]}
};
let labelDesigner={plant:null,templateKey:"botanical",template:null,selectedId:null,zoom:1,history:[],future:[],overrides:null};
let mobileStudioPanel=null;
function plantDirectURL(p){return `${location.origin}${location.pathname}?plant=${encodeURIComponent(p.accession)}`}
function cloneTemplate(t){return JSON.parse(JSON.stringify(t))}
function labelFieldValue(p,el){
  const overrides=labelDesigner.overrides||{};
  if(el.field==="static")return el.value||"";
  if(el.field==="url")return plantDirectURL(p);
  if(el.field==="today")return new Date().toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
  if(el.field==="location")return overrides.location??val(p,["location","support"],"Unassigned");
  if(el.field==="name")return overrides.name??String(p?.name??"");
  if(el.field==="accession")return overrides.accession??String(p?.accession??"");
  if(el.field==="acquired")return fmtDate(p.acquired_date);
  return String(p?.[el.field]??"");
}
function labelSafeFilename(p,index=1){return `${String(p.accession||"plant").replace(/[^a-z0-9_-]/gi,"-")}-QL820-${index}.png`}
function loadSavedTemplates(){try{return JSON.parse(localStorage.getItem("oc-label-templates")||"[]")}catch{return[]}}
function saveCustomTemplate(){
  const name=prompt("Template name",`${labelDesigner.template.name} Copy`);if(!name)return;
  const saved=loadSavedTemplates();saved.push({...cloneTemplate(labelDesigner.template),id:`custom-${Date.now()}`,name});
  localStorage.setItem("oc-label-templates",JSON.stringify(saved));showToast("Template saved");
}
function pushLabelHistory(){labelDesigner.history.push(JSON.stringify(labelDesigner.template));if(labelDesigner.history.length>40)labelDesigner.history.shift();labelDesigner.future=[]}
function undoLabel(){if(!labelDesigner.history.length)return;labelDesigner.future.push(JSON.stringify(labelDesigner.template));labelDesigner.template=JSON.parse(labelDesigner.history.pop());renderDesignerWorkspace()}
function redoLabel(){if(!labelDesigner.future.length)return;labelDesigner.history.push(JSON.stringify(labelDesigner.template));labelDesigner.template=JSON.parse(labelDesigner.future.pop());renderDesignerWorkspace()}
function selectTemplate(key,custom=null){
  labelDesigner.templateKey=key;labelDesigner.template=cloneTemplate(custom||LABEL_TEMPLATES[key]);labelDesigner.selectedId=null;labelDesigner.history=[];labelDesigner.future=[];renderDesignerWorkspace();
}
function labelRecentJobs(){try{return JSON.parse(localStorage.getItem("oc-label-recent")||"[]")}catch{return[]}}
function saveLabelRecent(p,templateKey="botanical"){
  const jobs=labelRecentJobs().filter(j=>j.accession!==p.accession);
  jobs.unshift({accession:p.accession,name:p.name,templateKey,printedAt:new Date().toISOString()});
  localStorage.setItem("oc-label-recent",JSON.stringify(jobs.slice(0,12)));
}
function simpleTemplateCard(key,t){return `<button class="simple-template-card" data-template-key="${esc(key)}"><div class="simple-template-preview ${esc(key)}"><span>${key==="qr"?"▦":"ORCHARD"}</span><strong>${key==="propagation"?"PROPAGATION":key==="display"?"Plant Name":"Plant Name"}</strong><small>${key==="qr"?"ACCESSION":"ACCESSION · LOCATION"}</small></div><div><strong>${esc(t.name)}</strong><small>${esc(t.description)}</small><em>${t.widthMm} × ${t.lengthMm} mm</em></div><b>›</b></button>`}
function renderLabelCenter(){
  currentTab="labels";
  const recent=labelRecentJobs().map(j=>({...j,plant:plants.find(p=>p.accession===j.accession)})).filter(j=>j.plant);
  app.innerHTML=shell(`<section class="simple-label-hero"><div><p class="eyebrow">Labels</p><h1>Label Center</h1><p>Create polished plant labels in seconds. Choose a plant, preview it, and print.</p></div><button id="quick-new-label" class="primary simple-create-label"><span>＋</span>Create new label</button></section>
  <section class="simple-printer-card"><div class="printer-icon">▰</div><div><strong>${QL820_PROFILE.name}</strong><small>62 mm continuous roll · System print</small></div><span class="simple-ready"><i></i>Ready</span><button id="printer-help" class="ghost compact">Settings</button></section>
  <section class="simple-label-actions"><button id="quick-label-action"><span>＋</span><div><strong>Quick label</strong><small>Choose one plant and print</small></div><b>›</b></button><button id="batch-label-action"><span>▦</span><div><strong>Batch labels</strong><small>Select several plants</small></div><b>›</b></button></section>
  <section class="simple-label-section"><div class="section-heading"><div><p class="eyebrow">Templates</p><h2>Choose a style</h2></div></div><div class="simple-template-list">${Object.entries(LABEL_TEMPLATES).map(([k,t])=>simpleTemplateCard(k,t)).join("")}</div></section>
  <section class="simple-label-section"><div class="section-heading"><div><p class="eyebrow">Recent</p><h2>Recent labels</h2></div></div><div class="simple-recent-labels">${recent.length?recent.slice(0,6).map(j=>`<button data-recent-label="${esc(j.accession)}" data-recent-template="${esc(j.templateKey||"botanical")}"><span class="picker-thumb">${imageURL(j.plant)?`<img src="${esc(imageURL(j.plant))}" alt="">`:"🌿"}</span><div><strong>${esc(j.plant.name)}</strong><small>${esc(j.plant.accession)} · ${new Date(j.printedAt).toLocaleDateString()}</small></div><b>Print again</b></button>`).join(""):`<div class="simple-empty"><span>▰</span><strong>No labels yet</strong><p>Your recently printed labels will appear here.</p></div>`}</div></section>`,'labels');
  bindShell();
  document.querySelector("#quick-new-label").onclick=openPlantPickerForLabel;
  document.querySelector("#quick-label-action").onclick=openPlantPickerForLabel;
  document.querySelector("#batch-label-action").onclick=openBatchLabelPicker;
  document.querySelector("#printer-help").onclick=openPrinterSetup;
  document.querySelectorAll("[data-template-key]").forEach(b=>b.onclick=()=>{labelDesigner.templateKey=b.dataset.templateKey;labelDesigner.template=cloneTemplate(LABEL_TEMPLATES[b.dataset.templateKey]);openPlantPickerForLabel()});
  document.querySelectorAll("[data-recent-label]").forEach(b=>b.onclick=()=>{const p=plants.find(x=>x.accession===b.dataset.recentLabel);labelDesigner.templateKey=b.dataset.recentTemplate;labelDesigner.template=cloneTemplate(LABEL_TEMPLATES[labelDesigner.templateKey]||LABEL_TEMPLATES.botanical);openPlantLabelDesigner(p)});
}
function openPrinterSetup(){modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal printer-setup-modal"><div class="modal-header"><div><p class="eyebrow">Printer profile</p><h2>Brother QL-820NWB</h2></div><button class="icon-button" id="close-modal">×</button></div><div class="printer-profile-detail"><div class="printer-illustration">QL</div><dl><div><dt>Resolution</dt><dd>300 dpi</dd></div><div><dt>Maximum media</dt><dd>62 mm</dd></div><div><dt>Media type</dt><dd>Continuous or die-cut</dd></div><div><dt>Output</dt><dd>System print / AirPrint</dd></div><div><dt>Cutter</dt><dd>Automatic</dd></div></dl></div><div class="callout"><strong>Before printing</strong><p>Connect the printer to the same Wi-Fi network as your phone or computer. The system print dialog handles printer discovery.</p></div><div class="modal-actions"><button class="primary" id="close-setup">Done</button></div></div></div>`;document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#close-setup").onclick=closeModal}
function openPlantPickerForLabel(){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal plant-picker-modal"><div class="modal-header"><div><p class="eyebrow">Label job</p><h2>Choose a plant</h2></div><button class="icon-button" id="close-modal">×</button></div><input id="label-picker-search" type="search" placeholder="Search names, accession numbers, or locations…"><div id="label-picker-results" class="picker-list label-picker-results"></div></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;const input=document.querySelector("#label-picker-search");
  const draw=()=>{const q=input.value.toLowerCase();document.querySelector("#label-picker-results").innerHTML=plants.filter(p=>`${p.accession} ${p.name} ${val(p,["location","support"],"")}`.toLowerCase().includes(q)).slice(0,80).map(p=>`<button data-label-pick="${esc(p.accession)}"><span class="picker-thumb">${imageURL(p)?`<img src="${esc(imageURL(p))}" alt="">`:"🌿"}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.accession)} · ${esc(val(p,["location","support"],"Unassigned"))}</small></span><b>›</b></button>`).join("");document.querySelectorAll("[data-label-pick]").forEach(b=>b.onclick=()=>{const p=plants.find(x=>x.accession===b.dataset.labelPick);closeModal();openPlantLabelDesigner(p)})};input.oninput=draw;draw();setTimeout(()=>input.focus(),50)
}
function openPlantLabelDesigner(p){
  if(!p)return;
  labelDesigner.plant=p;
  if(!labelDesigner.template)labelDesigner.template=cloneTemplate(LABEL_TEMPLATES[labelDesigner.templateKey]||LABEL_TEMPLATES.botanical);
  if(!labelDesigner.overrides||labelDesigner.overrides._plantId!==String(p.id)){
    labelDesigner.overrides={_plantId:String(p.id),name:String(p.name||""),accession:String(p.accession||""),location:String(val(p,["location","support"],"Unassigned"))};
  }
  const t=labelDesigner.template,o=labelDesigner.overrides;
  modalRoot.innerHTML=`<div class="label-quick-backdrop"><section class="label-quick-sheet"><header><button id="close-studio" class="icon-button">←</button><div><p class="eyebrow">Label preview</p><h2>${esc(o.name||p.name)}</h2></div><button id="quick-label-reset" class="ghost compact">Reset</button></header><main><div class="quick-label-stage"><div class="quick-label-paper" style="--quick-ratio:${t.lengthMm/t.widthMm}"><img id="quick-label-render" alt="Exact label preview"></div></div><div class="quick-label-editor"><label><span>Plant name</span><input id="label-edit-name" value="${esc(o.name)}"></label><div class="quick-label-editor-grid"><label><span>Accession</span><input id="label-edit-accession" value="${esc(o.accession)}"></label><label><span>Location</span><input id="label-edit-location" value="${esc(o.location)}"></label></div><label><span>Template</span><select id="quick-template-select">${Object.entries(LABEL_TEMPLATES).map(([k,v])=>`<option value="${k}" ${labelDesigner.templateKey===k?"selected":""}>${esc(v.name)}</option>`).join("")}</select></label></div></main><footer><button id="export-label" type="button" class="secondary">Save PNG</button><button id="print-label-now" type="button" class="primary">Print label</button></footer></section></div>`;

  document.querySelector("#close-studio").addEventListener("click",closeModal);
  const saveButton=document.querySelector("#export-label");
  const printButton=document.querySelector("#print-label-now");
  const nameInput=document.querySelector("#label-edit-name");
  const accessionInput=document.querySelector("#label-edit-accession");
  const locationInput=document.querySelector("#label-edit-location");
  const templateSelect=document.querySelector("#quick-template-select");

  let renderTimer;
  const updatePreview=()=>{
    labelDesigner.overrides.name=nameInput.value;
    labelDesigner.overrides.accession=accessionInput.value;
    labelDesigner.overrides.location=locationInput.value;
    clearTimeout(renderTimer);
    renderTimer=setTimeout(renderQuickLabelPreview,120);
  };
  [nameInput,accessionInput,locationInput].forEach(input=>input.addEventListener("input",updatePreview));

  templateSelect.addEventListener("change",()=>{
    labelDesigner.templateKey=templateSelect.value;
    labelDesigner.template=cloneTemplate(LABEL_TEMPLATES[templateSelect.value]);
    openPlantLabelDesigner(p);
  });

  document.querySelector("#quick-label-reset").addEventListener("click",()=>{
    labelDesigner.overrides={_plantId:String(p.id),name:String(p.name||""),accession:String(p.accession||""),location:String(val(p,["location","support"],"Unassigned"))};
    openPlantLabelDesigner(p);
  });

  saveButton.addEventListener("click",async()=>{
    await runLabelAction(saveButton,"Saving…",async()=>{
      await exportCurrentLabel();
      saveLabelRecent(p,labelDesigner.templateKey);
      showToast("Label saved");
    });
  });

  printButton.addEventListener("click",async()=>{
    await runLabelAction(printButton,"Preparing…",async()=>{
      await printCurrentLabel();
      saveLabelRecent(p,labelDesigner.templateKey);
    });
  });

  renderQuickLabelPreview();
}

async function runLabelAction(button,busyText,action){
  if(!button||button.disabled)return;
  const original=button.textContent;
  button.disabled=true;
  button.textContent=busyText;
  try{await action()}
  catch(error){console.error(error);showToast(error?.message||"Label action failed")}
  finally{button.disabled=false;button.textContent=original}
}

async function canvasToBlob(canvas){
  return await new Promise((resolve,reject)=>{
    if(canvas.toBlob){
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not create PNG")),"image/png",1);
      return;
    }
    try{
      fetch(canvas.toDataURL("image/png")).then(r=>r.blob()).then(resolve).catch(reject);
    }catch(error){reject(error)}
  });
}

async function exportCurrentLabel(){
  if(!labelDesigner.plant||!labelDesigner.template)throw new Error("No label is open");
  const canvas=await createProfessionalLabelCanvas(labelDesigner.plant,labelDesigner.template);
  const blob=await canvasToBlob(canvas);
  const filename=labelSafeFilename({...labelDesigner.plant,accession:labelDesigner.overrides?.accession||labelDesigner.plant.accession});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=filename;link.style.display="none";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
}

async function printCurrentLabel(){
  if(!labelDesigner.plant||!labelDesigner.template)throw new Error("No label is open");
  const t=labelDesigner.template;
  const printWindow=window.open("","_blank");
  if(!printWindow)throw new Error("Allow pop-ups to print labels");
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Orchard Collection label</title><style>@page{size:${t.lengthMm}mm ${t.widthMm}mm;margin:0}html,body{margin:0;padding:0;background:#fff}.label-page{width:${t.lengthMm}mm;height:${t.widthMm}mm;overflow:hidden}.label-page img{display:block;width:100%;height:100%;object-fit:fill}@media print{html,body{width:${t.lengthMm}mm;height:${t.widthMm}mm}}</style></head><body><div style="font:16px Arial;padding:20px">Preparing label…</div></body></html>`);
  printWindow.document.close();
  try{
    const canvas=await createProfessionalLabelCanvas(labelDesigner.plant,t);
    const dataURL=canvas.toDataURL("image/png");
    printWindow.document.body.innerHTML=`<section class="label-page"><img id="print-image" alt="Plant label"></section>`;
    const img=printWindow.document.querySelector("#print-image");
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=dataURL});
    printWindow.focus();
    setTimeout(()=>printWindow.print(),250);
  }catch(error){
    printWindow.close();
    throw error;
  }
}
function renderDesignerWorkspace(){
 const host=document.querySelector("#designer-workspace");if(!host)return;const t=labelDesigner.template,p=labelDesigner.plant,selected=t.elements.find(e=>e.id===labelDesigner.selectedId);
 host.innerHTML=`<div class="label-studio-grid"><aside class="studio-panel studio-left ${mobileStudioPanel==="tools"?"mobile-open":""}"><div class="mobile-sheet-handle"></div><div class="mobile-sheet-heading"><strong>Design tools</strong><button class="close-studio-sheet" aria-label="Close tools">×</button></div><div class="panel-section"><label>Template<select id="studio-template-select">${Object.entries(LABEL_TEMPLATES).map(([k,v])=>`<option value="${k}" ${labelDesigner.templateKey===k?"selected":""}>${esc(v.name)}</option>`).join("")}</select></label></div><div class="panel-section"><p class="panel-title">Add elements</p><div class="element-tool-grid"><button data-add-element="text">T<span>Text</span></button><button data-add-element="qr">▦<span>QR code</span></button><button data-add-element="line">—<span>Line</span></button><button data-add-element="box">□<span>Box</span></button></div></div><div class="panel-section"><p class="panel-title">Variables</p><div class="variable-list">${["name","accession","location","acquired","today"].map(f=>`<button data-add-variable="${f}">{${f}}</button>`).join("")}</div></div></aside><main class="studio-canvas-area"><div class="canvas-toolbar"><span>${t.widthMm} × ${t.lengthMm} mm</span><div><button id="zoom-out" class="ghost compact">−</button><b>${Math.round(labelDesigner.zoom*100)}%</b><button id="zoom-in" class="ghost compact">＋</button></div></div><div class="label-canvas-stage"><div id="label-design-canvas" class="label-design-canvas" style="--label-w:${t.lengthMm};--label-h:${t.widthMm};transform:scale(${labelDesigner.zoom})">${t.elements.map(el=>labelElementHTML(el,p)).join("")}</div></div><div class="canvas-footer"><span>Drag elements to position them. Changes are saved in this editing session.</span><span>${QL820_PROFILE.name} · 300 dpi</span></div></main><aside class="studio-panel studio-right ${mobileStudioPanel==="properties"?"mobile-open":""}"><div class="mobile-sheet-handle"></div><div class="mobile-sheet-heading"><strong>${selected?"Element settings":"Properties"}</strong><button class="close-studio-sheet" aria-label="Close properties">×</button></div>${selected?propertyPanelHTML(selected):`<div class="no-selection"><span>↖</span><strong>Select an element</strong><p>Choose an item on the label to edit its content, position, size, and typography.</p></div>`}</aside><nav class="studio-mobile-dock" aria-label="Label tools"><button data-mobile-studio="tools" class="${mobileStudioPanel==="tools"?"active":""}"><span>＋</span><b>Elements</b></button><button data-mobile-studio="template" class=""><span>▤</span><b>Template</b></button><button data-mobile-studio="properties" class="${mobileStudioPanel==="properties"?"active":""}"><span>⚙</span><b>Properties</b></button><button id="mobile-print-label"><span>⌁</span><b>Print</b></button></nav><div class="studio-sheet-scrim ${mobileStudioPanel?"show":""}"></div></div>`;
 bindDesignerEvents();
}
function labelElementHTML(el,p){
 const style=`left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;`;
 const cls=`design-element type-${el.type} ${labelDesigner.selectedId===el.id?"selected":""}`;
 if(el.type==="qr")return `<div class="${cls}" data-element-id="${el.id}" style="${style}"><div class="qr-placeholder" data-qr-for="${el.id}"></div><i class="resize-handle"></i></div>`;
 if(el.type==="line")return `<div class="${cls}" data-element-id="${el.id}" style="${style}"><span></span><i class="resize-handle"></i></div>`;
 if(el.type==="box")return `<div class="${cls}" data-element-id="${el.id}" style="${style}"><i class="resize-handle"></i></div>`;
 return `<div class="${cls}" data-element-id="${el.id}" style="${style};font-size:${el.fontSize||4}mm;font-weight:${el.weight||400};text-align:${el.align||"left"};justify-content:${el.align==="center"?"center":el.align==="right"?"flex-end":"flex-start"}"><span>${esc(labelFieldValue(p,el))}</span><i class="resize-handle"></i></div>`;
}
function propertyPanelHTML(el){return `<div class="panel-section"><div class="property-heading"><p class="panel-title">${pretty(el.type)} element</p><button id="delete-element" class="danger-text">Delete</button></div>${el.type==="text"?`<label>Content type<select id="prop-field">${["static","name","accession","location","acquired","today"].map(f=>`<option value="${f}" ${el.field===f?"selected":""}>${pretty(f)}</option>`).join("")}</select></label>${el.field==="static"?`<label>Text<input id="prop-value" value="${esc(el.value||"")}"></label>`:""}<label>Font size<input id="prop-font" type="range" min="2" max="12" step=".2" value="${el.fontSize||4}"><span>${el.fontSize||4} mm</span></label><label>Weight<select id="prop-weight"><option value="400" ${el.weight==400?"selected":""}>Regular</option><option value="600" ${el.weight==600?"selected":""}>Semibold</option><option value="700" ${el.weight==700?"selected":""}>Bold</option></select></label><label>Alignment<select id="prop-align"><option value="left" ${el.align==="left"?"selected":""}>Left</option><option value="center" ${el.align==="center"?"selected":""}>Center</option><option value="right" ${el.align==="right"?"selected":""}>Right</option></select></label>`:""}<div class="property-grid"><label>X<input id="prop-x" type="number" min="0" max="100" step=".5" value="${el.x}"></label><label>Y<input id="prop-y" type="number" min="0" max="100" step=".5" value="${el.y}"></label><label>Width<input id="prop-w" type="number" min="1" max="100" step=".5" value="${el.w}"></label><label>Height<input id="prop-h" type="number" min="1" max="100" step=".5" value="${el.h}"></label></div></div><div class="panel-section"><p class="panel-title">Label size</p><div class="property-grid"><label>Width<input id="label-width-mm" type="number" min="12" max="62" value="${labelDesigner.template.widthMm}"></label><label>Length<input id="label-length-mm" type="number" min="30" max="300" value="${labelDesigner.template.lengthMm}"></label></div></div>`}
function bindDesignerEvents(){
 const t=labelDesigner.template;
 document.querySelectorAll("[data-mobile-studio]").forEach(b=>b.onclick=()=>{const target=b.dataset.mobileStudio;if(target==="template"){mobileStudioPanel="tools";renderDesignerWorkspace();setTimeout(()=>document.querySelector("#studio-template-select")?.focus(),30);return}mobileStudioPanel=mobileStudioPanel===target?null:target;renderDesignerWorkspace()});
 document.querySelectorAll(".close-studio-sheet").forEach(b=>b.onclick=()=>{mobileStudioPanel=null;renderDesignerWorkspace()});
 document.querySelector(".studio-sheet-scrim")?.addEventListener("click",()=>{mobileStudioPanel=null;renderDesignerWorkspace()});
 document.querySelector("#mobile-print-label")?.addEventListener("click",printCurrentLabel);
 document.querySelector("#studio-template-select").onchange=e=>selectTemplate(e.target.value);
 document.querySelector("#zoom-in").onclick=()=>{labelDesigner.zoom=Math.min(1.6,labelDesigner.zoom+.1);renderDesignerWorkspace()};document.querySelector("#zoom-out").onclick=()=>{labelDesigner.zoom=Math.max(.5,labelDesigner.zoom-.1);renderDesignerWorkspace()};
 document.querySelectorAll("[data-add-element]").forEach(b=>b.onclick=()=>addDesignerElement(b.dataset.addElement));document.querySelectorAll("[data-add-variable]").forEach(b=>b.onclick=()=>addDesignerElement("text",b.dataset.addVariable));
 document.querySelectorAll("[data-element-id]").forEach(node=>{node.onpointerdown=e=>startElementDrag(e,node.dataset.elementId);node.onclick=e=>{e.stopPropagation();labelDesigner.selectedId=node.dataset.elementId;if(matchMedia("(max-width:760px)").matches)mobileStudioPanel="properties";renderDesignerWorkspace()}});
 document.querySelector("#label-design-canvas").onclick=()=>{labelDesigner.selectedId=null;renderDesignerWorkspace()};
 for(const el of t.elements.filter(x=>x.type==="qr"))renderQRPlaceholder(el);
 const selected=t.elements.find(e=>e.id===labelDesigner.selectedId);if(!selected)return;
 document.querySelector("#delete-element")?.addEventListener("click",()=>{pushLabelHistory();t.elements=t.elements.filter(e=>e.id!==selected.id);labelDesigner.selectedId=null;renderDesignerWorkspace()});
 const bind=(id,key,cast=v=>v)=>document.querySelector(id)?.addEventListener("change",e=>{pushLabelHistory();selected[key]=cast(e.target.value);renderDesignerWorkspace()});
 bind("#prop-field","field");bind("#prop-value","value");bind("#prop-font","fontSize",Number);bind("#prop-weight","weight",Number);bind("#prop-align","align");bind("#prop-x","x",Number);bind("#prop-y","y",Number);bind("#prop-w","w",Number);bind("#prop-h","h",Number);
 document.querySelector("#label-width-mm")?.addEventListener("change",e=>{pushLabelHistory();t.widthMm=Math.min(62,Math.max(12,Number(e.target.value)));renderDesignerWorkspace()});document.querySelector("#label-length-mm")?.addEventListener("change",e=>{pushLabelHistory();t.lengthMm=Math.min(300,Math.max(30,Number(e.target.value)));renderDesignerWorkspace()});
}
async function renderQRPlaceholder(el){const host=document.querySelector(`[data-qr-for="${el.id}"]`);if(!host)return;const data=await QRCode.toDataURL(plantDirectURL(labelDesigner.plant),{margin:0,width:256,errorCorrectionLevel:"M"});host.innerHTML=`<img src="${data}" alt="QR code">`}
function addDesignerElement(type,field="static"){pushLabelHistory();const id=`el-${Date.now()}`;const defaults=type==="text"?{id,type,field,value:field==="static"?"New text":"",x:10,y:15,w:40,h:10,fontSize:4,weight:600,align:"left"}:type==="qr"?{id,type,field:"url",x:70,y:10,w:20,h:20}:type==="line"?{id,type,x:10,y:50,w:50,h:2}:{id,type,x:10,y:10,w:30,h:25};labelDesigner.template.elements.push(defaults);labelDesigner.selectedId=id;renderDesignerWorkspace()}
function startElementDrag(e,id){
 if(e.target.classList.contains("resize-handle"))return startElementResize(e,id);e.preventDefault();e.stopPropagation();labelDesigner.selectedId=id;const canvas=document.querySelector("#label-design-canvas"),el=labelDesigner.template.elements.find(x=>x.id===id),rect=canvas.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,ox=el.x,oy=el.y;pushLabelHistory();
 const move=ev=>{el.x=Math.max(0,Math.min(100-el.w,ox+(ev.clientX-sx)/rect.width*100));el.y=Math.max(0,Math.min(100-el.h,oy+(ev.clientY-sy)/rect.height*100));const node=document.querySelector(`[data-element-id="${id}"]`);if(node){node.style.left=`${el.x}%`;node.style.top=`${el.y}%`}};const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);renderDesignerWorkspace()};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up)
}
function startElementResize(e,id){e.preventDefault();e.stopPropagation();const canvas=document.querySelector("#label-design-canvas"),el=labelDesigner.template.elements.find(x=>x.id===id),rect=canvas.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,ow=el.w,oh=el.h;pushLabelHistory();const move=ev=>{el.w=Math.max(3,Math.min(100-el.x,ow+(ev.clientX-sx)/rect.width*100));el.h=Math.max(3,Math.min(100-el.y,oh+(ev.clientY-sy)/rect.height*100));const node=document.querySelector(`[data-element-id="${id}"]`);if(node){node.style.width=`${el.w}%`;node.style.height=`${el.h}%`}};const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);renderDesignerWorkspace()};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up)}
async function createProfessionalLabelCanvas(p,template=labelDesigner.template){
 const scale=QL820_PROFILE.dpi/25.4;
 const canvas=document.createElement("canvas");
 canvas.width=Math.round(template.lengthMm*scale);
 canvas.height=Math.round(template.widthMm*scale);
 const ctx=canvas.getContext("2d",{alpha:false});
 ctx.fillStyle="#fff";
 ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle="#000";
 ctx.textBaseline="top";
 ctx.imageSmoothingEnabled=false;

 for(const el of template.elements){
  const x=el.x/100*canvas.width;
  const y=el.y/100*canvas.height;
  const w=el.w/100*canvas.width;
  const h=el.h/100*canvas.height;

  if(el.type==="qr"){
   const src=await QRCode.toDataURL(plantDirectURL(p),{
    margin:0,
    width:768,
    errorCorrectionLevel:"M",
    color:{dark:"#000000",light:"#ffffff"}
   });
   const img=new Image();
   await new Promise((resolve,reject)=>{
    img.onload=resolve;
    img.onerror=reject;
    img.src=src;
   });
   const size=Math.min(w,h);
   ctx.drawImage(img,x,y,size,size);
   continue;
  }

  if(el.type==="line"){
   ctx.fillRect(x,y,w,Math.max(2,h*.2));
   continue;
  }

  if(el.type==="box"){
   ctx.strokeStyle="#000";
   ctx.lineWidth=Math.max(2,scale*.25);
   ctx.strokeRect(x,y,w,h);
   continue;
  }

  const fitted=fitCanvasText(
   ctx,
   labelFieldValue(p,el),
   w,
   h,
   Math.max(2.2,Number(el.fontSize||4)),
   Number(el.weight||400),
   scale
  );

  ctx.font=`${Number(el.weight||400)} ${fitted.fontPx}px Arial, Helvetica, sans-serif`;
  ctx.textAlign=el.align||"left";
  ctx.textBaseline="top";

  const tx=el.align==="center"?x+w/2:el.align==="right"?x+w:x;
  fitted.lines.forEach((line,index)=>{
   ctx.fillText(line,tx,y+index*fitted.lineHeightPx);
  });
 }
 return canvas;
}

function fitCanvasText(ctx,text,maxWidth,maxHeight,fontMm,weight,scale){
 const content=String(text||"").trim();
 let currentMm=fontMm;
 let result={fontPx:currentMm*scale,lineHeightPx:currentMm*scale*1.08,lines:[content]};

 while(currentMm>=2.2){
  const fontPx=currentMm*scale;
  const lineHeightPx=fontPx*1.08;
  ctx.font=`${weight} ${fontPx}px Arial, Helvetica, sans-serif`;
  const lines=wrapCanvasLines(ctx,content,maxWidth);
  const allowed=Math.max(1,Math.floor((maxHeight+.5)/lineHeightPx));
  const allFit=lines.every(line=>ctx.measureText(line).width<=maxWidth+.5);

  result={fontPx,lineHeightPx,lines:lines.slice(0,allowed)};
  if(allFit&&lines.length<=allowed)return result;
  currentMm-=.2;
 }

 return result;
}

function wrapCanvasLines(ctx,text,maxWidth){
 const words=String(text||"").split(/\s+/).filter(Boolean);
 if(!words.length)return [""];
 const lines=[];
 let line="";

 for(const word of words){
  if(ctx.measureText(word).width>maxWidth){
   if(line){lines.push(line);line=""}
   let chunk="";
   for(const char of word){
    const test=chunk+char;
    if(ctx.measureText(test).width>maxWidth&&chunk){
     lines.push(chunk);
     chunk=char;
    }else{
     chunk=test;
    }
   }
   if(chunk)line=chunk;
   continue;
  }

  const test=line?`${line} ${word}`:word;
  if(ctx.measureText(test).width>maxWidth&&line){
   lines.push(line);
   line=word;
  }else{
   line=test;
  }
 }
 if(line)lines.push(line);
 return lines;
}

async function renderQuickLabelPreview(){
 const img=document.querySelector("#quick-label-render");
 if(!img||!labelDesigner.plant||!labelDesigner.template)return;
 img.removeAttribute("src");
 img.classList.add("is-loading");
 try{
  const canvas=await createProfessionalLabelCanvas(labelDesigner.plant,labelDesigner.template);
  if(!document.body.contains(img))return;
  img.src=canvas.toDataURL("image/png");
 }catch(error){
  console.error("Label preview failed",error);
  showToast("Could not render label preview");
 }finally{
  img.classList.remove("is-loading");
 }
}
function openBatchLabelDesigner(){
 const chosen=plants.filter(p=>labelBatch.includes(String(p.id)));const templates=Object.entries(LABEL_TEMPLATES);
 modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal batch-review-modal"><div class="modal-header"><div><p class="eyebrow">Batch job</p><h2>${chosen.length} labels ready</h2></div><button class="icon-button" id="close-modal">×</button></div><div class="batch-review-layout"><div><label>Template<select id="batch-template">${templates.map(([k,t])=>`<option value="${k}">${esc(t.name)}</option>`).join("")}</select></label><div class="batch-summary"><strong>${chosen.length}</strong><span>labels</span><strong>62 mm</strong><span>roll</span><strong>Auto</strong><span>cutting</span></div><p>The print document contains one correctly sized page per plant. Choose the QL-820NWB in the system print dialog.</p></div><div class="batch-label-preview-list">${chosen.slice(0,20).map(p=>`<div><strong>${esc(p.name)}</strong><span>${esc(p.accession)}</span></div>`).join("")}${chosen.length>20?`<p>+ ${chosen.length-20} more</p>`:""}</div></div><div class="modal-actions"><button class="ghost" id="cancel-modal">Cancel</button><button class="secondary" id="export-batch-labels">Export PNGs</button><button class="primary" id="print-batch-labels">Print batch</button></div></div></div>`;document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;
 document.querySelector("#export-batch-labels").onclick=async()=>{const key=document.querySelector("#batch-template").value,t=cloneTemplate(LABEL_TEMPLATES[key]);for(let i=0;i<chosen.length;i++){const c=await createProfessionalLabelCanvas(chosen[i],t),blob=await new Promise(r=>c.toBlob(r,"image/png",1)),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=labelSafeFilename(chosen[i],i+1);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}showToast(`${chosen.length} labels exported`)};
 document.querySelector("#print-batch-labels").onclick=async()=>{const key=document.querySelector("#batch-template").value,t=cloneTemplate(LABEL_TEMPLATES[key]),win=window.open("","_blank");if(!win)return showToast("Allow pop-ups to print");win.document.write(`<!doctype html><html><head><title>Orchard Collection batch labels</title><style>@page{size:${t.lengthMm}mm ${t.widthMm}mm;margin:0}html,body{margin:0}.label-page{width:${t.lengthMm}mm;height:${t.widthMm}mm;page-break-after:always;overflow:hidden}.label-page img{width:100%;height:100%;display:block}</style></head><body>`);for(const p of chosen){const c=await createProfessionalLabelCanvas(p,t);win.document.write(`<section class="label-page"><img src="${c.toDataURL("image/png")}"></section>`)}win.document.write(`<script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);win.document.close()}
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
      <button id="batch-labels" class="secondary compact">Print labels</button>
    </div>
    <section id="collection-results"></section>
  `,"collection");
  bindShell();
  const search=document.querySelector("#collection-search");
  search.oninput=()=>{collectionQuery=search.value;renderCollectionResults()};
  document.querySelector("#collection-sort").onchange=renderCollectionResults;
  document.querySelector("#toggle-view").onclick=()=>{collectionView=collectionView==="cards"?"locations":"cards";renderCollectionScreen()};
  document.querySelector("#batch-labels").onclick=openBatchLabelPicker;
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
      <article class="settings-action" id="open-label-center"><div><strong>Professional Label Center</strong><span>Design and print with the QL-820NWB</span></div><span>›</span></article>
      <article><div><strong>NFC links</strong><span>Direct plant URLs are active</span></div><span>✓</span></article>
      <article><div><strong>Collection export</strong><span>Coming in a later phase</span></div><span>Soon</span></article>
    </section>
  `,"settings");
  bindShell();
  document.querySelector("#settings-signout").onclick=()=>supabase.auth.signOut();
  document.querySelector("#open-label-center").onclick=renderLabelCenter;
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
  const nfc=plantPublicURL(p.accession);
  app.innerHTML=shell(`
    <a class="back-link" id="back-to-tab">← Back</a>
    <section class="detail-hero ${img?"has-photo":""}" ${img?`style="background-image:url('${esc(img)}')"`:""}>
      <button class="favorite-hero ${p.favorite?"is-favorite":""}" id="favorite-hero">${p.favorite?"♥":"♡"}</button>
      <div class="detail-title"><span class="accession">${esc(p.accession)}</span><h1>${esc(p.name)}</h1><p>${esc(val(p,["status"],"Active"))} · ${esc(val(p,["condition"],"Not rated"))}</p>
      <div class="detail-actions"><button id="edit-plant" class="primary">Edit plant</button><button id="print-label" class="secondary">Print label</button><button id="copy-nfc" class="secondary">Copy NFC link</button><button id="delete-plant" class="ghost">Delete</button></div></div>
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
  document.querySelector("#print-label").onclick=()=>openPlantLabelDesigner(p);
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

document.documentElement.dataset.theme=appTheme;

if(isMarketingHost()){
  renderMarketingSite();
}else{
  supabase.auth.onAuthStateChange((_event,s)=>s?renderAuthenticated(s):renderLogin());
}
