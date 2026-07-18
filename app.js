import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "https://esm.sh/qrcode@1.5.4";
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
let labelBatch=[];
let labelSettings={preset:"collection",lengthMm:90,showQR:true,showLogo:true,showLocation:true};
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
      <main class="content content-with-nav professional-content">${content}</main>
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


function plantDirectURL(p){return `${location.origin}${location.pathname}?plant=${encodeURIComponent(p.accession)}`}
function labelSafeFilename(p,index=1){return `${String(p.accession||"plant").replace(/[^a-z0-9_-]/gi,"-")}-12mm-label-${index}.png`}
function fitCanvasText(ctx,text,maxWidth){let value=String(text||"");while(ctx.measureText(value).width>maxWidth&&value.length>8)value=value.slice(0,-2)+"…";return value}
async function createLabelCanvas(p,settings=labelSettings){
 const dpi=180,width=Math.max(425,Math.round((Number(settings.lengthMm)||90)/25.4*dpi)),height=Math.round(12/25.4*dpi),scale=3;
 const canvas=document.createElement("canvas");canvas.width=width*scale;canvas.height=height*scale;const ctx=canvas.getContext("2d");ctx.scale(scale,scale);ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);ctx.fillStyle="#111";ctx.textBaseline="middle";
 const margin=8,qrSize=settings.showQR?height-10:0,qrX=width-margin-qrSize,textRight=settings.showQR?qrX-8:width-margin,textWidth=textRight-margin;
 if(settings.showQR){const qr=await QRCode.toDataURL(plantDirectURL(p),{margin:0,width:qrSize*4,errorCorrectionLevel:"M"});const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=qr});ctx.drawImage(img,qrX,5,qrSize,qrSize)}
 if(settings.preset==="compact"){ctx.font="bold 16px Arial";ctx.fillText(String(p.accession||""),margin,22);ctx.font="bold 19px Arial";ctx.fillText(fitCanvasText(ctx,p.name||"Plant",textWidth),margin,54)}
 else if(settings.preset==="botanical"){ctx.font="bold 17px Arial";ctx.fillText(fitCanvasText(ctx,p.name||"Plant",textWidth),margin,23);ctx.font="bold 14px Arial";ctx.fillText(String(p.accession||""),margin,49);ctx.font="11px Arial";ctx.fillText(p.acquired_date?`Acquired ${fmtDate(p.acquired_date)}`:"Botanical collection",margin,70)}
 else if(settings.preset==="propagation"){ctx.font="bold 11px Arial";ctx.fillText("PROPAGATION",margin,10);ctx.font="bold 17px Arial";ctx.fillText(fitCanvasText(ctx,p.name||"Plant",textWidth),margin,31);ctx.font="bold 14px Arial";ctx.fillText(String(p.accession||""),margin,52);ctx.font="11px Arial";ctx.fillText(`Printed ${new Date().toLocaleDateString()}`,margin,70)}
 else {if(settings.showLogo){ctx.font="bold 9px Arial";ctx.fillText("ORCHARD COLLECTION",margin,8)}ctx.font="bold 17px Arial";ctx.fillText(fitCanvasText(ctx,p.name||"Plant",textWidth),margin,29);ctx.font="bold 14px Arial";ctx.fillText(String(p.accession||""),margin,50);if(settings.showLocation){ctx.font="11px Arial";ctx.fillText(fitCanvasText(ctx,val(p,["location","support"],""),textWidth),margin,69)}}
 return canvas
}
function readLabelControls(){labelSettings={preset:document.querySelector("#label-preset")?.value||"collection",lengthMm:Number(document.querySelector("#label-length")?.value||90),showQR:document.querySelector("#label-show-qr")?.checked??true,showLogo:document.querySelector("#label-show-logo")?.checked??true,showLocation:document.querySelector("#label-show-location")?.checked??true}}
async function refreshLabelPreview(p){const area=document.querySelector("#label-preview-area");if(!area)return;area.innerHTML='<div class="label-loading">Generating preview…</div>';const canvas=await createLabelCanvas(p,labelSettings);canvas.className="label-preview-canvas";area.innerHTML="";area.appendChild(canvas)}
async function shareCanvas(canvas,filename){const blob=await new Promise(r=>canvas.toBlob(r,"image/png",1));const file=new File([blob],filename,{type:"image/png"});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:"Orchard Collection label",text:"Open in Brother P-touch Design&Print 2 to print."})}else{const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast("Label downloaded")}}
function labelControlsHTML(){return `<div class="label-controls"><label>Label style<select id="label-preset"><option value="collection">Collection</option><option value="compact">Compact</option><option value="botanical">Botanical</option><option value="propagation">Propagation</option></select></label><label>Label length<select id="label-length"><option value="60">60 mm</option><option value="75">75 mm</option><option value="90" selected>90 mm</option><option value="110">110 mm</option></select></label><label class="toggle-row"><input id="label-show-qr" type="checkbox" checked><span>Include QR code</span></label><label class="toggle-row"><input id="label-show-logo" type="checkbox" checked><span>Include collection name</span></label><label class="toggle-row"><input id="label-show-location" type="checkbox" checked><span>Include location</span></label></div>`}
function openPlantLabelDesigner(p){modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal label-designer-modal"><div class="modal-header"><div><p class="eyebrow">Brother PT-P300BT</p><h2>12 mm label designer</h2></div><button class="icon-button" id="close-modal">×</button></div><div class="label-designer-layout"><div><div id="label-preview-area" class="label-preview-area"></div><p class="label-help">Share the finished PNG to Brother P-touch Design&Print 2 on your iPhone.</p></div>${labelControlsHTML()}</div><div class="modal-actions"><button class="ghost" id="cancel-modal">Cancel</button><button class="secondary" id="download-label">Save PNG</button><button class="primary" id="share-label">Share to Brother</button></div></div></div>`;document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;const update=()=>{readLabelControls();refreshLabelPreview(p)};["#label-preset","#label-length","#label-show-qr","#label-show-logo","#label-show-location"].forEach(s=>document.querySelector(s).onchange=update);document.querySelector("#download-label").onclick=async()=>{readLabelControls();await shareCanvas(await createLabelCanvas(p,labelSettings),labelSafeFilename(p))};document.querySelector("#share-label").onclick=document.querySelector("#download-label").onclick;refreshLabelPreview(p)}
function renderLabelCenter(){currentTab="labels";app.innerHTML=shell(`<a class="back-link" id="back-settings">← Settings</a><section class="screen-heading"><p class="eyebrow">Brother PT-P300BT</p><h1>Label Center</h1><p>Create print-ready 12 mm labels and send them to Brother’s iPhone app.</p></section><section class="label-center-hero"><div><strong>12 mm</strong><span>tape profile</span></div><div><strong>${plants.length}</strong><span>plants available</span></div><div><strong>4</strong><span>label styles</span></div></section><section class="dashboard-section"><div class="label-action-grid"><button id="single-label-action"><span>🏷️</span><strong>Single plant label</strong><small>Choose one plant and preview it</small></button><button id="batch-label-action"><span>🗂️</span><strong>Batch labels</strong><small>Select multiple plants and export them</small></button></div></section><section class="dashboard-section"><div class="section-heading"><div><p class="eyebrow">Quick label</p><h2>Recent plants</h2></div></div><div class="mini-card-row">${plants.slice(0,8).map(p=>`<button class="mini-plant-card" data-label-plant="${esc(p.accession)}"><span>${esc(p.accession)}</span><strong>${esc(p.name)}</strong><small>Create label</small></button>`).join("")}</div></section><section class="label-instructions"><h3>Printing workflow</h3><p>Generate the label, tap <strong>Share to Brother</strong>, open it in P-touch Design&Print 2, confirm 12 mm tape, and print.</p></section>`,"labels");bindShell();document.querySelector("#back-settings").onclick=()=>navigate("dashboard");document.querySelector("#single-label-action").onclick=openPlantPickerForLabel;document.querySelector("#batch-label-action").onclick=openBatchLabelPicker;document.querySelectorAll("[data-label-plant]").forEach(b=>b.onclick=()=>openPlantLabelDesigner(plants.find(p=>p.accession===b.dataset.labelPlant)))}
function openPlantPickerForLabel(){modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>Select a plant</h2><button class="icon-button" id="close-modal">×</button></div><input id="label-picker-search" type="search" placeholder="Search plants…"><div id="label-picker-results" class="picker-list"></div></div></div>`;document.querySelector("#close-modal").onclick=closeModal;const input=document.querySelector("#label-picker-search"),draw=()=>{const q=input.value.toLowerCase();document.querySelector("#label-picker-results").innerHTML=plants.filter(p=>`${p.accession} ${p.name}`.toLowerCase().includes(q)).slice(0,50).map(p=>`<button data-label-pick="${esc(p.accession)}"><strong>${esc(p.name)}</strong><span>${esc(p.accession)}</span></button>`).join("");document.querySelectorAll("[data-label-pick]").forEach(b=>b.onclick=()=>{const p=plants.find(x=>x.accession===b.dataset.labelPick);closeModal();openPlantLabelDesigner(p)})};input.oninput=draw;draw()}
function openBatchLabelPicker(){labelBatch=[];modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal care-queue-modal"><div class="modal-header"><div><p class="eyebrow">Batch labels</p><h2>Select plants</h2></div><button class="icon-button" id="close-modal">×</button></div><input id="batch-label-search" type="search" placeholder="Search plants…"><div class="queue-select-all"><label><input type="checkbox" id="select-all-labels"> Select all visible</label><span id="batch-label-count">0 selected</span></div><div id="batch-label-list" class="care-queue-list"></div><div class="modal-actions"><button class="ghost" id="cancel-modal">Cancel</button><button class="primary" id="continue-batch-labels">Continue</button></div></div></div>`;document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;const search=document.querySelector("#batch-label-search"),draw=()=>{const q=search.value.toLowerCase(),visible=plants.filter(p=>`${p.accession} ${p.name}`.toLowerCase().includes(q));document.querySelector("#batch-label-list").innerHTML=visible.map(p=>`<label class="care-queue-row"><input type="checkbox" value="${esc(p.id)}" ${labelBatch.includes(String(p.id))?"checked":""}><span><strong>${esc(p.name)}</strong><small>${esc(p.accession)}</small></span></label>`).join("");document.querySelectorAll("#batch-label-list input").forEach(cb=>cb.onchange=()=>{if(cb.checked&&!labelBatch.includes(cb.value))labelBatch.push(cb.value);if(!cb.checked)labelBatch=labelBatch.filter(x=>x!==cb.value);document.querySelector("#batch-label-count").textContent=`${labelBatch.length} selected`})};search.oninput=draw;draw();document.querySelector("#select-all-labels").onchange=e=>document.querySelectorAll("#batch-label-list input").forEach(cb=>{cb.checked=e.target.checked;cb.dispatchEvent(new Event("change"))});document.querySelector("#continue-batch-labels").onclick=()=>{if(!labelBatch.length)return showToast("Select at least one plant");openBatchLabelDesigner()}}
function openBatchLabelDesigner(){const chosen=plants.filter(p=>labelBatch.includes(String(p.id)));modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal label-designer-modal"><div class="modal-header"><div><p class="eyebrow">Batch export</p><h2>${chosen.length} labels</h2></div><button class="icon-button" id="close-modal">×</button></div>${labelControlsHTML()}<div class="batch-label-preview-list">${chosen.slice(0,12).map(p=>`<div><strong>${esc(p.name)}</strong><span>${esc(p.accession)}</span></div>`).join("")}</div><div class="modal-actions"><button class="ghost" id="cancel-modal">Cancel</button><button class="primary" id="export-batch-labels">Export all PNGs</button></div></div></div>`;document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;document.querySelector("#export-batch-labels").onclick=async()=>{readLabelControls();const btn=document.querySelector("#export-batch-labels");btn.disabled=true;btn.textContent="Generating…";const files=[];for(let i=0;i<chosen.length;i++){const c=await createLabelCanvas(chosen[i],labelSettings),blob=await new Promise(r=>c.toBlob(r,"image/png",1));files.push(new File([blob],labelSafeFilename(chosen[i],i+1),{type:"image/png"}))}if(navigator.canShare?.({files})){await navigator.share({files,title:"Orchard Collection labels"})}else{for(const file of files){const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}showToast(`${files.length} labels downloaded`)}btn.disabled=false;btn.textContent="Export all PNGs"}}

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
      <article class="settings-action" id="open-label-center"><div><strong>Brother Label Center</strong><span>Design and export 12 mm PT-P300BT labels</span></div><span>›</span></article>
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
  const nfc=`${location.origin}${location.pathname}?plant=${encodeURIComponent(p.accession)}`;
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

supabase.auth.onAuthStateChange((_event,s)=>s?renderAuthenticated(s):renderLogin());
