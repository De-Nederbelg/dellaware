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
const C = (s) => document.querySelector(s),
  A = (s) => Array.from(document.querySelectorAll(s));
const banner = C("#offline-banner"),
  tabs = C("#tabs"),
  roleSel = C("#role-picker"),
  who = C("#whoami");
const S = {
  mode: "cloud",
  meRole: "employee",
  plants: [],
  teams: [],
  employees: [],
  tasks: [],
  notifications: [],
  absences: [],
  holidays: [],
};
const F = {
  apiKey: "AIzaSyDp51JxwZVSENlKIG_DPEns4Y9iQrwYrBw",
  authDomain: "delaware05-5cb47.firebaseapp.com",
  projectId: "delaware05-5cb47",
  storageBucket: "delaware05-5cb47.firebasestorage.app",
  messagingSenderId: "736835481813",
  appId: "1:736835481813:web:af62f316e2712ce39a725c",
  measurementId: "G-KFJGYZ428B",
};
let app, db;
async function initFB() {
  app = initializeApp(F);
  db = getFirestore(app);
  try {
    await enableIndexedDbPersistence(db);
  } catch {}
}
const Local = (() => {
  const KEY = "planning_local_v52b",
    read = () => {
      try {
        return JSON.parse(localStorage.getItem(KEY)) || {};
      } catch {
        return {};
      }
    },
    write = (d) => localStorage.setItem(KEY, JSON.stringify(d));
  let D = Object.assign(
    {
      plants: [],
      teams: [],
      employees: [],
      tasks: [],
      notifications: [],
      absences: [],
      holidays: [],
    },
    read()
  );
  const uid = () => "loc_" + Math.random().toString(36).slice(2, 10),
    now = () => ({ seconds: Math.floor(Date.now() / 1000) });
  if (!D.plants.length) {
    const p1 = {
        id: uid(),
        name: "Plant A",
        location: "Gent, BE",
        lat: 51.05,
        lng: 3.73,
        capacity: 120,
        status: "actief",
      },
      team = { id: uid(), name: "Team Alpha", supervisorId: null },
      e1 = {
        id: uid(),
        firstName: "Sara",
        lastName: "De Vos",
        role: "employee",
        teamId: team.id,
        plantId: p1.id,
        status: "active",
      },
      e2 = {
        id: uid(),
        firstName: "Tom",
        lastName: "Peeters",
        role: "supervisor",
        teamId: team.id,
        plantId: p1.id,
        status: "active",
      },
      t1 = {
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
    D = {
      ...D,
      plants: [p1],
      teams: [team],
      employees: [e1, e2],
      tasks: [t1],
      notifications: [],
      absences: [],
      holidays: [],
    };
    write(D);
  }
  const save = () => write(D);
  return {
    subscribe: (c, cb) => {
      cb(D[c].map((x) => ({ ...x })));
      return () => {};
    },
    list: (c) => Promise.resolve(D[c].map((x) => ({ ...x }))),
    create: (c, data) => {
      const id = uid();
      const rec = { id, ...data };
      if (c === "tasks" || c === "notifications" || c === "holidays")
        rec.createdAt = now();
      D[c].push(rec);
      save();
      return Promise.resolve({ id });
    },
    update: (c, id, p) => {
      const i = D[c].findIndex((x) => x.id === id);
      if (i > -1) {
        D[c][i] = { ...D[c][i], ...p };
        save();
      }
      return Promise.resolve();
    },
    delete: (c, id) => {
      D[c] = D[c].filter((x) => x.id !== id);
      save();
      return Promise.resolve();
    },
  };
})();
const Cloud = (() => ({
  async tryConnect() {
    try {
      await initFB();
      await getDocs(collection(db, "plants"));
      return !0;
    } catch (e) {
      console.warn("Firestore fail", e);
      return !1;
    }
  },
  subscribe: (c, cb) =>
    onSnapshot(collection(db, c), (s) =>
      cb(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    ),
  list: (c) =>
    getDocs(collection(db, c)).then((s) =>
      s.docs.map((d) => ({ id: d.id, ...d.data() }))
    ),
  async create(c, data) {
    if (c === "tasks" || c === "notifications" || c === "holidays")
      data.createdAt = serverTimestamp();
    const ref = await addDoc(collection(db, c), data);
    return { id: ref.id };
  },
  update: (c, id, p) => updateDoc(doc(db, c, id), p),
  delete: (c, id) => deleteDoc(doc(db, c, id)),
}))();
const data = {
  _backend: Cloud,
  async tryCloud() {
    const ok = await Cloud.tryConnect();
    if (!ok) throw new Error("cloud");
    this._backend = Cloud;
    S.mode = "cloud";
  },
  useLocal() {
    this._backend = Local;
    S.mode = "local";
    banner.style.display = "none";
    bootSubs();
  },
  subscribe: (c, cb) => data._backend.subscribe(c, cb),
  list: (c) => data._backend.list(c),
  create: (c, p) => data._backend.create(c, p),
  update: (c, id, p) => data._backend.update(c, id, p),
  delete: (c, id) => data._backend.delete(c, id),
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
  holidays: {
    create: (p) => data.create("holidays", p),
    update: (id, p) => data.update("holidays", id, p),
  },
};
window.data = data;
function gate() {
  const r = S.meRole || "employee";
  A("#tabs [data-role]").forEach((b) => {
    const ok = b.dataset.role.split(" ").includes(r);
    b.style.display = ok ? "inline-flex" : "none";
  });
  A("[data-role]").forEach((el) => {
    const ok = el.dataset.role ? el.dataset.role.split(" ").includes(r) : !0;
    el.classList.toggle("disabled", !ok);
  });
  who.textContent = `ingelogd als: ${r}`;
  r === "manager" || r === "supervisor" ? tab("dashboard") : tab("my");
}
roleSel.addEventListener("change", () => {
  S.meRole = roleSel.value;
  gate();
  board();
  mine();
});
function need(role) {
  if (S.meRole !== role) {
    alert("Niet toegestaan (rol vereist: " + role + ")");
    throw new Error("forbidden");
  }
}
function needAny(...rs) {
  if (!rs.includes(S.meRole)) {
    alert("Niet toegestaan (rollen: " + rs.join(", ") + ")");
    throw new Error("forbidden");
  }
}
function tab(k) {
  A("#tabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === k)
  );
  A(
    "#tab-dashboard,#tab-planning,#tab-tasks,#tab-teams,#tab-map,#tab-notifications,#tab-my"
  ).forEach((s) => s.classList.add("hide"));
  C("#tab-" + k).classList.remove("hide");
  if (k === "planning") board();
  if (k === "my") mine();
  if (k === "teams") teams();
  if (k === "map") map();
  if (k === "tasks") tasks();
}
tabs.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  tab(b.dataset.tab);
});
const ui = {
  open: (html, title = "Bewerken", ok = null) => {
    const m = C("#modal");
    C("#modal-title").textContent = title;
    C("#modal-body").innerHTML = html;
    m.returnValue = "";
    m.showModal();
    if (ok) {
      const h = () => {
        if (m.returnValue !== "cancel") ok();
        m.removeEventListener("close", h);
      };
      m.addEventListener("close", h);
    }
  },
  openTask() {
    need("manager");
    const html = `<div class="row"><div><label>Naam</label><input id="t-name"/></div><div><label>Duur</label><input id="t-dur" type="number" min="0" step="0.5" value="1"/></div></div><div class="row"><div><label>Plant</label><select id="t-plant"></select></div><div><label>Team</label><select id="t-team"></select></div></div><div class="row"><div><label>Teamlid</label><select id="t-emp"><option value="">—</option></select></div><div><label>Datum</label><input id="t-date" type="date"/></div></div><div><label>Status</label><select id="t-status"><option value="open">Open</option><option value="in_progress">In uitvoering</option><option value="done">Afgerond</option></select></div>`;
    ui.open(html, "Nieuwe taak", async () => {
      const name = C("#t-name").value.trim(),
        duration = parseFloat(C("#t-dur").value) || 0,
        plantId = C("#t-plant").value,
        teamId = C("#t-team").value || null,
        employeeId = C("#t-emp").value || null,
        date = C("#t-date").value || null,
        status = C("#t-status").value;
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
    });
    opts("plants", "#t-plant");
    optsTeam("#t-team");
    opts("employees", "#t-emp", (e) => `${e.firstName} ${e.lastName}`);
  },
  ill() {
    const html = `<div class="row"><div><label>Werknemer</label><select id="a-emp"></select></div><div><label>Type</label><div class="badge">Ziekte</div></div></div><div class="row"><div><label>Van</label><input id="a-from" type="date"/></div><div><label>Tot</label><input id="a-to" type="date"/></div></div>`;
    ui.open(html, "Ziekte melden", async () => {
      const e = C("#a-emp").value,
        f = C("#a-from").value,
        t = C("#a-to").value;
      if (!e || !f || !t) return;
      await data.absences.create({
        employeeId: e,
        type: "illness",
        from: f,
        to: t,
      });
      await data.notifications.create({
        type: "illness",
        toRole: "manager",
        message: `Ziekte gemeld door ${e} van ${f} tot ${t}`,
      });
    });
    empList("#a-emp");
  },
  hol() {
    const html = `<div class="row"><div><label>Werknemer</label><select id="h-emp"></select></div><div><label>Status</label><div class="badge">Ingediend</div></div></div><div class="row"><div><label>Van</label><input id="h-from" type="date"/></div><div><label>Tot</label><input id="h-to" type="date"/></div></div>`;
    ui.open(html, "Vakantie aanvragen", async () => {
      const e = C("#h-emp").value,
        f = C("#h-from").value,
        t = C("#h-to").value;
      if (!e || !f || !t) return;
      await data.holidays.create({
        employeeId: e,
        from: f,
        to: t,
        status: "requested",
      });
      await data.notifications.create({
        type: "holiday",
        toRole: "supervisor",
        message: `Vakantie aangevraagd door ${e} (${f} → ${t})`,
      });
    });
    empList("#h-emp");
  },
};
window.ui = ui;
function empList(sel) {
  const p = C("#modal-body");
  const old = p.querySelector(sel);
  if (!old) return;
}
function stat(s) {
  return s === "open"
    ? "Open"
    : s === "in_progress"
    ? "In uitvoering"
    : "Afgerond";
}
async function delTask(id) {
  need("manager");
  if (confirm("Taak verwijderen?")) await data.tasks.delete(id);
}
function editTask(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  const html = `<div class="row"><div><label>Naam</label><input id="et-name" value="${
    t.name || ""
  }"/></div><div><label>Duur</label><input id="et-dur" type="number" min="0" step="0.5" value="${
    t.duration || 0
  }"/></div></div><div class="row"><div><label>Status</label><select id="et-status"><option value="open">Open</option><option value="in_progress">In uitvoering</option><option value="done">Afgerond</option></select></div><div><label>Datum</label><input id="et-date" type="date" value="${
    t.date || ""
  }"/></div></div>`;
  ui.open(html, "Taak bewerken", async () => {
    await data.tasks.update(id, {
      name: C("#et-name").value,
      duration: parseFloat(C("#et-dur").value) || 0,
      status: C("#et-status").value,
      date: C("#et-date").value || null,
    });
  });
  setTimeout(() => {
    C("#et-status").value = t.status || "open";
  }, 0);
}
async function assignTask(id) {
  need("manager");
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  const html = `<div class="row"><div><label>Team</label><select id="as-team"></select></div><div><label>Teamlid</label><select id="as-emp"></select></div></div><div><label>Datum</label><input id="as-date" type="date" value="${
    t.date || ""
  }"/></div>`;
  ui.open(html, "Taak toewijzen", async () => {
    const g = C("#as-team").value || null,
      e = C("#as-emp").value || null,
      d = C("#as-date").value || null;
    await data.tasks.update(id, { teamId: g, employeeId: e, date: d });
  });
  optsTeam("#as-team", t.teamId);
  opts(
    "employees",
    "#as-emp",
    (e) => `${e.firstName} ${e.lastName}`,
    t.employeeId || ""
  );
}
window.assignTask = assignTask;
window.editTask = editTask;
window.removeTask = delTask;
function KPI() {
  const o = S.tasks.filter((t) => t.status === "open").length,
    p = S.tasks.filter((t) => t.status === "in_progress").length,
    d = S.tasks.filter((t) => t.status === "done").length,
    s = S.employees.filter((e) => e.status === "sick").length;
  C("#kpi-open").textContent = o;
  C("#kpi-inprogress").textContent = p;
  C("#kpi-done").textContent = d;
  C("#kpi-sick").textContent = s;
  chart();
}
function tasks() {
  const team = C("#task-team")?.value || "",
    st = C("#task-status")?.value || "",
    dt = C("#task-date")?.value || "",
    tbody = C("#task-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rows = S.tasks
    .filter((t) => {
      if (team && t.teamId !== team) return !1;
      if (st && t.status !== st) return !1;
      if (dt && t.date !== dt) return !1;
      return !0;
    })
    .map((t) => {
      const plant = S.plants.find((p) => p.id === t.plantId),
        emp = S.employees.find((e) => e.id === t.employeeId),
        g = S.teams.find((x) => x.id === t.teamId);
      return `<tr><td>${t.name || "-"}</td><td>${plant?.name || "-"}</td><td>${
        g?.name || "—"
      }</td><td>${emp ? `${emp.firstName} ${emp.lastName}` : "—"}</td><td>${
        t.duration || 0
      }</td><td>${t.date || "—"}</td><td><span class="tag">${stat(
        t.status
      )}</span></td><td class="actions"><button class="btn" onclick='assignTask("${
        t.id
      }")' data-role="manager">Toewijzen</button><button class="btn" onclick='editTask("${
        t.id
      }")' data-role="manager supervisor">Bewerken</button><button class="btn" onclick='removeTask("${
        t.id
      }")' data-role="manager">Verwijderen</button></td></tr>`;
    })
    .join("");
  tbody.innerHTML =
    rows || `<tr><td colspan="8" class="muted">Geen taken gevonden.</td></tr>`;
  KPI();
}
function teams() {
  const host = C("#team-list");
  if (!host) return;
  host.innerHTML = "";
  S.teams.forEach((t) => {
    const sup = S.employees.find((e) => e.id === t.supervisorId),
      mem = S.employees.filter((e) => e.teamId === t.id);
    const div = document.createElement("div");
    div.className = "panel";
    div.innerHTML = `<h2>${
      t.name
    }</h2><div class="content"><div class="row"><div><span class="muted">Supervisor</span><div>${
      sup ? sup.firstName + " " + sup.lastName : "—"
    }</div></div><div><span class="muted">Leden</span><div>${
      mem.map((m) => m.firstName + " " + m.lastName).join(", ") || "—"
    }</div></div></div><div class="actions" style="margin-top:12px"><button class="btn" onclick='assignToTeam("${
      t.id
    }")' data-role="manager">Lid toevoegen</button></div></div>`;
    host.appendChild(div);
  });
  if (!S.teams.length) {
    host.innerHTML = `<div class="muted">Nog geen teams… Voeg er één toe.</div>`;
  }
}
function assignToTeam(id) {
  const t = S.teams.find((x) => x.id === id);
  ui.open(
    `<div><label>Teamleden</label><select id="team-member"></select></div>`,
    `Teamlid toevoegen aan ${t.name}`,
    async () => {
      const emp = C("#team-member").value;
      if (!emp) return;
      await data.employees.update(emp, { teamId: t.id });
    }
  );
  opts(
    "employees",
    "#team-member",
    (e) => `${e.firstName} ${e.lastName} (${e.role || "employee"})`
  );
}
window.assignToTeam = assignToTeam;
function board() {
  const team = C("#board-team"),
    date = C("#board-date");
  if (!team.value && S.teams[0]) team.value = S.teams[0].id;
  const g = team.value || null,
    dt = date.value || null,
    u = C("#board-unassigned"),
    a = C("#board-assigned");
  u.innerHTML = "";
  a.innerHTML = "";
  const un = S.tasks.filter((t) => !t.employeeId && (!g || t.teamId === g)),
    as = S.tasks.filter(
      (t) => t.employeeId && (!g || t.teamId === g) && (!dt || t.date === dt)
    );
  un.forEach((t) => u.appendChild(card(t, !0)));
  as.forEach((t) => a.appendChild(card(t, !1)));
}
function card(t, can) {
  const d = document.createElement("div");
  d.className = "task-card";
  const e = S.employees.find((x) => x.id === t.employeeId);
  d.innerHTML = `<b>${t.name}</b><div class="meta">duur: ${
    t.duration || 0
  }u • datum: ${t.date || "—"} • ${
    e ? "toegewezen aan: " + e.firstName + " " + e.lastName : "niet toegewezen"
  }</div><div class="actions" style="margin-top:8px">${
    can
      ? `<button class="btn" onclick='assignTask("${t.id}")' data-role="manager">Toewijzen</button>`
      : ""
  }<button class="btn" onclick='editTask("${
    t.id
  }")' data-role="manager supervisor">Bewerken</button></div>`;
  return d;
}
function mine() {
  const c = C("#my-planning"),
    a = C("#my-absences");
  if (!c) return;
  let ts = [];
  if (S.meRole === "supervisor") {
    const g = S.teams[0]?.id;
    ts = S.tasks.filter((t) => t.teamId === g);
  } else if (S.meRole === "manager") {
    ts = [];
  } else {
    const me = S.employees[0]?.id;
    ts = S.tasks.filter((t) => t.employeeId === me);
  }
  c.innerHTML =
    ts
      .map(
        (t) =>
          `<div class="task-card"><b>${t.name}</b><div class="meta">${
            t.date || "—"
          } • ${stat(t.status)} • ${t.duration || 0}u</div></div>`
      )
      .join("") || '<div class="muted">Geen taken.</div>';
  a.innerHTML = myAbs();
}
function myAbs() {
  const me = S.employees[0]?.id,
    ill = S.absences.filter((a) => a.employeeId === me),
    hol = S.holidays.filter((h) => h.employeeId === me),
    i = ill.map((a) => `<div>🤒 ${a.from} → ${a.to}</div>`).join(""),
    h = hol
      .map(
        (h) =>
          `<div>🏖️ ${h.from} → ${h.to} <span class="badge">${h.status}</span></div>`
      )
      .join("");
  return i + h || '<div class="muted">Geen afwezigheden.</div>';
}
function opts(col, sel, map = null, selId = null) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.innerHTML = "";
  (S[col] || []).forEach((d) => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = map ? map(d) : d.name || d.id;
    if (selId && selId === d.id) o.selected = !0;
    el.appendChild(o);
  });
}
function optsTeam(sel, selId = null) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.innerHTML = "";
  (S.teams || []).forEach((t) => {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.name;
    if (selId && selId === t.id) o.selected = !0;
    el.appendChild(o);
  });
}
function notifs() {
  const tbody = C("#notif-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  const hol = S.holidays.map((h) => ({
      createdAt: h.createdAt,
      type: "holiday",
      message: `Vakantie ${h.from} → ${h.to}`,
      receiver: "supervisor/manager",
      status: h.status,
      id: h.id,
    })),
    ill = S.notifications
      .filter((n) => n.type === "illness")
      .map((n) => ({
        createdAt: n.createdAt,
        type: "illness",
        message: n.message,
        receiver: n.toRole,
        status: "info",
        id: n.id,
      })),
    rows = [...hol, ...ill].sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );
  rows.forEach((r) => {
    const ts = r.createdAt?.seconds
      ? new Date(r.createdAt.seconds * 1000)
      : new Date();
    let act = "";
    if (
      r.type === "holiday" &&
      (S.meRole === "manager" || S.meRole === "supervisor")
    ) {
      act = `<button class="btn" onclick='approve("${r.id}")'>Goedkeuren</button><button class="btn" onclick='deny("${r.id}")'>Afkeuren</button>`;
    } else {
      act = `<button class="btn" onclick='remNotif("${r.id}")'>Verwijderen</button>`;
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${ts.toLocaleString()}</td><td>${r.type}</td><td>${
      r.message
    }</td><td>${r.receiver || "—"}</td><td><span class="badge">${
      r.status
    }</span></td><td class="actions">${act}</td>`;
    tbody.appendChild(tr);
  });
  C("#latest-notifs").innerHTML =
    S.notifications
      .slice(0, 5)
      .map((n) => `<div>• ${n.message}</div>`)
      .join("") || '<span class="muted">Geen meldingen…</span>';
}
async function approve(id) {
  await data.holidays.update(id, { status: "approved" });
}
async function deny(id) {
  await data.holidays.update(id, { status: "denied" });
}
async function remNotif(id) {
  await data.notifications.delete(id);
}
window.approve = approve;
window.deny = deny;
window.remNotif = remNotif;
let _map,
  _layer,
  _add = !1;
const DEF = { center: [50.85, 4.35], zoom: 7 };
function map() {
  const el = C("#map");
  if (!el) return;
  if (!_map) {
    _map = L.map("map", { zoomControl: !0 }).setView(DEF.center, DEF.zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(_map);
    _map.on("click", async (e) => {
      if (!_add) return;
      const { lat, lng } = e.latlng;
      ui.open(
        `<div class="row"><div><label>Plantnaam</label><input id="p-name"/></div><div><label>Capaciteit</label><input id="p-cap" type="number" min="0" value="80"/></div></div><div class="row"><div><label>Locatie</label><input id="p-loc"/></div><div><label>Status</label><select id="p-status"><option value="actief">actief</option><option value="in_opbouw">in opbouw</option><option value="gesloten">gesloten</option></select></div></div><small class="muted">Nieuwe plant op ${lat.toFixed(
          5
        )}, ${lng.toFixed(5)}</small>`,
        "Nieuwe plant",
        async () => {
          const name = C("#p-name").value.trim(),
            cap = parseInt(C("#p-cap").value || "0", 10),
            loc = C("#p-loc").value.trim(),
            st = C("#p-status").value;
          if (!name) return;
          await data.plants.create({
            name: name,
            capacity: cap,
            location: loc,
            status: st,
            lat,
            lng,
          });
        }
      );
    });
  }
  if (_layer) _layer.remove();
  _layer = L.layerGroup().addTo(_map);
  (S.plants || []).forEach((p) => {
    if (!(p.lat && p.lng)) return;
    const m = L.marker([p.lat, p.lng], { draggable: !0 }).addTo(_layer);
    m.bindPopup(plantPopup(p));
    m.on("dragend", async (ev) => {
      const { lat, lng } = ev.target.getLatLng();
      await data.plants.update(p.id, { lat, lng });
    });
    m.on("click", () => {
      hl(p.id);
      _map.setView([p.lat, p.lng], Math.max(_map.getZoom(), 12), {
        animate: !0,
      });
    });
  });
  mapInfo();
  controls();
}
function plantPopup(p) {
  const k = kpi(p.id),
    html = `<div style="min-width:220px"><b>${esc(
      p.name
    )}</b><br/><span class="muted">${esc(
      p.location || "—"
    )}</span><div class="row" style="margin-top:8px"><div><span class="muted">Capaciteit</span><div>${
      p.capacity ?? "—"
    }</div></div><div><span class="muted">Status</span><div><span class="badge">${esc(
      p.status || "—"
    )}</span></div></div></div><div class="row" style="margin-top:8px"><div><span class="muted">Werknemers</span><div>${
      k.employees
    }</div></div><div><span class="muted">Zieken</span><div>${
      k.sick
    }</div></div></div><div class="row" style="margin-top:8px"><div><span class="muted">Open</span><div>${
      k.open
    }</div></div><div><span class="muted">Toegewezen</span><div>${
      k.assigned
    }</div></div></div><div class="actions" style="margin-top:10px"><button class="btn" data-act="focus" data-id="${
      p.id
    }">Focus</button><button class="btn" data-act="edit" data-id="${
      p.id
    }" data-role="manager">Bewerken</button><button class="btn" data-act="del" data-id="${
      p.id
    }" data-role="manager">Verwijderen</button></div></div>`;
  setTimeout(() => {
    const c = document.querySelector(".leaflet-popup-content");
    if (!c) return;
    c.addEventListener(
      "click",
      async (e) => {
        const b = e.target.closest("button[data-act]");
        if (!b) return;
        const id = b.getAttribute("data-id"),
          act = b.getAttribute("data-act"),
          pl = S.plants.find((x) => x.id === id);
        if (!pl) return;
        if (act === "focus") {
          _map.setView([pl.lat, pl.lng], Math.max(_map.getZoom(), 12), {
            animate: !0,
          });
          hl(id);
        }
        if (act === "edit") {
          need("manager");
          editPlant(pl);
        }
        if (act === "del") {
          need("manager");
          if (confirm(`Plant "${pl.name}" verwijderen?`))
            await data.plants.delete(id);
        }
      },
      { once: !0 }
    );
  }, 0);
  return html;
}
function editPlant(p) {
  ui.open(
    `<div class="row"><div><label>Plantnaam</label><input id="ep-name" value="${attr(
      p.name || ""
    )}"/></div><div><label>Capaciteit</label><input id="ep-cap" type="number" min="0" value="${
      p.capacity ?? 0
    }"/></div></div><div class="row"><div><label>Locatie</label><input id="ep-loc" value="${attr(
      p.location || ""
    )}"/></div><div><label>Status</label><select id="ep-status"><option value="actief">actief</option><option value="in_opbouw">in opbouw</option><option value="gesloten">gesloten</option></select></div></div><div class="row"><div><label>Breedtegraad</label><input id="ep-lat" type="number" step="0.000001" value="${
      p.lat ?? ""
    }"/></div><div><label>Lengtegraad</label><input id="ep-lng" type="number" step="0.000001" value="${
      p.lng ?? ""
    }"/></div></div>`,
    "Plant bewerken",
    async () => {
      await data.plants.update(p.id, {
        name: C("#ep-name").value.trim(),
        capacity: parseInt(C("#ep-cap").value || "0", 10),
        location: C("#ep-loc").value.trim(),
        status: C("#ep-status").value,
        lat: parseFloat(C("#ep-lat").value),
        lng: parseFloat(C("#ep-lng").value),
      });
    }
  );
  setTimeout(() => {
    C("#ep-status").value = p.status || "actief";
  }, 0);
}
function mapInfo() {
  const host = C("#map-info");
  if (!host) return;
  const tb = "map-toolbar";
  if (!document.getElementById(tb)) {
    const bar = document.createElement("div");
    bar.id = tb;
    bar.className = "actions";
    bar.style.margin = "8px 0 12px 0";
    bar.innerHTML = `<button class="btn" id="btn-add-plant">Plant toevoegen</button><button class="btn ghost" id="btn-reset-view">Reset view</button>`;
    host.parentElement.insertBefore(bar, host);
    document.getElementById("btn-add-plant").onclick = toggleAdd;
    document.getElementById("btn-reset-view").onclick = () =>
      _map.setView(DEF.center, DEF.zoom, { animate: !0 });
  } else {
    const b = document.getElementById("btn-add-plant");
    if (b) {
      b.classList.toggle("primary", _add);
      b.textContent = _add ? "Klik op de kaart…" : "Plant toevoegen";
    }
  }
  host.innerHTML =
    (S.plants || [])
      .map((p) => {
        const k = kpi(p.id);
        return `<div class="kpi plant-card" data-plant="${
          p.id
        }" style="cursor:pointer"><span class="muted">${esc(p.name)}</span><b>${
          k.assigned
        }/${k.open + k.done}</b></div>`;
      })
      .join("") || '<div class="muted">Geen plants.</div>';
  host.querySelectorAll(".plant-card").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-plant"),
        p = S.plants.find((x) => x.id === id);
      if (!p) return;
      _map.setView([p.lat, p.lng], Math.max(_map.getZoom(), 12), {
        animate: !0,
      });
      const tmp = L.marker([p.lat, p.lng]).addTo(_map);
      tmp.bindPopup(plantPopup(p)).openPopup();
      setTimeout(() => _map.removeLayer(tmp), 50);
      hl(id);
    });
  });
}
function controls() {
  const b = document.getElementById("btn-add-plant");
  if (b) {
    b.classList.toggle("primary", _add);
    b.textContent = _add ? "Klik op de kaart…" : "Plant toevoegen";
  }
}
function toggleAdd() {
  _add = !_add;
  const b = document.getElementById("btn-add-plant");
  if (b) {
    b.classList.toggle("primary", _add);
    b.textContent = _add ? "Klik op de kaart…" : "Plant toevoegen";
  }
  if (_add) {
    const hint = document.createElement("div");
    hint.className = "badge";
    hint.textContent = "Klik op de kaart om te plaatsen";
    hint.style.position = "absolute";
    hint.style.right = "12px";
    hint.style.top = "12px";
    hint.style.zIndex = "400";
    hint.id = "map-hint";
    document.getElementById("tab-map").appendChild(hint);
  } else {
    const e = document.getElementById("map-hint");
    if (e) e.remove();
  }
}
function hl(id) {
  document
    .querySelectorAll(".plant-card")
    .forEach((c) => (c.style.outline = "none"));
  const el = document.querySelector(`.plant-card[data-plant="${id}"]`);
  if (el) {
    el.style.outline = "2px solid var(--brand-primary)";
    setTimeout(() => {
      el.style.outline = "none";
    }, 1200);
  }
}
function kpi(pid) {
  const em = (S.employees || []).filter((e) => e.plantId === pid),
    s = em.filter((e) => e.status === "sick").length,
    ts = (S.tasks || []).filter((t) => t.plantId === pid),
    as = ts.filter((t) => t.employeeId).length,
    o = ts.filter((t) => t.status === "open").length,
    d = ts.filter((t) => t.status === "done").length;
  return { employees: em.length, sick: s, assigned: as, open: o, done: d };
}
function chart() {
  const el = C("#chart-month");
  if (!el) return;
  const days = [...new Array(30)].map((_, i) => i + 1),
    vals = days.map(
      (d) =>
        (S.tasks || []).filter(
          (t) =>
            t.status === "done" &&
            (t.date || "").split("-")[2] === String(d).padStart(2, "0")
        ).length
    ),
    mx = Math.max(1, ...vals),
    w = el.clientWidth || 600,
    h = 160,
    st = w / (days.length - 1),
    pts = vals
      .map((v, i) => `${i * st},${h - 10 - (v / mx) * (h - 30)}`)
      .join(" ");
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="#b5121b" stroke-width="2" points="${pts}"></polyline></svg>`;
}
const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    ),
  attr = (s) => esc(s).replace(/"/g, "&quot;");
let unsubs = [];
function bootSubs() {
  unsubs.forEach((u) => {
    try {
      u();
    } catch {}
  });
  unsubs = [];
  const uP = data.subscribe("plants", (r) => {
      S.plants = r;
      employees();
      tasks();
      map();
    }),
    uE = data.subscribe("employees", (r) => {
      S.employees = r;
      employees();
      tasks();
      teams();
      board();
      mine();
      map();
    }),
    uT = data.subscribe("tasks", (r) => {
      S.tasks = r;
      tasks();
      board();
      mine();
      KPI();
      map();
    }),
    uN = data.subscribe("notifications", (r) => {
      S.notifications = r.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      notifs();
    }),
    uG = data.subscribe("teams", (r) => {
      S.teams = r;
      teams();
      board();
    }),
    uA = data.subscribe("absences", (r) => {
      S.absences = r;
      mine();
    }),
    uH = data.subscribe("holidays", (r) => {
      S.holidays = r;
      notifs();
      mine();
    });
  unsubs = [
    uP || (() => {}),
    uE || (() => {}),
    uT || (() => {}),
    uN || (() => {}),
    uG || (() => {}),
    uA || (() => {}),
    uH || (() => {}),
  ];
}
function employees() {
  /* optional table in later extension; keep for consistency */
}
async function init() {
  try {
    await data.tryCloud();
  } catch {
    banner.style.display = "block";
  }
  bootSubs();
  S.meRole = roleSel.value;
  gate();
  tasks();
  teams();
  board();
  mine();
  notifs();
  map();
  chart();
  // Wire buttons (explicit to avoid "doet niets")
  C("#btn-new-task")?.addEventListener("click", () => ui.openTask());
  C("#btn-task-add")?.addEventListener("click", () => ui.openTask());
  C("#btn-illness")?.addEventListener("click", () => ui.ill());
  C("#btn-illness2")?.addEventListener("click", () => ui.ill());
  C("#btn-holiday")?.addEventListener("click", () => ui.hol());
  C("#btn-holiday2")?.addEventListener("click", () => ui.hol());
  C("#btn-export")?.addEventListener("click", () =>
    alert("CSV-export demo in PoC")
  );
}
C("#retry-btn").onclick = () => location.reload();
C("#local-btn").onclick = () => data.useLocal();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
