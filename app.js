// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// ==== CONFIG ==== (vervang met jouw projectgegevens)
const firebaseConfig = {
  apiKey: "AIzaSyDp51JxwZVSENlKIG_DPEns4Y9iQrwYrBw",
  authDomain: "delaware05-5cb47.firebaseapp.com",
  projectId: "delaware05-5cb47",
  storageBucket: "delaware05-5cb47.firebasestorage.app",
  messagingSenderId: "736835481813",
  appId: "1:736835481813:web:af62f316e2712ce39a725c",
  measurementId: "G-KFJGYZ428B",
};

// ==== DOM HELPERS ====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const banner = $("#offline-banner");
const tabs = $("#tabs");

// ==== AUTH PLACEHOLDER ====
// In een echte app zou je Firebase Auth gebruiken; hier simuleren we de current user voor role-based UI.
// Rollen: 'manager' | 'supervisor' | 'employee'
let currentUser = {
  id: "u_demo_manager",
  name: "Manager Demo",
  role: "manager",
  teamId: null,
};

const state = {
  mode: "cloud",
  tasks: [],
  plants: [],
  employees: [],
  notifications: [],
  teams: [],
  absences: [],
};

// ==== MODAL & UI ACTIONS ====
const ui = {
  open(html, title = "Bewerken", onOk = null) {
    const modal = $("#modal");
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = html;
    modal.returnValue = "";
    modal.showModal();
    if (onOk) {
      const handler = () => {
        if (modal.returnValue !== "cancel") onOk();
        modal.removeEventListener("close", handler);
      };
      modal.addEventListener("close", handler);
    }
  },
  openCreateTask() {
    const html = `
      <div class="row"><div><label>Naam</label><input id="t-name" placeholder="bv. Onderhoud lijn 3"/></div><div><label>Duur (uren)</label><input id="t-dur" type="number" min="0" step="0.5" value="1"/></div></div>
      <div class="row"><div><label>Plant</label><select id="t-plant"></select></div><div><label>Team</label><select id="t-team"></select></div></div>
      <div class="row"><div><label>Teamlid (optioneel)</label><select id="t-emp"><option value="">—</option></select></div><div><label>Datum</label><input id="t-date" type="date"/></div></div>
      <div><label>Status</label><select id="t-status"><option value="open">Open</option><option value="in_progress">In uitvoering</option><option value="done">Afgerond</option></select></div>`;
    ui.open(html, "Nieuwe taak", async () => {
      const name = $("#t-name").value.trim();
      const duration = parseFloat($("#t-dur").value) || 0;
      const plantId = $("#t-plant").value;
      const teamId = $("#t-team").value || null;
      const employeeId = $("#t-emp").value || null;
      const date = $("#t-date").value || null;
      const status = $("#t-status").value;
      if (!name || !plantId) return;
      await data.tasks.create({
        name,
        duration,
        plantId,
        teamId,
        employeeId,
        date,
        status,
      });
      if (employeeId) {
        await notifyUpdate(employeeId, `Nieuwe taak toegewezen: ${name}`);
      }
    });
    fillOptions("plants", "#t-plant");
    fillTeamOptions("#t-team");
    fillOptions("employees", "#t-emp", (e) => `${e.firstName} ${e.lastName}`);
  },
  openEditTask(task) {
    const html = `
      <div class="row"><div><label>Naam</label><input id="t-name" value="${
        task.name
      }"/></div><div><label>Duur (uren)</label><input id="t-dur" type="number" min="0" step="0.5" value="${
      task.duration || 0
    }"/></div></div>
      <div class="row"><div><label>Plant</label><select id="t-plant"></select></div><div><label>Team</label><select id="t-team"></select></div></div>
      <div class="row"><div><label>Teamlid</label><select id="t-emp"><option value="">—</option></select></div><div><label>Datum</label><input id="t-date" type="date" value="${
        task.date || ""
      }"/></div></div>
      <div><label>Status</label><select id="t-status"><option value="open">Open</option><option value="in_progress">In uitvoering</option><option value="done">Afgerond</option></select></div>`;
    ui.open(html, "Taak bewerken", async () => {
      const name = $("#t-name").value.trim();
      const duration = parseFloat($("#t-dur").value) || 0;
      const plantId = $("#t-plant").value;
      const teamId = $("#t-team").value || null;
      const employeeId = $("#t-emp").value || null;
      const date = $("#t-date").value || null;
      const status = $("#t-status").value;
      await data.tasks.update(task.id, {
        name,
        duration,
        plantId,
        teamId,
        employeeId,
        date,
        status,
      });
      if (employeeId) {
        await notifyUpdate(employeeId, `Taak bijgewerkt: ${name}`);
      }
    });
    fillOptions("plants", "#t-plant", null, task.plantId);
    fillTeamOptions("#t-team", task.teamId);
    fillOptions(
      "employees",
      "#t-emp",
      (e) => `${e.firstName} ${e.lastName}`,
      task.employeeId || ""
    );
    $("#t-status").value = task.status;
  },
  openCreateTeam() {
    const html = `
      <div class="row"><div><label>Teamnaam</label><input id="team-name"/></div><div><label>Supervisor</label><select id="team-supervisor"></select></div></div>`;
    ui.open(html, "Nieuw team", async () => {
      const name = $("#team-name").value.trim();
      const supervisorId = $("#team-supervisor").value || null;
      if (!name) return;
      await data.teams.create({ name, supervisorId });
      if (supervisorId) {
        await notifyUpdate(
          supervisorId,
          `Je bent toegewezen als supervisor van team ${name}`
        );
      }
    });
    fillOptions(
      "employees",
      "#team-supervisor",
      (e) => `${e.firstName} ${e.lastName} (${e.role || "employee"})`
    );
  },
  openAssignToTeam(team) {
    const html = `
      <div><label>Teamleden</label><select id="team-member"></select></div>`;
    ui.open(html, `Teamlid toevoegen aan ${team.name}`, async () => {
      const empId = $("#team-member").value;
      if (!empId) return;
      await data.employees.update(empId, { teamId: team.id });
      await notifyUpdate(empId, `Je bent toegewezen aan team ${team.name}`);
    });
    fillOptions(
      "employees",
      "#team-member",
      (e) => `${e.firstName} ${e.lastName} (${e.role || "employee"})`
    );
  },
  openCreateEmployee() {
    const html = `
      <div class="row"><div><label>Voornaam</label><input id="e-fn"/></div><div><label>Achternaam</label><input id="e-ln"/></div></div>
      <div class="row"><div><label>Rol</label><select id="e-role"><option value="employee">werknemer</option><option value="supervisor">supervisor</option><option value="manager">manager</option></select></div><div><label>Team (optioneel)</label><select id="e-team"><option value="">—</option></select></div></div>
      <div class="row"><div><label>Plant</label><select id="e-plant"></select></div><div><label>Status</label><select id="e-status"><option value="active">actief</option><option value="locked">geblokkeerd</option><option value="sick">ziek</option></select></div></div>`;
    ui.open(html, "Nieuwe werknemer", async () => {
      const firstName = $("#e-fn").value.trim();
      const lastName = $("#e-ln").value.trim();
      if (!firstName || !lastName) return;
      await data.employees.create({
        firstName,
        lastName,
        role: $("#e-role").value,
        teamId: $("#e-team").value || null,
        plantId: $("#e-plant").value,
        status: $("#e-status").value,
      });
    });
    fillTeamOptions("#e-team");
    fillOptions("plants", "#e-plant");
  },
  openAbsence() {
    const html = `
      <div class="row"><div><label>Werknemer</label><select id="a-emp"></select></div><div><label>Type</label><select id="a-type"><option value="illness">Ziekte</option><option value="holiday">Vakantie</option></select></div></div>
      <div class="row"><div><label>Van</label><input id="a-from" type="date"/></div><div><label>Tot</label><input id="a-to" type="date"/></div></div>
      <small class="muted">Bij ziekte worden taken in deze periode automatisch vrijgegeven en de manager verwittigd.</small>`;
    ui.open(html, "Afwezigheid melden", async () => {
      const employeeId = $("#a-emp").value;
      const type = $("#a-type").value;
      const from = $("#a-from").value;
      const to = $("#a-to").value;
      if (!employeeId || !from || !to) return;
      await data.absences.create({ employeeId, type, from, to });
      await data.notifications.create({
        type: "absence",
        toRole: "manager",
        message: `${
          type === "illness" ? "Ziekte" : "Vakantie"
        } gemeld door ${employeeId} van ${from} tot ${to}`,
      });
      // mark employee + free tasks
      await data.employees.update(employeeId, {
        status: type === "illness" ? "sick" : "active",
      });
      const tasks = [...state.tasks]
        .filter((t) => t.employeeId === employeeId)
        .map((t) => ({ id: t.id, ...t }));
      await Promise.all(
        tasks.map((t) =>
          data.tasks.update(t.id, { employeeId: null, status: "open" })
        )
      );
    });
    fillOptions("employees", "#a-emp", (e) => `${e.firstName} ${e.lastName}`);
  },
};
window.ui = ui; // expose for inline onclick

// ==== DATA LAYER (Local + Cloud) ====
const Local = (() => {
  const KEY = "planning_local_v2";
  function load() {
    try {
      return (
        JSON.parse(localStorage.getItem(KEY)) || {
          plants: [],
          employees: [],
          tasks: [],
          notifications: [],
          teams: [],
          absences: [],
        }
      );
    } catch {
      return {
        plants: [],
        employees: [],
        tasks: [],
        notifications: [],
        teams: [],
        absences: [],
      };
    }
  }
  function save(d) {
    localStorage.setItem(KEY, JSON.stringify(d));
  }
  let db = load();
  const uid = () => "loc_" + Math.random().toString(36).slice(2, 10);
  const now = () => ({ seconds: Math.floor(Date.now() / 1000) });
  const api = {
    subscribe(col, cb) {
      cb(db[col].map((x) => ({ id: x.id, ...x })));
    },
    list(col) {
      return Promise.resolve(db[col].map((x) => ({ id: x.id, ...x })));
    },
    create(col, data) {
      const id = uid();
      const item = { id, ...data };
      if (col in { tasks: 1, notifications: 1 }) item.createdAt = now();
      db[col].push(item);
      save(db);
      return Promise.resolve({ id });
    },
    update(col, id, data) {
      const i = db[col].findIndex((x) => x.id === id);
      if (i > -1) {
        db[col][i] = { ...db[col][i], ...data };
        save(db);
      }
      return Promise.resolve();
    },
    delete(col, id) {
      db[col] = db[col].filter((x) => x.id !== id);
      save(db);
      return Promise.resolve();
    },
  };
  // seed minimal
  if (!db.plants.length) {
    const p1 = {
      id: uid(),
      name: "Plant A",
      location: "Gent, BE",
      capacity: 120,
      status: "actief",
    };
    const p2 = {
      id: uid(),
      name: "Plant B",
      location: "Antwerpen, BE",
      capacity: 80,
      status: "onderhoud",
    };
    const team = { id: uid(), name: "Team Alpha", supervisorId: null };
    const e1 = {
      id: uid(),
      firstName: "Sara",
      lastName: "De Vos",
      role: "employee",
      teamId: team.id,
      plantId: p1.id,
      status: "active",
    };
    const e2 = {
      id: uid(),
      firstName: "Tom",
      lastName: "Peeters",
      role: "supervisor",
      teamId: team.id,
      plantId: p1.id,
      status: "active",
    };
    const t1 = {
      id: uid(),
      name: "Inspectie lijn 2",
      plantId: p1.id,
      teamId: team.id,
      employeeId: e1.id,
      duration: 2,
      date: null,
      status: "open",
      createdAt: now(),
    };
    db = {
      plants: [p1, p2],
      employees: [e1, e2],
      tasks: [t1],
      notifications: [],
      teams: [team],
      absences: [],
    };
    save(db);
  }
  return api;
})();

const Cloud = (() => {
  let app, db;
  async function init() {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    try {
      await enableIndexedDbPersistence(db);
    } catch (e) {}
    return db;
  }
  return {
    async tryConnect() {
      try {
        if (!db) await init();
        await getDocs(collection(db, "plants"));
        return true;
      } catch (e) {
        console.warn("Firestore connect fail", e);
        return false;
      }
    },
    subscribe(col, cb) {
      return onSnapshot(collection(db, col), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    },
    list(col) {
      return getDocs(collection(db, col)).then((s) =>
        s.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    },
    async create(col, data) {
      if (col === "tasks" || col === "notifications")
        data.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, col), data);
      return { id: ref.id };
    },
    update(col, id, data) {
      return updateDoc(doc(db, col, id), data);
    },
    delete(col, id) {
      return deleteDoc(doc(db, col, id));
    },
  };
})();

const data = {
  _backend: Cloud,
  useLocal() {
    this._backend = Local;
    state.mode = "local";
    banner.style.display = "none";
    notify("info", "Overgeschakeld naar lokale modus");
    bootSubscriptions();
  },
  async tryCloud() {
    const ok = await Cloud.tryConnect();
    if (!ok) throw new Error("cloud-fail");
    this._backend = Cloud;
    state.mode = "cloud";
  },
  subscribe(col, cb) {
    return this._backend.subscribe(col, cb);
  },
  list(col) {
    return this._backend.list(col);
  },
  create(col, p) {
    return this._backend.create(col, p);
  },
  update(col, id, p) {
    return this._backend.update(col, id, p);
  },
  delete(col, id) {
    return this._backend.delete(col, id);
  },
  // convenience namespaces
  tasks: {
    create: (p) => data.create("tasks", p),
    update: (id, p) => data.update("tasks", id, p),
    delete: (id) => data.delete("tasks", id),
  },
  plants: {
    create: (p) => data.create("plants", p),
    update: (id, p) => data.update("plants", id, p),
    delete: (id) => data.delete("plants", id),
  },
  employees: {
    create: (p) => data.create("employees", p),
    update: (id, p) => data.update("employees", id, p),
  },
  notifications: {
    create: (p) => data.create("notifications", p),
    delete: (id) => data.delete("notifications", id),
  },
  teams: {
    create: (p) => data.create("teams", p),
    update: (id, p) => data.update("teams", id, p),
  },
  absences: {
    create: (p) => data.create("absences", p),
    delete: (id) => data.delete("absences", id),
  },
};
window.data = data;

// ==== RENDERING & INTERACTION ====
tabs.addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  $$("#tabs button").forEach((b) => b.classList.remove("active"));
  e.target.classList.add("active");
  const key = e.target.dataset.tab;
  $$(
    "#tab-dashboard, #tab-planning, #tab-tasks, #tab-teams, #tab-employees, #tab-notifications, #tab-my"
  ).forEach((s) => s.classList.add("hide"));
  $("#tab-" + key).classList.remove("hide");
  if (key === "planning") renderBoard();
  if (key === "my") renderMy();
});

function updateKPIs() {
  const open = state.tasks.filter((t) => t.status === "open").length;
  const prog = state.tasks.filter((t) => t.status === "in_progress").length;
  const done = state.tasks.filter((t) => t.status === "done").length;
  const sick = state.employees.filter((e) => e.status === "sick").length;
  $("#kpi-open").textContent = open;
  $("#kpi-inprogress").textContent = prog;
  $("#kpi-done").textContent = done;
  $("#kpi-sick").textContent = sick;
}

const filters = {
  apply() {
    renderTasks();
  },
};

function renderTasks() {
  const q = ($("#task-search")?.value || "").toLowerCase();
  const st = $("#task-status")?.value || "";
  const tbody = $("#task-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rows = state.tasks
    .filter((t) => {
      if (st && t.status !== st) return false;
      if (q) {
        const plant = state.plants.find((p) => p.id === t.plantId);
        const emp = state.employees.find((e) => e.id === t.employeeId);
        const hay = [
          t.name,
          plant?.name,
          emp ? `${emp.firstName} ${emp.lastName}` : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((t) => {
      const plant = state.plants.find((p) => p.id === t.plantId);
      const emp = state.employees.find((e) => e.id === t.employeeId);
      return `<tr>
      <td>${t.name || "-"}</td>
      <td>${plant?.name || "-"}</td>
      <td>${emp ? `${emp.firstName} ${emp.lastName}` : "—"}</td>
      <td>${t.duration || 0}</td>
      <td>${t.date || "—"}</td>
      <td><span class="tag">${labelStatus(t.status)}</span></td>
      <td class="actions">
        <button class="btn" onclick='markInProgress("${t.id}")'>Start</button>
        <button class="btn" onclick='markDone("${t.id}")'>Klaar</button>
        <button class="btn" onclick='assignTask("${t.id}")'>Toewijzen</button>
        <button class="btn" onclick='editTask("${t.id}")'>Bewerken</button>
        <button class="btn" onclick='removeTask("${t.id}")'>Verwijderen</button>
      </td>
    </tr>`;
    })
    .join("");
  tbody.innerHTML =
    rows || `<tr><td colspan="7" class="muted">Geen taken gevonden.</td></tr>`;
  updateKPIs();
}

function labelStatus(s) {
  return s === "open"
    ? "Open"
    : s === "in_progress"
    ? "In uitvoering"
    : "Afgerond";
}
async function markInProgress(id) {
  await data.tasks.update(id, { status: "in_progress" });
}
async function markDone(id) {
  await data.tasks.update(id, { status: "done" });
}
async function removeTask(id) {
  if (confirm("Taak verwijderen?")) await data.tasks.delete(id);
}
function editTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  ui.openEditTask(t);
}
async function assignTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  const html = `<div class="row"><div><label>Team</label><select id="as-team"></select></div><div><label>Teamlid</label><select id="as-emp"></select></div></div><div><label>Datum</label><input id="as-date" type="date" value="${
    t.date || ""
  }"/></div>`;
  ui.open(html, "Taak toewijzen", async () => {
    const teamId = $("#as-team").value || null;
    const employeeId = $("#as-emp").value || null;
    const date = $("#as-date").value || null;
    await data.tasks.update(id, { teamId, employeeId, date });
    if (employeeId) {
      await notifyUpdate(employeeId, `Taak toegewezen: ${t.name}`);
    }
  });
  fillTeamOptions("#as-team", t.teamId);
  fillOptions(
    "employees",
    "#as-emp",
    (e) => `${e.firstName} ${e.lastName}`,
    t.employeeId || ""
  );
}
window.markInProgress = markInProgress;
window.markDone = markDone;
window.removeTask = removeTask;
window.assignTask = assignTask;
window.editTask = editTask;

// === Teams UI ===
function renderTeams() {
  const host = $("#team-list");
  if (!host) return;
  host.innerHTML = "";
  state.teams.forEach((team) => {
    const supervisor = state.employees.find((e) => e.id === team.supervisorId);
    const members = state.employees.filter((e) => e.teamId === team.id);
    const div = document.createElement("div");
    div.className = "panel";
    div.innerHTML = `<h2>${team.name}</h2>
      <div class="content">
        <div class="row">
          <div><span class="muted">Supervisor</span><div>${
            supervisor ? supervisor.firstName + " " + supervisor.lastName : "—"
          }</div></div>
          <div><span class="muted">Leden</span><div>${
            members.map((m) => m.firstName + " " + m.lastName).join(", ") || "—"
          }</div></div>
        </div>
        <div class="actions" style="margin-top:12px">
          <button class="btn" onclick='assignToTeam("${
            team.id
          }")'>Lid toevoegen</button>
        </div>
      </div>`;
    host.appendChild(div);
  });
  if (!state.teams.length) {
    host.innerHTML = `<div class="muted">Nog geen teams… Voeg er één toe.</div>`;
  }
}
function assignToTeam(teamId) {
  const t = state.teams.find((x) => x.id === teamId);
  ui.openAssignToTeam(t);
}
window.assignToTeam = assignToTeam;

// === Planning board ===
function renderBoard() {
  const teamSel = $("#board-team");
  const dateSel = $("#board-date");
  if (!teamSel.value && state.teams[0]) teamSel.value = state.teams[0].id;
  const teamId = teamSel.value || null;
  const date = dateSel.value || null;
  const unassignedHost = $("#board-unassigned");
  const assignedHost = $("#board-assigned");
  unassignedHost.innerHTML = "";
  assignedHost.innerHTML = "";
  const unassigned = state.tasks.filter(
    (t) => !t.employeeId && (!teamId || t.teamId === teamId)
  );
  const assigned = state.tasks.filter(
    (t) => t.employeeId && (!teamId || t.teamId === teamId)
  );
  unassigned.forEach((t) => unassignedHost.appendChild(taskCard(t, true)));
  assigned.forEach((t) => assignedHost.appendChild(taskCard(t, false)));
}
function taskCard(t, canAssign) {
  const div = document.createElement("div");
  div.className = "task-card";
  const emp = state.employees.find((e) => e.id === t.employeeId);
  div.innerHTML = `<b>${t.name}</b>
    <div class="meta">duur: ${t.duration || 0}u • datum: ${t.date || "—"} • ${
    emp
      ? "toegewezen aan: " + emp.firstName + " " + emp.lastName
      : "niet toegewezen"
  }</div>
    <div class="actions" style="margin-top:8px">
      ${
        canAssign
          ? `<button class="btn" onclick='assignTask("${t.id}")'>Toewijzen</button>`
          : ""
      }
      <button class="btn" onclick='editTask("${t.id}")'>Bewerken</button>
    </div>`;
  return div;
}

// === My planning ===
function renderMy() {
  const my = currentUser;
  const container = $("#my-planning");
  const abs = $("#my-absences");
  if (!container) return;
  // if role supervisor: show team
  let tasks = [];
  if (my.role === "supervisor") {
    const teamId = state.teams.find((t) => t.supervisorId === my.id)?.id;
    tasks = state.tasks.filter((t) => t.teamId === teamId);
  } else {
    tasks = state.tasks.filter((t) => t.employeeId === my.id);
  }
  container.innerHTML =
    tasks
      .map(
        (t) =>
          `<div class="task-card"><b>${t.name}</b><div class="meta">${
            t.date || "—"
          } • ${labelStatus(t.status)} • ${t.duration || 0}u</div></div>`
      )
      .join("") || '<div class="muted">Geen taken.</div>';
  const myAbs = state.absences.filter((a) => a.employeeId === my.id);
  abs.innerHTML =
    myAbs
      .map(
        (a) =>
          `<div class="task-card"><b>${
            a.type === "illness" ? "Ziekte" : "Vakantie"
          }</b><div class="meta">${a.from} → ${a.to}</div></div>`
      )
      .join("") || '<div class="muted">Geen afwezigheden.</div>';
}

// === Employees table ===
function renderEmployees() {
  const tbody = $("#emp-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.employees.forEach((e) => {
    const plant = state.plants.find((p) => p.id === e.plantId);
    const team = state.teams.find((t) => t.id === e.teamId);
    const status =
      e.status === "sick"
        ? "ziek"
        : e.status === "locked"
        ? "geblokkeerd"
        : "actief";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${e.firstName} ${e.lastName}</td><td>${
      e.role || "employee"
    }</td><td>${team ? team.name : "—"}</td><td>${
      plant?.name || "-"
    }</td><td><span class="tag">${status}</span></td>
      <td class="actions"><button class="btn" onclick='editEmployee("${
        e.id
      }")'>Bewerken</button><button class="btn" onclick='lockEmployee("${
      e.id
    }")'>Lock</button></td>`;
    tbody.appendChild(tr);
  });
  if (!state.employees.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Nog geen werknemers…</td></tr>`;
  }
}
function editEmployee(id) {
  const e = state.employees.find((x) => x.id === id);
  const html = `
    <div class="row"><div><label>Voornaam</label><input id="e-fn" value="${e.firstName}"/></div><div><label>Achternaam</label><input id="e-ln" value="${e.lastName}"/></div></div>
    <div class="row"><div><label>Rol</label><select id="e-role"><option value="employee">werknemer</option><option value="supervisor">supervisor</option><option value="manager">manager</option></select></div><div><label>Team</label><select id="e-team"></select></div></div>
    <div class="row"><div><label>Plant</label><select id="e-plant"></select></div><div><label>Status</label><select id="e-status"><option value="active">actief</option><option value="locked">geblokkeerd</option><option value="sick">ziek</option></select></div></div>`;
  ui.open(html, "Werknemer bewerken", async () => {
    await data.employees.update(id, {
      firstName: $("#e-fn").value,
      lastName: $("#e-ln").value,
      role: $("#e-role").value,
      teamId: $("#e-team").value || null,
      plantId: $("#e-plant").value,
      status: $("#e-status").value,
    });
  });
  fillTeamOptions("#e-team", e.teamId);
  fillOptions("plants", "#e-plant", null, e.plantId);
  setTimeout(() => {
    $("#e-role").value = e.role || "employee";
    $("#e-status").value = e.status || "active";
  }, 0);
}
async function lockEmployee(id) {
  await data.employees.update(id, { status: "locked" });
}
window.editEmployee = editEmployee;
window.lockEmployee = lockEmployee;

// === Notifications ===
function renderNotifs() {
  const tbody = $("#notif-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.notifications.forEach((n) => {
    const tr = document.createElement("tr");
    const ts = n.createdAt?.toDate
      ? n.createdAt.toDate()
      : n.createdAt?.seconds
      ? new Date(n.createdAt.seconds * 1000)
      : new Date();
    const toWho = n.toUserId
      ? state.employees.find((e) => e.id === n.toUserId)?.firstName || "—"
      : n.toRole || "—";
    tr.innerHTML = `<td>${ts.toLocaleString()}</td><td>${n.type}</td><td>${
      n.message
    }</td><td>${toWho}</td><td><button class="btn" onclick='removeNotif("${
      n.id
    }")'>Verwijderen</button></td>`;
    tbody.appendChild(tr);
  });
  const latest = $("#latest-notifs");
  latest.innerHTML =
    state.notifications
      .slice(0, 5)
      .map((n) => `<div>• ${n.message}</div>`)
      .join("") || '<span class="muted">Geen meldingen…</span>';
}
async function removeNotif(id) {
  await data.notifications.delete(id);
}
window.removeNotif = removeNotif;

async function notifyUpdate(employeeId, message) {
  await data.notifications.create({
    type: "update",
    toUserId: employeeId,
    message,
  });
}

// === Options helpers ===
async function fillOptions(col, sel, mapFn = null, selected = null) {
  const el = document.querySelector(sel);
  el.innerHTML = "";
  const items = state[col];
  items.forEach((d) => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = mapFn ? mapFn(d) : d.name || d.id;
    if (selected && selected === d.id) o.selected = true;
    el.appendChild(o);
  });
}
function fillTeamOptions(sel, selected = null) {
  const el = document.querySelector(sel);
  el.innerHTML = "";
  state.teams.forEach((t) => {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.name;
    if (selected && selected === t.id) o.selected = true;
    el.appendChild(o);
  });
}

// ==== SUBSCRIPTIONS ====
let unsubscribers = [];
function bootSubscriptions() {
  unsubscribers.forEach((u) => {
    try {
      u();
    } catch {}
  });
  unsubscribers = [];
  const uP = data.subscribe("plants", (rows) => {
    state.plants = rows;
    renderEmployees();
    renderTasks();
  });
  const uE = data.subscribe("employees", (rows) => {
    state.employees = rows;
    renderEmployees();
    renderTasks();
    renderTeams();
    renderBoard();
    renderMy();
  });
  const uT = data.subscribe("tasks", (rows) => {
    state.tasks = rows;
    renderTasks();
    renderBoard();
    renderMy();
    updateKPIs();
  });
  const uN = data.subscribe("notifications", (rows) => {
    state.notifications = rows.sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );
    renderNotifs();
  });
  const uG = data.subscribe("teams", (rows) => {
    state.teams = rows;
    renderTeams();
    renderBoard();
  });
  const uA = data.subscribe("absences", (rows) => {
    state.absences = rows;
    renderMy();
  });
  unsubscribers = [
    uP || (() => {}),
    uE || (() => {}),
    uT || (() => {}),
    uN || (() => {}),
    uG || (() => {}),
    uA || (() => {}),
  ];
}

// ==== INIT: try cloud, else choice ====
async function init() {
  try {
    await data.tryCloud();
    bootSubscriptions();
  } catch (err) {
    banner.style.display = "block";
    console.warn("Cloud niet beschikbaar, toon keuze", err);
  }
}
$("#retry-btn").onclick = () => location.reload();
$("#local-btn").onclick = () => data.useLocal();
init();
