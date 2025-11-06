// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, doc, addDoc, getDocs, deleteDoc, updateDoc, onSnapshot, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// ==== CONFIG ==== (vervang met jouw projectgegevens)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "",
  appId: ""
};

// ==== DOM HELPERS ====
const $ = (s)=>document.querySelector(s); const $$=(s)=>Array.from(document.querySelectorAll(s));
const banner=$('#offline-banner'); const tabs=$('#tabs');

const state = { mode:'cloud', tasks:[], plants:[], employees:[], notifications:[] };

// ==== MODAL & UI ACTIONS ====
const ui = {
  open(html, title='Bewerken', onOk=null){
    const modal=$('#modal'); $('#modal-title').textContent=title; $('#modal-body').innerHTML=html;
    modal.returnValue=''; modal.showModal();
    if(onOk){ const handler=()=>{ if(modal.returnValue!=="cancel") onOk(); modal.removeEventListener('close',handler); }; modal.addEventListener('close',handler); }
  },
  openCreateTask(){
    const html=`
      <div class="row"><div><label>Naam</label><input id="t-name" placeholder="bv. Onderhoud lijn 3"/></div><div><label>Duur (uren)</label><input id="t-dur" type="number" min="0" step="0.5" value="1"/></div></div>
      <div class="row"><div><label>Plant</label><select id="t-plant"></select></div><div><label>Werknemer (optioneel)</label><select id="t-emp"><option value="">—</option></select></div></div>
      <div><label>Status</label><select id="t-status"><option value="open">Open</option><option value="in_progress">In uitvoering</option><option value="done">Afgerond</option></select></div>`;
    ui.open(html,'Nieuwe taak', async()=>{
      const name=$('#t-name').value.trim(); const duration=parseFloat($('#t-dur').value)||0; const plantId=$('#t-plant').value; const employeeId=$('#t-emp').value||null; const status=$('#t-status').value;
      if(!name||!plantId) return;
      await data.tasks.create({name,duration,plantId,employeeId,status});
    });
    fillOptions('plants','#t-plant');
    fillOptions('employees','#t-emp', e=>`${e.firstName} ${e.lastName}`);
  },
  openEditTask(task){
    const html = `
      <div class="row"><div><label>Naam</label><input id="t-name" value="${task.name}"/></div><div><label>Duur (uren)</label><input id="t-dur" type="number" min="0" step="0.5" value="${task.duration||0}"/></div></div>
      <div class="row"><div><label>Plant</label><select id="t-plant"></select></div><div><label>Werknemer</label><select id="t-emp"><option value="">—</option></select></div></div>
      <div><label>Status</label><select id="t-status"><option value="open">Open</option><option value="in_progress">In uitvoering</option><option value="done">Afgerond</option></select></div>`;
    ui.open(html,'Taak bewerken', async ()=>{
      const name=$('#t-name').value.trim(); const duration=parseFloat($('#t-dur').value)||0; const plantId=$('#t-plant').value; const employeeId=$('#t-emp').value||null; const status=$('#t-status').value;
      await data.tasks.update(task.id,{name,duration,plantId,employeeId,status});
    });
    fillOptions('plants','#t-plant',null,task.plantId);
    fillOptions('employees','#t-emp', e=>`${e.firstName} ${e.lastName}`, task.employeeId||'');
    $('#t-status').value=task.status;
  },
  openCreatePlant(){
    const html = `
      <div class="row"><div><label>Naam</label><input id="p-name"/></div><div><label>Capaciteit</label><input id="p-cap" type="number" min="0" value="0"/></div></div>
      <div class="row"><div><label>Locatie</label><input id="p-loc" placeholder="Stad, Land"/></div><div><label>Status</label><select id="p-status"><option>actief</option><option>onderhoud</option><option>stilgelegd</option></select></div></div>`;
    ui.open(html,'Nieuwe plant', async ()=>{
      const name=$('#p-name').value.trim(); if(!name) return;
      await data.plants.create({name,capacity:parseInt($('#p-cap').value)||0,location:$('#p-loc').value,status:$('#p-status').value});
    });
  },
  openCreateEmployee(){
    const html = `
      <div class="row"><div><label>Voornaam</label><input id="e-fn"/></div><div><label>Achternaam</label><input id="e-ln"/></div></div>
      <div class="row"><div><label>Team</label><input id="e-team"/></div><div><label>Plant</label><select id="e-plant"></select></div></div>
      <div><label>Status</label><select id="e-status"><option value="active">actief</option><option value="locked">geblokkeerd</option><option value="sick">ziek</option></select></div>`;
    ui.open(html,'Nieuwe werknemer', async ()=>{
      const firstName=$('#e-fn').value.trim(); const lastName=$('#e-ln').value.trim();
      if(!firstName||!lastName) return;
      await data.employees.create({firstName,lastName,team:$('#e-team').value,plantId:$('#e-plant').value,status:$('#e-status').value});
    });
    fillOptions('plants','#e-plant');
  },
  openAbsence(){
    const html = `
      <div class="row"><div><label>Werknemer</label><select id="a-emp"></select></div><div><label>Type</label><select id="a-type"><option value="illness">Ziekte</option><option value="holiday">Vakantie</option></select></div></div>
      <div class="row"><div><label>Van</label><input id="a-from" type="date"/></div><div><label>Tot</label><input id="a-to" type="date"/></div></div>
      <small class="muted">Bij ziekte worden taken in deze periode automatisch vrijgegeven.</small>`;
    ui.open(html,'Afwezigheid melden', async ()=>{
      const employeeId=$('#a-emp').value; const type=$('#a-type').value; const from=$('#a-from').value; const to=$('#a-to').value;
      if(!employeeId||!from||!to) return;
      await data.notifications.create({type,message:`${type==='illness'?'Ziekte':'Vakantie'} gemeld voor werknemer ${employeeId} van ${from} tot ${to}`});
      await data.employees.update(employeeId,{status:type==='illness'?'sick':'active'});
      const tasks=[...state.tasks].filter(t=>t.employeeId===employeeId).map(t=>({id:t.id,...t}));
      await Promise.all(tasks.map(t=> data.tasks.update(t.id,{employeeId:null,status:'open'})));
    });
    fillOptions('employees','#a-emp', e=>`${e.firstName} ${e.lastName}`);
  }
};
window.ui = ui; // expose for inline onclick

// ==== DATA LAYER (Local + Cloud) ====
const Local = (()=>{
  const KEY='planning_local_v1';
  function load(){ try{return JSON.parse(localStorage.getItem(KEY))||{plants:[],employees:[],tasks:[],notifications:[]};}catch{return {plants:[],employees:[],tasks:[],notifications:[]};} }
  function save(d){ localStorage.setItem(KEY, JSON.stringify(d)); }
  let db=load(); const uid=()=>'loc_'+Math.random().toString(36).slice(2,10); const now=()=>({seconds:Math.floor(Date.now()/1000)});
  const api = {
    subscribe(col,cb){ cb(db[col].map(x=>({id:x.id,...x}))); },
    list(col){ return Promise.resolve(db[col].map(x=>({id:x.id,...x}))); },
    create(col,data){ const id=uid(); const item={id,...data}; if(col==='tasks'||col==='notifications') item.createdAt=now(); db[col].push(item); save(db); return Promise.resolve({id}); },
    update(col,id,data){ const i=db[col].findIndex(x=>x.id===id); if(i>-1){ db[col][i]={...db[col][i],...data}; save(db);} return Promise.resolve(); },
    delete(col,id){ db[col]=db[col].filter(x=>x.id!==id); save(db); return Promise.resolve(); }
  };
  // seed
  if(!db.plants.length){
    const p1={id:uid(),name:'Plant A',location:'Gent, BE',capacity:120,status:'actief'};
    const p2={id:uid(),name:'Plant B',location:'Antwerpen, BE',capacity:80,status:'onderhoud'};
    const e1={id:uid(),firstName:'Sara',lastName:'De Vos',team:'Alpha',plantId:p1.id,status:'active'};
    const e2={id:uid(),firstName:'Tom',lastName:'Peeters',team:'Beta',plantId:p1.id,status:'active'};
    const t1={id:uid(),name:'Inspectie lijn 2',plantId:p1.id,employeeId:e1.id,duration:2,status:'open',createdAt:now()};
    const t2={id:uid(),name:'Smeren transportband',plantId:p2.id,employeeId:null,duration:1.5,status:'open',createdAt:now()};
    db={plants:[p1,p2],employees:[e1,e2],tasks:[t1,t2],notifications:[]}; save(db);
  }
  return api;
})();

const Cloud = (()=>{
  let app, db;
  async function init(){ app=initializeApp(firebaseConfig); db=getFirestore(app); try{ await enableIndexedDbPersistence(db);}catch(e){} return db; }
  return {
    async tryConnect(){ try{ if(!db) await init(); await getDocs(collection(db,'plants')); return true; }catch(e){ console.warn('Firestore connect fail',e); return false; } },
    subscribe(col,cb){ return onSnapshot(collection(db,col),(snap)=>{ cb(snap.docs.map(d=>({id:d.id,...d.data()}))); }); },
    list(col){ return getDocs(collection(db,col)).then(s=> s.docs.map(d=>({id:d.id,...d.data()}))); },
    async create(col,data){ if(col==='tasks'||col==='notifications') data.createdAt=serverTimestamp(); const ref=await addDoc(collection(db,col),data); return {id:ref.id}; },
    update(col,id,data){ return updateDoc(doc(db,col,id),data); },
    delete(col,id){ return deleteDoc(doc(db,col,id)); }
  };
})();

const data = {
  _backend: Cloud,
  useLocal(){ this._backend=Local; state.mode='local'; banner.style.display='none'; notify('info','Overgeschakeld naar lokale modus'); bootSubscriptions(); },
  async tryCloud(){ const ok=await Cloud.tryConnect(); if(!ok) throw new Error('cloud-fail'); this._backend=Cloud; state.mode='cloud'; },
  subscribe(col,cb){ return this._backend.subscribe(col,cb); },
  list(col){ return this._backend.list(col); },
  create(col,p){ return this._backend.create(col,p); },
  update(col,id,p){ return this._backend.update(col,id,p); },
  delete(col,id){ return this._backend.delete(col,id); },
  tasks:{ create:(p)=>data.create('tasks',p), update:(id,p)=>data.update('tasks',id,p), delete:(id)=>data.delete('tasks',id) },
  plants:{ create:(p)=>data.create('plants',p), update:(id,p)=>data.update('plants',id,p), delete:(id)=>data.delete('plants',id) },
  employees:{ create:(p)=>data.create('employees',p), update:(id,p)=>data.update('employees',id,p) },
  notifications:{ create:(p)=>data.create('notifications',p), delete:(id)=>data.delete('notifications',id) }
};
window.data = data;

// ==== RENDERING & INTERACTION ====
tabs.addEventListener('click',(e)=>{
  if(e.target.tagName!=='BUTTON') return;
  $$('#tabs button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  const key=e.target.dataset.tab;
  $$('#tab-dashboard, #tab-tasks, #tab-plants, #tab-employees, #tab-notifications').forEach(s=>s.classList.add('hide'));
  $('#tab-'+key).classList.remove('hide');
});

function updateKPIs(){
  const open=state.tasks.filter(t=>t.status==='open').length;
  const prog=state.tasks.filter(t=>t.status==='in_progress').length;
  const done=state.tasks.filter(t=>t.status==='done').length;
  const sick=state.employees.filter(e=>e.status==='sick').length;
  $('#kpi-open').textContent=open; $('#kpi-inprogress').textContent=prog; $('#kpi-done').textContent=done; $('#kpi-sick').textContent=sick;
}

const filters={ apply(){ renderTasks(); } };

function renderTasks(){
  const q = ($('#task-search')?.value||'').toLowerCase();
  const st = $('#task-status')?.value||'';
  const tbody = $('#task-rows'); if(!tbody) return;
  tbody.innerHTML='';
  const rows = state.tasks.filter(t=>{
    if(st && t.status!==st) return false;
    if(q){
      const plant = state.plants.find(p=>p.id===t.plantId);
      const emp = state.employees.find(e=>e.id===t.employeeId);
      const hay = [t.name, plant?.name, emp?`${emp.firstName} ${emp.lastName}`:''].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }).map(t=>{
    const plant = state.plants.find(p=>p.id===t.plantId);
    const emp = state.employees.find(e=>e.id===t.employeeId);
    return `<tr>
      <td>${t.name||'-'}</td>
      <td>${plant?.name||'-'}</td>
      <td>${emp?`${emp.firstName} ${emp.lastName}`:'—'}</td>
      <td>${t.duration||0}</td>
      <td><span class="tag">${labelStatus(t.status)}</span></td>
      <td class="actions">
        <button class="btn" onclick='markInProgress("${t.id}")'>Start</button>
        <button class="btn" onclick='markDone("${t.id}")'>Klaar</button>
        <button class="btn" onclick='assignTask("${t.id}")'>Toewijzen</button>
        <button class="btn" onclick='editTask("${t.id}")'>Bewerken</button>
        <button class="btn" onclick='removeTask("${t.id}")'>Verwijderen</button>
      </td>
    </tr>`
  }).join('');
  tbody.innerHTML = rows || `<tr><td colspan="6" class="muted">Geen taken gevonden.</td></tr>`;
  updateKPIs();
}

function labelStatus(s){ return s==='open'?'Open': s==='in_progress'?'In uitvoering':'Afgerond'; }
async function markInProgress(id){ await data.tasks.update(id,{status:'in_progress'}); }
async function markDone(id){ await data.tasks.update(id,{status:'done'}); }
async function removeTask(id){ if(confirm('Taak verwijderen?')) await data.tasks.delete(id); }
function editTask(id){ const t = state.tasks.find(x=>x.id===id); ui.openEditTask(t); }
async function assignTask(id){
  const t = state.tasks.find(x=>x.id===id);
  const html = `<label>Werknemer</label><select id="as-emp"></select>`;
  ui.open(html,'Taak toewijzen', async ()=>{
    const employeeId = $('#as-emp').value||null;
    await data.tasks.update(id,{employeeId});
  });
  fillOptions('employees','#as-emp', (e)=>`${e.firstName} ${e.lastName}`, t.employeeId||'');
}
window.markInProgress=markInProgress; window.markDone=markDone; window.removeTask=removeTask; window.assignTask=assignTask; window.editTask=editTask;

function renderPlants(){
  const host = $('#plant-cards'); if(!host) return; host.innerHTML='';
  state.plants.forEach(p=>{
    const tasksAt = state.tasks.filter(t=>t.plantId===p.id);
    const open = tasksAt.filter(t=>t.status==='open').length;
    const done = tasksAt.filter(t=>t.status==='done').length;
    const emp = state.employees.filter(e=>e.plantId===p.id && e.status!=='locked').length;
    const div = document.createElement('div');
    div.className='panel';
    div.innerHTML = `<h2>${p.name}</h2>
      <div class="content">
        <div class="grid cols-2">
          <div class="kpi"><span class="muted">Locatie</span><b>${p.location||'-'}</b></div>
          <div class="kpi"><span class="muted">Capaciteit</span><b>${p.capacity||0}</b></div>
          <div class="kpi"><span class="muted">Werknemers</span><b>${emp}</b></div>
          <div class="kpi"><span class="muted">Open taken</span><b>${open}</b></div>
          <div class="kpi"><span class="muted">Afgerond</span><b>${done}</b></div>
        </div>
        <div class="actions" style="margin-top:12px">
          <button class="btn" onclick='editPlant("${p.id}")'>Bewerken</button>
          <button class="btn" onclick='deletePlant("${p.id}")'>Verwijderen</button>
        </div>
      </div>`;
    host.appendChild(div);
  });
  if(!state.plants.length){ host.innerHTML = `<div class="muted">Nog geen plants… Voeg er één toe.</div>` }
}
function editPlant(id){
  const p = state.plants.find(x=>x.id===id);
  const html = `
    <div class="row"><div><label>Naam</label><input id="p-name" value="${p.name}"/></div><div><label>Capaciteit</label><input id="p-cap" type="number" value="${p.capacity||0}"/></div></div>
    <div class="row"><div><label>Locatie</label><input id="p-loc" value="${p.location||''}"/></div><div><label>Status</label><select id="p-status"><option>actief</option><option>onderhoud</option><option>stilgelegd</option></select></div></div>`;
  ui.open(html,'Plant bewerken', async ()=>{
    await data.plants.update(id,{name:$('#p-name').value,capacity:parseInt($('#p-cap').value)||0,location:$('#p-loc').value,status:$('#p-status').value});
  });
  setTimeout(()=>{$('#p-status').value=p.status||'actief'},0);
}
async function deletePlant(id){ if(confirm('Plant verwijderen?')) await data.plants.delete(id); }
window.editPlant=editPlant; window.deletePlant=deletePlant;

function renderEmployees(){
  const tbody = $('#emp-rows'); if(!tbody) return; tbody.innerHTML='';
  state.employees.forEach(e=>{
    const plant = state.plants.find(p=>p.id===e.plantId);
    const status = e.status==='sick'? 'ziek' : e.status==='locked'? 'geblokkeerd' : 'actief';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.firstName} ${e.lastName}</td><td>${e.team||'-'}</td><td>${plant?.name||'-'}</td><td><span class="tag">${status}</span></td>
      <td class="actions"><button class="btn" onclick='editEmployee("${e.id}")'>Bewerken</button><button class="btn" onclick='lockEmployee("${e.id}")'>Lock</button></td>`;
    tbody.appendChild(tr);
  });
  if(!state.employees.length){ tbody.innerHTML = `<tr><td colspan="5" class="muted">Nog geen werknemers…</td></tr>` }
}
function editEmployee(id){
  const e = state.employees.find(x=>x.id===id);
  const html = `
    <div class="row"><div><label>Voornaam</label><input id="e-fn" value="${e.firstName}"/></div><div><label>Achternaam</label><input id="e-ln" value="${e.lastName}"/></div></div>
    <div class="row"><div><label>Team</label><input id="e-team" value="${e.team||''}"/></div><div><label>Plant</label><select id="e-plant"></select></div></div>
    <div><label>Status</label><select id="e-status"><option value="active">actief</option><option value="locked">geblokkeerd</option><option value="sick">ziek</option></select></div>`;
  ui.open(html,'Werknemer bewerken', async ()=>{
    await data.employees.update(id,{firstName:$('#e-fn').value,lastName:$('#e-ln').value,team:$('#e-team').value,plantId:$('#e-plant').value,status:$('#e-status').value});
  });
  fillOptions('plants','#e-plant',null,e.plantId);
  setTimeout(()=>{$('#e-status').value=e.status||'active'},0);
}
async function lockEmployee(id){ await data.employees.update(id,{status:'locked'}); }
window.editEmployee=editEmployee; window.lockEmployee=lockEmployee;

function renderNotifs(){
  const tbody = $('#notif-rows'); if(!tbody) return; tbody.innerHTML='';
  state.notifications.forEach(n=>{
    const tr = document.createElement('tr');
    const ts = n.createdAt?.toDate? n.createdAt.toDate() : (n.createdAt?.seconds? new Date(n.createdAt.seconds*1000): new Date());
    tr.innerHTML = `<td>${ts.toLocaleString()}</td><td>${n.type}</td><td>${n.message}</td><td><button class="btn" onclick='removeNotif("${n.id}")'>Verwijderen</button></td>`;
    tbody.appendChild(tr);
  });
  const latest = $('#latest-notifs');
  latest.innerHTML = state.notifications.slice(0,5).map(n=>`<div>• ${n.message}</div>`).join('') || '<span class="muted">Geen meldingen…</span>';
}
async function removeNotif(id){ await data.notifications.delete(id); }
window.removeNotif=removeNotif;

async function fillOptions(col, sel, mapFn=null, selected=null){
  const el = document.querySelector(sel);
  el.innerHTML='';
  const items = state[col];
  items.forEach(d=>{
    const o = document.createElement('option');
    o.value = d.id; o.textContent = mapFn? mapFn(d) : (d.name||d.id);
    if(selected && selected===d.id) o.selected = true;
    el.appendChild(o);
  });
}

function exportCSV(){
  const headers = ['Naam','Plant','Werknemer','Duur','Status'];
  const rows = state.tasks.map(t=>{
    const plant = state.plants.find(p=>p.id===t.plantId)?.name||'';
    const emp = state.employees.find(e=>e.id===t.employeeId);
    const who = emp? `${emp.firstName} ${emp.lastName}`: '';
    return [t.name, plant, who, t.duration||0, t.status];
  });
  const csv = [headers, ...rows].map(r=>r.map(v=>`"${(v??'').toString().replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='taken_export.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
window.exportCSV = exportCSV;

function notify(type,message){ data.notifications.create({type,message}); }

// ==== SUBSCRIPTIONS ====
let unsubscribers = [];
function bootSubscriptions(){
  unsubscribers.forEach(u=>{try{u()}catch{}}); unsubscribers=[];
  const u1 = data.subscribe('plants', (rows)=>{ state.plants=rows; renderPlants(); renderTasks(); updateKPIs(); });
  const u2 = data.subscribe('employees', (rows)=>{ state.employees=rows; renderEmployees(); renderTasks(); updateKPIs(); });
  const u3 = data.subscribe('tasks', (rows)=>{ state.tasks=rows; renderTasks(); updateKPIs(); });
  const u4 = data.subscribe('notifications', (rows)=>{ state.notifications = rows.sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); renderNotifs(); });
  unsubscribers=[u1||(()=>{}),u2||(()=>{}),u3||(()=>{}),u4||(()=>{})];
}

// ==== INIT: try cloud, else choice ====
async function init(){
  try{ await data.tryCloud(); bootSubscriptions(); }
  catch(err){ banner.style.display='block'; console.warn('Cloud niet beschikbaar, toon keuze',err); }
}
$('#retry-btn').onclick = ()=> location.reload();
$('#local-btn').onclick = ()=> data.useLocal();
init();
