import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

const app=document.querySelector("#app");
const toast=document.querySelector("#toast");
let plants=[];

const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const pretty=k=>k.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase());
const val=(o,keys,fallback="Not recorded")=>{
  for(const k of keys) if(o[k]!==null&&o[k]!==undefined&&o[k]!=="") return o[k];
  return fallback;
};
const fmtDate=v=>{
  if(!v) return "Not recorded";
  const d=new Date(v); return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
};
function showToast(m){toast.textContent=m;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2400)}

function login(message=""){
  app.innerHTML=`<section class="auth-shell"><div class="auth-card">
    <p class="eyebrow">Private plant archive</p><h1>Orchard Collection</h1>
    <p class="subtext">Sign in to open your live collection.</p>
    <form id="login" class="form-grid">
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="primary">Sign in</button><div class="form-error">${esc(message)}</div>
    </form></div></section>`;
  document.querySelector("#login").addEventListener("submit",async e=>{
    e.preventDefault();const f=e.currentTarget,b=f.querySelector("button"),err=f.querySelector(".form-error"),d=new FormData(f);
    b.disabled=true;b.textContent="Signing in…";err.textContent="";
    const {error}=await supabase.auth.signInWithPassword({email:d.get("email"),password:d.get("password")});
    if(error){err.textContent=error.message;b.disabled=false;b.textContent="Sign in"}
  });
}
function header(email=""){return `<header class="topbar"><div class="brand"><div class="brand-mark">OC</div><div class="brand-copy"><strong>Orchard Collection</strong><span>${esc(email)}</span></div></div><button id="signout" class="secondary">Sign out</button></header>`}
async function load(){const {data,error}=await supabase.from("plants").select("*").order("accession",{ascending:true});if(error)throw error;plants=data||[]}
function summary(p){return{medium:val(p,["medium"],"Medium not recorded"),status:val(p,["status"],"Active"),location:val(p,["location","support"],"Location not recorded")}}

function dashboard(user){
  const active=plants.filter(p=>String(p.status||"").toLowerCase()!=="inactive").length;
  const variegated=plants.filter(p=>p.variegated===true||String(p.variegated).toLowerCase()==="true").length;
  const peduncles=plants.reduce((s,p)=>s+(Number(p.peduncles)||0),0);
  app.innerHTML=`<div>${header(user.email)}<div class="content">
    <section class="hero"><div><p class="eyebrow">Live Supabase collection</p><h1>Your plants, beautifully documented.</h1><p>Open any card to view its full botanical profile, care information, notes, database history, and NFC-ready link.</p></div><aside class="hero-panel"><div class="big-number">${plants.length}</div><span>plants in Orchard Collection</span></aside></section>
    <section class="stats"><div class="stat"><strong>${active}</strong><span>Active plants</span></div><div class="stat"><strong>${variegated}</strong><span>Variegated plants</span></div><div class="stat"><strong>${peduncles}</strong><span>Recorded peduncles</span></div><div class="stat"><strong>${new Set(plants.map(p=>p.medium).filter(Boolean)).size}</strong><span>Growing media</span></div></section>
    <div class="toolbar"><div class="search-wrap"><input id="search" type="search" placeholder="Search your collection…"></div></div>
    <section id="grid" class="plant-grid"></section>
  </div></div>`;
  document.querySelector("#signout").onclick=()=>supabase.auth.signOut();
  const s=document.querySelector("#search");s.oninput=()=>cards(s.value);cards("");
}
function cards(q){
  const term=q.trim().toLowerCase(),grid=document.querySelector("#grid");
  const f=plants.filter(p=>Object.values(p).some(v=>String(v??"").toLowerCase().includes(term)));
  if(!f.length){grid.innerHTML=`<div class="empty">No plants match “${esc(q)}”.</div>`;return}
  grid.innerHTML=f.map(p=>{const s=summary(p);return `<a class="plant-card" href="?plant=${encodeURIComponent(p.accession)}"><div class="card-top"><span class="accession">${esc(p.accession||"UNASSIGNED")}</span><span class="status-dot"></span></div><div class="card-body"><h2>${esc(p.name||"Unnamed plant")}</h2><div class="card-meta"><span>${esc(s.status)}</span><span>${esc(s.medium)}</span><span>${esc(s.location)}</span></div></div></a>`}).join("");
}
function imageURL(p){return val(p,["hero_image","photo_url","image_url","cover_photo","primary_photo"],"")}
function detail(user,p){
  if(!p){app.innerHTML=`<div>${header(user.email)}<div class="content detail-shell"><a class="back-link" href="./">← Back to collection</a><div class="error-panel">Plant not found.</div></div></div>`;document.querySelector("#signout").onclick=()=>supabase.auth.signOut();return}
  const img=imageURL(p),nfc=`${location.origin}${location.pathname}?plant=${encodeURIComponent(p.accession)}`;
  const water=val(p,["water_every_days","watering_interval"],"—");
  const fert=val(p,["fertilize_every_days","fertilizer_interval"],"—");
  const ped=val(p,["peduncles"],0);
  const condition=val(p,["condition"],"Not recorded");
  const notes=val(p,["notes","care_notes","description"],"No notes have been added yet.");
  const hidden=new Set(["id","owner_id","created_at","updated_at","name","accession","notes","care_notes","description","hero_image","photo_url","image_url","cover_photo","primary_photo","water_every_days","watering_interval","fertilize_every_days","fertilizer_interval","peduncles","condition"]);
  const rows=Object.entries(p).filter(([k,v])=>!hidden.has(k)&&v!==null&&v!==""&&!Array.isArray(v)&&typeof v!=="object").map(([k,v])=>`<div class="data-row"><span>${esc(pretty(k))}</span><span>${esc(typeof v==="boolean"?(v?"Yes":"No"):v)}</span></div>`).join("");
  app.innerHTML=`<div>${header(user.email)}<div class="content detail-shell">
    <a class="back-link" href="./">← Back to collection</a>
    <section class="detail-hero ${img?"has-photo":""}" ${img?`style="background-image:url('${esc(img)}')"`:""}>
      <div class="detail-title"><span class="accession">${esc(p.accession)}</span><h1>${esc(p.name||"Unnamed plant")}</h1><p>${esc(val(p,["status"],"Active"))} · ${esc(condition)}</p>
      <div class="detail-actions"><button id="copy-nfc" class="action-button">Copy NFC link</button><button id="copy-accession" class="action-button">Copy accession</button></div></div>
    </section>
    <section class="detail-grid">
      <div class="stack">
        <article class="panel"><h3>Care snapshot</h3><div class="care-grid">
          <div class="care-card"><strong>${esc(water==="—"?"—":water+" days")}</strong><span>Watering interval</span></div>
          <div class="care-card"><strong>${esc(fert==="—"?"—":fert+" days")}</strong><span>Fertilizing interval</span></div>
          <div class="care-card"><strong>${esc(ped)}</strong><span>Peduncles</span></div>
          <div class="care-card"><strong>${esc(condition)}</strong><span>Current condition</span></div>
        </div></article>
        <article class="panel"><h3>Plant record</h3><div class="data-list">${rows||'<p class="subtext">No additional record fields are populated yet.</p>'}</div></article>
        <article class="panel"><h3>Notes</h3><div class="note-box">${esc(notes)}</div></article>
      </div>
      <div class="stack">
        <article class="panel"><h3>Database history</h3><div class="data-list">
          <div class="data-row"><span>Created</span><span>${esc(fmtDate(p.created_at))}</span></div>
          <div class="data-row"><span>Last updated</span><span>${esc(fmtDate(p.updated_at))}</span></div>
          <div class="data-row"><span>Owner protected</span><span>Yes</span></div>
        </div></article>
        <article class="panel"><h3>NFC plant link</h3><div class="nfc-box"><div class="nfc-url">${esc(nfc)}</div><button id="copy-nfc-2" class="primary">Copy plant link</button></div></article>
        <article class="panel"><h3>Next upgrade</h3><p class="subtext">Photo galleries and one-tap care logging will be added after this profile layout is confirmed on desktop and mobile.</p></article>
      </div>
    </section>
  </div></div>`;
  document.querySelector("#signout").onclick=()=>supabase.auth.signOut();
  const copy=async text=>{await navigator.clipboard.writeText(text);showToast("Copied")}
  document.querySelector("#copy-nfc").onclick=()=>copy(nfc);
  document.querySelector("#copy-nfc-2").onclick=()=>copy(nfc);
  document.querySelector("#copy-accession").onclick=()=>copy(p.accession);
}
async function authed(session){
  app.innerHTML=`<section class="loading-screen"><div class="brand-mark">OC</div><p>Loading your plants…</p></section>`;
  try{await load();const a=new URLSearchParams(location.search).get("plant");a?detail(session.user,plants.find(p=>p.accession===a)):dashboard(session.user)}
  catch(e){app.innerHTML=`<div>${header(session.user.email)}<div class="content"><div class="error-panel">${esc(e.message)}</div></div></div>`;document.querySelector("#signout").onclick=()=>supabase.auth.signOut()}
}
supabase.auth.onAuthStateChange((_e,s)=>s?authed(s):login());
