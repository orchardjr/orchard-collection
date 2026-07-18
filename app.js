import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const app=document.querySelector("#app");
const toast=document.querySelector("#toast");
const modalRoot=document.querySelector("#modal-root");
const photoPicker=document.querySelector("#photo-picker");
let plants=[],activities=[],photos=[],session=null,currentPlant=null,currentView="cards";

const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const val=(o,keys,fallback="Not recorded")=>{for(const k of keys)if(o?.[k]!==null&&o?.[k]!==undefined&&o?.[k]!=="")return o[k];return fallback};
const pretty=k=>k.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase());
const fmtDate=v=>{if(!v)return"Not recorded";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})};
const daysSince=v=>{if(!v)return null;const d=new Date(v);if(Number.isNaN(d.getTime()))return null;return Math.floor((Date.now()-d.getTime())/86400000)};
const iconFor=t=>({watered:"💧",fertilized:"🧪","new leaf":"🌱",bloom:"🌸",repotted:"🪴",propagated:"✂️",note:"📝",photo:"📷"}[String(t).toLowerCase()]||"•");
function showToast(m){toast.textContent=m;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2600)}
function closeModal(){modalRoot.innerHTML=""}
function header(email=""){return `<header class="topbar"><div class="brand"><div class="brand-mark">OC</div><div class="brand-copy"><strong>Orchard Collection</strong><span>${esc(email)}</span></div></div><button id="signout" class="secondary">Sign out</button></header>`}
function bindHeader(){document.querySelector("#signout")?.addEventListener("click",()=>supabase.auth.signOut())}
function imageURL(p){const own=photos.find(x=>x.plant_accession===p.accession)?.photo_url;return own||val(p,["hero_image","photo_url","image_url","cover_photo","primary_photo"],"")}
function plantActivities(accession){return activities.filter(x=>x.plant_accession===accession).sort((a,b)=>new Date(b.occurred_at||b.created_at)-new Date(a.occurred_at||a.created_at))}
function plantPhotos(accession){return photos.filter(x=>x.plant_accession===accession).sort((a,b)=>new Date(b.taken_at||b.created_at)-new Date(a.taken_at||a.created_at))}
function lastActivity(accession,type){return plantActivities(accession).find(x=>String(x.activity_type).toLowerCase()===type)}
function dueCount(type,intervalField){return plants.filter(p=>{const interval=Number(p[intervalField]);if(!interval)return false;const last=lastActivity(p.accession,type);if(!last)return true;return daysSince(last.occurred_at||last.created_at)>=interval}).length}

function renderLogin(message=""){
  app.innerHTML=`<section class="auth-shell"><div class="auth-card"><p class="eyebrow">Private plant archive</p><h1>Orchard Collection</h1><p class="subtext">Sign in to open your live collection.</p><form id="login" class="form-grid"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Sign in</button><div class="form-error">${esc(message)}</div></form></div></section>`;
  document.querySelector("#login").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector("button"),err=f.querySelector(".form-error"),d=new FormData(f);b.disabled=true;b.textContent="Signing in…";err.textContent="";const{error}=await supabase.auth.signInWithPassword({email:d.get("email"),password:d.get("password")});if(error){err.textContent=error.message;b.disabled=false;b.textContent="Sign in"}});
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

function dashboard(){
  const active=plants.filter(p=>String(p.status||"").toLowerCase()!=="inactive").length;
  const variegated=plants.filter(p=>p.variegated===true||String(p.variegated).toLowerCase()==="true").length;
  const waterDue=dueCount("watered","water_every_days");
  const feedDue=dueCount("fertilized","fertilize_every_days");
  const recent=activities.filter(a=>daysSince(a.occurred_at||a.created_at)<=7).length;
  app.innerHTML=`<div>${header(session.user.email)}<div class="content">
    <section class="hero"><div><p class="eyebrow">Daily collection command center</p><h1>Everything your plants need, in one place.</h1><p>Browse the collection, log care in seconds, add growth photos, and build a permanent timeline for every accession.</p></div><aside class="hero-panel"><div class="big-number">${plants.length}</div><span>plants documented</span></aside></section>
    <section class="stats"><div class="stat"><strong>${active}</strong><span>Active plants</span></div><div class="stat"><strong>${variegated}</strong><span>Variegated plants</span></div><div class="stat"><strong>${photos.length}</strong><span>Collection photos</span></div><div class="stat"><strong>${recent}</strong><span>Events this week</span></div></section>
    <section class="attention-strip"><div class="attention-card"><strong>${waterDue} may need water</strong><span>Based on each plant’s interval and most recent watering log.</span></div><div class="attention-card"><strong>${feedDue} may need fertilizer</strong><span>Based on your fertilizing intervals and live activity history.</span></div><div class="attention-card"><strong>${activities.length} timeline entries</strong><span>Your collection history grows with every quick action.</span></div></section>
    <div class="toolbar"><div class="search-wrap"><input id="search" type="search" placeholder="Search accession, cultivar, location, medium…"></div><div class="view-switch"><button id="cards-view" class="secondary">Cards</button><button id="locations-view" class="ghost">Locations</button></div></div>
    <section id="collection-view"></section>
  </div></div>`;
  bindHeader();
  document.querySelector("#search").addEventListener("input",e=>renderCollection(e.target.value));
  document.querySelector("#cards-view").onclick=()=>{currentView="cards";renderCollection(document.querySelector("#search").value)};
  document.querySelector("#locations-view").onclick=()=>{currentView="locations";renderCollection(document.querySelector("#search").value)};
  renderCollection("");
}

function filteredPlants(q){const term=q.trim().toLowerCase();return plants.filter(p=>Object.values(p).some(v=>String(v??"").toLowerCase().includes(term)))}
function cardHTML(p){const img=imageURL(p),medium=val(p,["medium"],"Medium not recorded"),status=val(p,["status"],"Active"),locationName=val(p,["location","support"],"Location not recorded");return `<a class="plant-card ${img?"has-photo":""}" href="?plant=${encodeURIComponent(p.accession)}" ${img?`style="background-image:url('${esc(img)}')"`:""}><div class="card-top"><span class="accession">${esc(p.accession)}</span><span class="status-dot"></span></div><div class="card-body"><h2>${esc(p.name||"Unnamed plant")}</h2><div class="card-meta"><span>${esc(status)}</span><span>${esc(medium)}</span><span>${esc(locationName)}</span></div></div></a>`}
function renderCollection(q){
  const target=document.querySelector("#collection-view"),f=filteredPlants(q);
  if(!f.length){target.innerHTML=`<div class="empty">No plants match “${esc(q)}”.</div>`;return}
  if(currentView==="cards"){target.innerHTML=`<div class="plant-grid">${f.map(cardHTML).join("")}</div>`;return}
  const groups={};for(const p of f){const loc=val(p,["location","support"],"Unassigned");(groups[loc]??=[]).push(p)}
  target.innerHTML=Object.entries(groups).sort().map(([loc,items])=>`<section class="location-section"><div class="location-header"><h2>${esc(loc)}</h2><span>${items.length} plant${items.length===1?"":"s"}</span></div><div class="plant-grid">${items.map(cardHTML).join("")}</div></section>`).join("");
}

function detail(p){
  currentPlant=p;
  if(!p){app.innerHTML=`<div>${header(session.user.email)}<div class="content detail-shell"><a class="back-link" href="./">← Back to collection</a><div class="error-panel">Plant not found.</div></div></div>`;bindHeader();return}
  const img=imageURL(p),nfc=`${location.origin}${location.pathname}?plant=${encodeURIComponent(p.accession)}`,events=plantActivities(p.accession),pics=plantPhotos(p.accession);
  const water=val(p,["water_every_days","watering_interval"],"—"),fert=val(p,["fertilize_every_days","fertilizer_interval"],"—"),ped=val(p,["peduncles"],0),condition=val(p,["condition"],"Not recorded"),notes=val(p,["notes","care_notes","description"],"No notes have been added yet.");
  const hidden=new Set(["id","owner_id","created_at","updated_at","name","accession","notes","care_notes","description","hero_image","photo_url","image_url","cover_photo","primary_photo","water_every_days","watering_interval","fertilize_every_days","fertilizer_interval","peduncles","condition"]);
  const rows=Object.entries(p).filter(([k,v])=>!hidden.has(k)&&v!==null&&v!==""&&!Array.isArray(v)&&typeof v!=="object").map(([k,v])=>`<div class="data-row"><span>${esc(pretty(k))}</span><span>${esc(typeof v==="boolean"?(v?"Yes":"No"):v)}</span></div>`).join("");
  app.innerHTML=`<div>${header(session.user.email)}<div class="content detail-shell"><a class="back-link" href="./">← Back to collection</a>
    <section class="detail-hero ${img?"has-photo":""}" ${img?`style="background-image:url('${esc(img)}')"`:""}><div class="detail-title"><span class="accession">${esc(p.accession)}</span><h1>${esc(p.name||"Unnamed plant")}</h1><p>${esc(val(p,["status"],"Active"))} · ${esc(condition)}</p><div class="detail-actions"><button id="edit-plant" class="primary">Edit plant</button><button id="copy-nfc" class="secondary">Copy NFC link</button><button id="copy-accession" class="ghost">Copy accession</button><button id="delete-plant" class="ghost">Delete plant</button></div></div></section>
    <section class="quick-bar">
      <button class="quick-action" data-action="Watered"><b>💧</b><span>Watered</span></button>
      <button class="quick-action" data-action="Fertilized"><b>🧪</b><span>Fertilized</span></button>
      <button class="quick-action" data-action="New Leaf"><b>🌱</b><span>New leaf</span></button>
      <button class="quick-action" data-action="Bloom"><b>🌸</b><span>Bloom</span></button>
      <button class="quick-action" data-action="Repotted"><b>🪴</b><span>Repotted</span></button>
      <button class="quick-action" id="add-photo"><b>📷</b><span>Add photo</span></button>
    </section>
    <section class="detail-grid"><div class="stack">
      <article class="panel"><h3>Care snapshot</h3><div class="care-grid"><div class="care-card"><strong>${esc(water==="—"?"—":water+" days")}</strong><span>Watering interval</span></div><div class="care-card"><strong>${esc(fert==="—"?"—":fert+" days")}</strong><span>Fertilizing interval</span></div><div class="care-card"><strong>${esc(ped)}</strong><span>Peduncles</span></div><div class="care-card"><strong>${esc(condition)}</strong><span>Current condition</span></div></div></article>
      <article class="panel"><h3>Growth and care timeline</h3><div class="timeline">${events.length?events.map(e=>`<div class="event"><div class="event-icon">${iconFor(e.activity_type)}</div><div class="event-body"><strong>${esc(e.activity_type||"Activity")}</strong><time>${esc(fmtDate(e.occurred_at||e.created_at))}</time>${e.notes?`<p>${esc(e.notes)}</p>`:""}<div class="event-controls"><button class="mini-button" data-edit-event="${esc(e.id)}">Edit</button><button class="mini-button danger-button" data-delete-event="${esc(e.id)}">Delete</button></div></div></div>`).join(""):'<p class="subtext">No events yet. Use the quick-action buttons above to begin this plant’s story.</p>'}</div></article>
      <article class="panel"><h3>Botanical record</h3><div class="data-list">${rows||'<p class="subtext">No additional record fields are populated yet.</p>'}</div></article>
      <article class="panel"><h3>Notes</h3><div class="note-box">${esc(notes)}</div></article>
    </div><div class="stack">
      <article class="panel"><h3>Photo gallery</h3>${pics.length?`<div class="gallery">${pics.map(x=>`<div class="photo-tile"><img src="${esc(x.photo_url)}" alt="${esc(x.caption||p.name||"Plant photo")}" data-full="${esc(x.photo_url)}"><button class="photo-delete" data-delete-photo="${esc(x.id)}" aria-label="Delete photo">×</button></div>`).join("")}</div>`:'<p class="subtext">No photos yet. Tap “Add photo” to take or upload the first image.</p>'}</article>
      <article class="panel"><h3>Database history</h3><div class="data-list"><div class="data-row"><span>Created</span><span>${esc(fmtDate(p.created_at))}</span></div><div class="data-row"><span>Last updated</span><span>${esc(fmtDate(p.updated_at))}</span></div><div class="data-row"><span>Owner protected</span><span>Yes</span></div></div></article>
      <article class="panel"><h3>NFC plant link</h3><div class="nfc-url">${esc(nfc)}</div></article>
    </div></section>
  </div></div>`;
  bindHeader();
  document.querySelector("#edit-plant").onclick=()=>openPlantEditModal(p);
  document.querySelector("#delete-plant").onclick=()=>confirmDeletePlant(p);
  document.querySelector("#copy-nfc").onclick=()=>copyText(nfc);
  document.querySelector("#copy-accession").onclick=()=>copyText(p.accession);
  document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>openActivityModal(b.dataset.action));
  document.querySelector("#add-photo").onclick=()=>photoPicker.click();
  document.querySelectorAll("[data-full]").forEach(img=>img.onclick=()=>openPhoto(img.dataset.full));
  document.querySelectorAll("[data-edit-event]").forEach(b=>b.onclick=()=>openEventEditModal(b.dataset.editEvent));
  document.querySelectorAll("[data-delete-event]").forEach(b=>b.onclick=()=>confirmDeleteEvent(b.dataset.deleteEvent));
  document.querySelectorAll("[data-delete-photo]").forEach(b=>b.onclick=e=>{e.stopPropagation();confirmDeletePhoto(b.dataset.deletePhoto)});
}
async function copyText(t){await navigator.clipboard.writeText(t);showToast("Copied")}
function openPhoto(url){modalRoot.innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal photo-modal"><img src="${esc(url)}" alt="Plant photo"></div></div>`;document.querySelector("#backdrop").onclick=e=>{if(e.target.id==="backdrop")closeModal()}}
function openActivityModal(type){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>${esc(type)}</h2><button class="icon-button" id="close-modal">×</button></div><form id="activity-form"><label>Optional note<textarea name="notes" placeholder="Add any detail you want remembered…"></textarea></label><div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">Cancel</button><button class="primary">Save activity</button></div></form></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#activity-form").onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector(".primary"),d=new FormData(e.currentTarget);b.disabled=true;b.textContent="Saving…";const{data,error}=await supabase.from("activity_log").insert({owner_id:session.user.id,plant_id:currentPlant.id,plant_accession:currentPlant.accession,activity_type:type,notes:d.get("notes")||null,occurred_at:new Date().toISOString()}).select().single();if(error){showToast(error.message);b.disabled=false;b.textContent="Save activity";return}activities.unshift(data);closeModal();showToast(`${type} logged`);detail(currentPlant)};
}

function openPlantEditModal(p){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>Edit plant</h2><button class="icon-button" id="close-modal">×</button></div>
    <form id="plant-edit-form" class="form-grid">
      <label>Plant name<input name="name" value="${esc(p.name||"")}" required></label>
      <label>Status<input name="status" value="${esc(p.status||"Active")}"></label>
      <label>Condition<input name="condition" value="${esc(p.condition||"")}"></label>
      <label>Location<input name="location" value="${esc(p.location||"")}"></label>
      <label>Support<input name="support" value="${esc(p.support||"")}"></label>
      <label>Medium<input name="medium" value="${esc(p.medium||"")}"></label>
      <label>Water every (days)<input name="water_every_days" type="number" min="0" value="${esc(p.water_every_days??"")}"></label>
      <label>Fertilize every (days)<input name="fertilize_every_days" type="number" min="0" value="${esc(p.fertilize_every_days??"")}"></label>
      <label>Fertilizer<input name="fertilizer" value="${esc(p.fertilizer||"")}"></label>
      <label>Peduncles<input name="peduncles" type="number" min="0" value="${esc(p.peduncles??0)}"></label>
      <label>Notes<textarea name="notes">${esc(p.notes||p.care_notes||p.description||"")}</textarea></label>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">Cancel</button><button class="primary">Save changes</button></div>
    </form></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#plant-edit-form").onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget,button=form.querySelector(".primary"),d=new FormData(form);
    button.disabled=true;button.textContent="Saving…";
    const payload={
      name:d.get("name"),
      status:d.get("status")||null,
      condition:d.get("condition")||null,
      location:d.get("location")||null,
      support:d.get("support")||null,
      medium:d.get("medium")||null,
      water_every_days:d.get("water_every_days")===""?null:Number(d.get("water_every_days")),
      fertilize_every_days:d.get("fertilize_every_days")===""?null:Number(d.get("fertilize_every_days")),
      fertilizer:d.get("fertilizer")||null,
      peduncles:d.get("peduncles")===""?0:Number(d.get("peduncles")),
      notes:d.get("notes")||null,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await supabase.from("plants").update(payload).eq("id",p.id).select().single();
    if(error){showToast(error.message);button.disabled=false;button.textContent="Save changes";return}
    const index=plants.findIndex(x=>x.id===p.id);
    if(index>=0)plants[index]=data;
    currentPlant=data;
    closeModal();showToast("Plant updated");detail(data);
  };
}

function openEventEditModal(eventId){
  const event=activities.find(x=>String(x.id)===String(eventId));
  if(!event)return;
  const when=(event.occurred_at||event.created_at||new Date().toISOString()).slice(0,16);
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>Edit timeline entry</h2><button class="icon-button" id="close-modal">×</button></div>
    <form id="event-edit-form" class="form-grid">
      <label>Activity type<input name="activity_type" value="${esc(event.activity_type||"")}"></label>
      <label>Date and time<input name="occurred_at" type="datetime-local" value="${esc(when)}"></label>
      <label>Notes<textarea name="notes">${esc(event.notes||"")}</textarea></label>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">Cancel</button><button class="primary">Save changes</button></div>
    </form></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#event-edit-form").onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget,button=form.querySelector(".primary"),d=new FormData(form);
    button.disabled=true;button.textContent="Saving…";
    const local=d.get("occurred_at");
    const payload={activity_type:d.get("activity_type")||"Activity",notes:d.get("notes")||null,occurred_at:local?new Date(local).toISOString():event.occurred_at};
    const {data,error}=await supabase.from("activity_log").update(payload).eq("id",event.id).select().single();
    if(error){showToast(error.message);button.disabled=false;button.textContent="Save changes";return}
    const index=activities.findIndex(x=>x.id===event.id);
    if(index>=0)activities[index]=data;
    closeModal();showToast("Timeline entry updated");detail(currentPlant);
  };
}

function confirmationModal(title,message,confirmText,onConfirm){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-header"><h2>${esc(title)}</h2><button class="icon-button" id="close-modal">×</button></div><p class="subtext">${esc(message)}</p><div class="modal-actions"><button class="ghost" id="cancel-modal">Cancel</button><button class="primary danger-confirm" id="confirm-delete">${esc(confirmText)}</button></div></div></div>`;
  document.querySelector("#close-modal").onclick=closeModal;
  document.querySelector("#cancel-modal").onclick=closeModal;
  document.querySelector("#confirm-delete").onclick=onConfirm;
}

function confirmDeleteEvent(eventId){
  const event=activities.find(x=>String(x.id)===String(eventId));
  if(!event)return;
  confirmationModal("Delete timeline entry","This removes the event permanently from this plant’s history.","Delete entry",async()=>{
    const b=document.querySelector("#confirm-delete");b.disabled=true;b.textContent="Deleting…";
    const {error}=await supabase.from("activity_log").delete().eq("id",event.id);
    if(error){showToast(error.message);b.disabled=false;b.textContent="Delete entry";return}
    activities=activities.filter(x=>x.id!==event.id);
    closeModal();showToast("Timeline entry deleted");detail(currentPlant);
  });
}

function confirmDeletePhoto(photoId){
  const photo=photos.find(x=>String(x.id)===String(photoId));
  if(!photo)return;
  confirmationModal("Delete photo","This removes the image from the gallery and permanently deletes the file from storage.","Delete photo",async()=>{
    const b=document.querySelector("#confirm-delete");b.disabled=true;b.textContent="Deleting…";
    if(photo.storage_path){
      const storageResult=await supabase.storage.from("plant-photos").remove([photo.storage_path]);
      if(storageResult.error){showToast(storageResult.error.message);b.disabled=false;b.textContent="Delete photo";return}
    }
    const {error}=await supabase.from("photos").delete().eq("id",photo.id);
    if(error){showToast(error.message);b.disabled=false;b.textContent="Delete photo";return}
    photos=photos.filter(x=>x.id!==photo.id);
    closeModal();showToast("Photo deleted");detail(currentPlant);
  });
}

function confirmDeletePlant(p){
  confirmationModal("Delete plant",`Permanently delete ${p.accession} and all of its photos and timeline entries? This cannot be undone.`,"Delete plant",async()=>{
    const b=document.querySelector("#confirm-delete");b.disabled=true;b.textContent="Deleting…";

    const relatedPhotos=plantPhotos(p.accession);
    const paths=relatedPhotos.map(x=>x.storage_path).filter(Boolean);
    if(paths.length){
      const storageResult=await supabase.storage.from("plant-photos").remove(paths);
      if(storageResult.error){showToast(storageResult.error.message);b.disabled=false;b.textContent="Delete plant";return}
    }

    const activityDelete=await supabase.from("activity_log").delete().eq("plant_id",p.id);
    if(activityDelete.error){showToast(activityDelete.error.message);b.disabled=false;b.textContent="Delete plant";return}

    const photoDelete=await supabase.from("photos").delete().eq("plant_id",p.id);
    if(photoDelete.error){showToast(photoDelete.error.message);b.disabled=false;b.textContent="Delete plant";return}

    const plantDelete=await supabase.from("plants").delete().eq("id",p.id);
    if(plantDelete.error){showToast(plantDelete.error.message);b.disabled=false;b.textContent="Delete plant";return}

    plants=plants.filter(x=>x.id!==p.id);
    activities=activities.filter(x=>x.plant_id!==p.id&&x.plant_accession!==p.accession);
    photos=photos.filter(x=>x.plant_id!==p.id&&x.plant_accession!==p.accession);
    closeModal();showToast("Plant deleted");
    history.replaceState({}, "", location.pathname);
    dashboard();
  });
}

photoPicker.addEventListener("change",async()=>{
  const file=photoPicker.files?.[0];
  if(!file||!currentPlant)return;

  if(!file.size){
    showToast("The selected image is empty. Please choose it again.");
    photoPicker.value="";
    return;
  }

  showToast("Preparing photo…");

  try{
    const bytes=await file.arrayBuffer();
    if(!bytes.byteLength)throw new Error("The selected image contained no data.");

    const mimeType=file.type||"image/jpeg";
    const uploadBody=new Blob([bytes],{type:mimeType});
    const originalName=file.name||`plant-photo-${Date.now()}.jpg`;
    const safe=originalName.replace(/[^a-zA-Z0-9._-]/g,"-");
    const path=`${session.user.id}/${currentPlant.accession}/${Date.now()}-${safe}`;

    showToast("Uploading photo…");

    const upload=await supabase.storage
      .from("plant-photos")
      .upload(path,uploadBody,{
        cacheControl:"3600",
        contentType:mimeType,
        upsert:false
      });

    if(upload.error)throw upload.error;

    const{data:publicData}=supabase.storage.from("plant-photos").getPublicUrl(path);

    const insert=await supabase.from("photos").insert({
      owner_id:session.user.id,
      plant_id:currentPlant.id,
      plant_accession:currentPlant.accession,
      photo_url:publicData.publicUrl,
      storage_path:path,
      caption:null,
      taken_at:new Date().toISOString()
    }).select().single();

    if(insert.error)throw insert.error;

    photos.unshift(insert.data);

    const activity=await supabase.from("activity_log").insert({
      owner_id:session.user.id,
      plant_id:currentPlant.id,
      plant_accession:currentPlant.accession,
      activity_type:"Photo",
      notes:"Photo added",
      occurred_at:new Date().toISOString()
    }).select().single();

    if(!activity.error)activities.unshift(activity.data);

    showToast("Photo added");
    detail(currentPlant);
  }catch(error){
    console.error("Photo upload failed:",error);
    showToast(error?.message||"Photo upload failed.");
  }finally{
    photoPicker.value="";
  }
});

async function renderAuthenticated(s){
  session=s;app.innerHTML=`<section class="loading-screen"><div class="brand-mark">OC</div><p>Loading your collection…</p></section>`;
  try{await loadAll();const accession=new URLSearchParams(location.search).get("plant");accession?detail(plants.find(p=>p.accession===accession)):dashboard()}
  catch(e){app.innerHTML=`<div>${header(s.user.email)}<div class="content"><div class="error-panel"><strong>The app connected, but the v2 database upgrade may not have been run yet.</strong><br><br>${esc(e.message)}</div></div></div>`;bindHeader()}
}
supabase.auth.onAuthStateChange((_event,s)=>s?renderAuthenticated(s):renderLogin());
