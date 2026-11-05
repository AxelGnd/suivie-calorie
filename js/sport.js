import { supabaseClient as sb } from "./supabaseClient.js";
import { toast, buzz } from "./ui.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const iso = (d) => d.toLocaleDateString("sv-SE");
const n0 = (n) => Math.round(Number(n) || 0);
const n1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const fmt = (n) => n0(n).toLocaleString("fr-FR");
const skeleton = '<div class="skeleton"></div>'.repeat(2);
const emptyMsg = '<p class="empty">Aucune séance ce jour-là. Touche Nouvelle séance pour commencer.</p>';

// Liaison Santé (iPhone) : lien iCloud du raccourci partagé, à coller ici (voir docs/raccourci-sante.md)
const SHORTCUT_URL = "https://www.icloud.com/shortcuts/d2093683f2c14e5cad073bd719099070";
const SHORTCUT_NAME = "Synchro pas"; // doit être identique au nom du raccourci dans l'app Raccourcis (nom simple : ni apostrophe ni accent)
const isIphone = /iPhone|iPod/.test(navigator.userAgent);
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Activités : [nom, type de saisie, MET de base]
// speed = durée + vitesse, strength = séries × répétitions × charge, time = durée + intensité
const ACTS = {
  run: ["Course à pied", "speed"], walk: ["Marche", "speed"], bike: ["Vélo", "speed"],
  strength: ["Musculation", "strength"],
  swim: ["Natation", "time", 7], hiit: ["HIIT, circuit training", "time", 8], rope: ["Corde à sauter", "time", 11],
  row: ["Rameur", "time", 7], ellip: ["Vélo elliptique", "time", 5], hike: ["Randonnée", "time", 6],
  yoga: ["Yoga", "time", 2.5], pilates: ["Pilates", "time", 3], dance: ["Danse", "time", 5],
  foot: ["Football", "time", 7], tennis: ["Tennis", "time", 7], climb: ["Escalade", "time", 8],
};
const INTENSITY = { leger: ["Légère", 0.8], modere: ["Modérée", 1], intense: ["Intense", 1.25] };
const STRENGTH_NAMES = ["Squat", "Développé couché", "Soulevé de terre", "Tractions", "Pompes", "Développé militaire", "Rowing barre", "Fentes", "Gainage"];
const MET = { // valeurs approchées du Compendium des activités physiques
  run: (v) => Math.max(6, v * 1.03),
  walk: (v) => (v <= 3 ? 2.3 : v <= 4 ? 2.9 : v <= 5 ? 3.5 : v <= 6 ? 4.5 : v <= 7 ? 5.5 : 7),
  bike: (v) => (v < 16 ? 4 : v < 19 ? 6 : v < 22 ? 8 : v < 26 ? 10 : 12),
};

/** Calories actives (au-dessus du repos) = (MET − 1) × poids × heures. Approximation. */
function burn(x, kg) {
  const [, kind, base] = ACTS[x.activity];
  let met, min;
  if (kind === "speed") { met = MET[x.activity](x.speed_kmh); min = x.duration_min; }
  else if (kind === "strength") { min = (x.sets * (x.reps * 3 + 60)) / 60; met = x.weight_kg > 0.3 * kg ? 5 : 3.5; }
  else { met = base * INTENSITY[x.intensity][1]; min = x.duration_min; }
  return Math.max(0, (met - 1) * kg * (min / 60));
}

let uid = null, day = iso(new Date()), workouts = [], steps = 0, loading = true, bound = false, draft = [];
let settings = { weight_kg: null, burn_target: 400 };
let link = null; // { created_at, last_used_at } quand le compte Santé est lié
const weight = () => Number(settings.weight_kg) || 70;
const stepsKcal = (n) => n * weight() * 0.0005;

export async function initSport(userId) {
  uid = userId; day = iso(new Date()); workouts = []; steps = 0; loading = true;
  if (!bound) { bind(); bound = true; }
  render();
  if (isIphone) { $("health-panel").classList.remove("hidden"); loadLink(); }
  const { data } = await sb.from("fitness_settings").select("weight_kg, burn_target").maybeSingle();
  if (data) settings = data;
  await loadDay();
}

async function loadDay() {
  const d = day;
  const [w, s] = await Promise.all([
    sb.from("workouts").select("*, workout_items(*)").eq("done_on", d).order("created_at").order("position", { referencedTable: "workout_items" }),
    sb.from("daily_activity").select("steps").eq("day", d).maybeSingle(),
  ]);
  if (d !== day) return;
  loading = false;
  if (w.error) { $("wk-list").textContent = "Impossible de charger tes séances. Vérifie ta connexion."; return; }
  workouts = w.data;
  steps = s.data ? s.data.steps : 0;
  render();
}

const line = (i) => {
  const kind = ACTS[i.activity][1];
  if (kind === "speed") return `${esc(i.name)}, ${n1(i.duration_min)} min à ${n1(i.speed_kmh)} km/h`;
  if (kind === "strength") return `${esc(i.name)}, ${i.sets} × ${i.reps}${i.weight_kg > 0 ? ` à ${n1(i.weight_kg)} kg` : ""}`;
  return `${esc(i.name)}, ${n1(i.duration_min)} min (${INTENSITY[i.intensity][0].toLowerCase()})`;
};

const card = (w) => `<section class="panel wk"><header><h2>${esc(w.title || "Séance")}</h2><span>${n0(w.calories)} kcal</span><button type="button" class="btn-x" data-del="${w.id}" aria-label="Supprimer la séance">✕</button></header>
  <ul>${w.workout_items.map((i) => `<li><span>${line(i)}</span><small>${n0(i.calories)} kcal</small></li>`).join("")}</ul></section>`;

function render() {
  const wk = workouts.reduce((a, w) => a + +w.calories, 0), st = stepsKcal(steps), total = wk + st, target = settings.burn_target;
  $("sp-label").textContent = day === iso(new Date()) ? "Aujourd’hui"
    : new Date(day + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("sp-left").textContent = fmt(total);
  $("sp-caption").textContent = total >= target ? `kcal dépensées, objectif de ${fmt(target)} atteint` : `kcal dépensées sur ${fmt(target)}`;
  $("sp-ring").style.setProperty("--p", Math.min(100, (total / target) * 100));
  $("sp-legend").innerHTML =
    `<li><b>${fmt(wk)} kcal</b><span><i style="background:var(--accent)"></i>Séances</span></li>` +
    `<li><b>${fmt(st)} kcal</b><span><i style="background:var(--accent-2)"></i>${steps.toLocaleString("fr-FR")} pas</span></li>`;
  $("steps-input").value = steps || "";
  $("sp-note").textContent = settings.weight_kg
    ? "Estimation à partir de ton poids et de valeurs MET : un ordre de grandeur, pas une mesure."
    : "Poids estimé à 70 kg. Renseigne le tien dans « Poids et objectif » pour un calcul plus juste.";
  $("wk-list").innerHTML = loading ? skeleton : workouts.length ? workouts.map(card).join("") : emptyMsg;
}

function shift(n) {
  const d = new Date(day + "T12:00");
  d.setDate(d.getDate() + n);
  day = iso(d);
  workouts = []; steps = 0; loading = true;
  render();
  loadDay();
}

// ---------- Pas du jour (saisie manuelle pour l'instant) ----------
async function saveSteps(e) {
  e.preventDefault();
  const n = Math.round(+$("steps-input").value);
  if (!(n >= 0 && n <= 200000)) return toast("Entre un nombre de pas entre 0 et 200 000.");
  const { error } = await sb.from("daily_activity").upsert({ user_id: uid, day, steps: n, source: "manual" });
  if (error) return toast("Enregistrement impossible : " + error.message);
  steps = n;
  render();
  toast("Pas enregistrés");
}

// ---------- Poids et objectif ----------
function openSettings() {
  $("spd-weight").value = settings.weight_kg || "";
  $("spd-target").value = settings.burn_target;
  $("spd-msg").textContent = "";
  $("sport-dlg").showModal();
}

async function saveSettings(e) {
  e.preventDefault();
  const w = +$("spd-weight").value, t = Math.round(+$("spd-target").value);
  if (!(w >= 30 && w <= 300) || !(t >= 50 && t <= 3000)) { $("spd-msg").textContent = "Poids entre 30 et 300 kg, objectif entre 50 et 3 000 kcal."; return; }
  const { error } = await sb.from("fitness_settings").upsert({ user_id: uid, weight_kg: w, burn_target: t });
  if (error) { $("spd-msg").textContent = "Enregistrement impossible : " + error.message; return; }
  settings = { weight_kg: w, burn_target: t };
  $("sport-dlg").close();
  render();
  toast("Poids et objectif enregistrés");
}

// ---------- Nouvelle séance ----------
function showKind() {
  const k = ACTS[$("ex-act").value][1];
  document.querySelectorAll("#wd-form .kind").forEach((el) => el.classList.toggle("hidden", !el.dataset.kinds.split(" ").includes(k)));
  preview();
}

function openWorkout() {
  draft = [];
  $("wd-form").reset();
  $("wd-date").value = day;
  $("wd-msg").textContent = "";
  $("ex-act").innerHTML = Object.entries(ACTS).map(([k, a]) => `<option value="${k}">${a[0]}</option>`).join("");
  $("ex-names").innerHTML = STRENGTH_NAMES.map((n) => `<option value="${n}">`).join("");
  showKind();
  drawDraft();
  $("workout-dlg").showModal();
}

function readEx() { // lit le formulaire d'exercice ; null si incomplet ou incohérent
  const act = $("ex-act").value, kind = ACTS[act][1], x = { activity: act, name: ACTS[act][0] };
  if (kind === "strength") {
    x.name = $("ex-name").value.trim().slice(0, 80) || "Musculation";
    x.sets = Math.round(+$("ex-sets").value);
    x.reps = Math.round(+$("ex-reps").value);
    x.weight_kg = +$("ex-load").value || 0;
    if (!(x.sets > 0 && x.sets <= 50 && x.reps > 0 && x.reps <= 500 && x.weight_kg >= 0 && x.weight_kg <= 1000)) return null;
  } else {
    x.duration_min = +$("ex-dur").value;
    if (!(x.duration_min > 0 && x.duration_min <= 1000)) return null;
    if (kind === "speed") {
      x.speed_kmh = +$("ex-speed").value;
      if (!(x.speed_kmh > 0 && x.speed_kmh <= 60)) return null;
    } else x.intensity = $("ex-int").value;
  }
  x.calories = n1(burn(x, weight()));
  return x;
}

function preview() {
  const x = readEx();
  $("ex-preview").textContent = x ? `Environ ${n0(x.calories)} kcal pour cet exercice` : "";
}

function drawDraft() {
  $("wd-items").innerHTML = draft.map((x, i) => `<li><span>${line(x)}</span><small>${n0(x.calories)} kcal</small><button type="button" class="btn-x" data-rm="${i}" aria-label="Retirer cet exercice">✕</button></li>`).join("");
  const t = draft.reduce((a, x) => a + x.calories, 0);
  $("wd-total").textContent = draft.length ? `Total estimé : ${n0(t)} kcal` : "Ajoute au moins un exercice.";
}

function addEx() {
  const x = readEx();
  if (!x) { $("wd-msg").textContent = "Complète les champs de l’exercice."; return; }
  $("wd-msg").textContent = "";
  draft.push(x);
  drawDraft();
  buzz();
}

async function saveWorkout(e) {
  e.preventDefault();
  const date = $("wd-date").value;
  if (!draft.length) { $("wd-msg").textContent = "Ajoute au moins un exercice."; return; }
  if (!date) { $("wd-msg").textContent = "Choisis un jour."; return; }
  const total = n1(draft.reduce((a, x) => a + x.calories, 0));
  const { data: w, error } = await sb.from("workouts").insert({ done_on: date, title: $("wd-title-in").value.trim() || null, calories: total }).select().single();
  if (error) { $("wd-msg").textContent = "Enregistrement impossible : " + error.message; return; }
  const it = await sb.from("workout_items").insert(draft.map((x, i) => ({ workout_id: w.id, position: i, ...x })));
  if (it.error) {
    await sb.from("workouts").delete().eq("id", w.id);
    $("wd-msg").textContent = "Enregistrement impossible : " + it.error.message;
    return;
  }
  $("workout-dlg").close();
  day = date; workouts = []; loading = true;
  render();
  await loadDay();
  buzz();
  toast("Séance enregistrée");
}

async function delWorkout(id) {
  if (!confirm("Supprimer cette séance ?")) return;
  const { error } = await sb.from("workouts").delete().eq("id", id);
  if (error) return toast("Suppression impossible : " + error.message);
  toast("Séance supprimée");
  loadDay();
}

function bind() {
  $("sp-prev").onclick = () => shift(-1);
  $("sp-next").onclick = () => shift(1);
  $("sp-settings").onclick = openSettings;
  $("sport-form").onsubmit = saveSettings;
  $("spd-close").onclick = () => $("sport-dlg").close();
  $("steps-form").onsubmit = saveSteps;
  $("wk-new").onclick = openWorkout;
  $("wk-list").onclick = (e) => { const b = e.target.closest("[data-del]"); if (b) delWorkout(b.dataset.del); };
  $("wd-close").onclick = () => $("workout-dlg").close();
  $("health-link").onclick = linkHealth;
  $("health-sync").onclick = syncHealth;
  $("health-unlink").onclick = unlinkHealth;
  $("hl-close").onclick = () => $("health-dlg").close();
  $("hl-copy").onclick = copyToken;
  $("health-dlg").addEventListener("close", () => { $("hl-token").textContent = ""; }); // le code n'est montré qu'une fois
  document.addEventListener("visibilitychange", () => { if (!document.hidden && isIphone && link) { loadLink(); loadDay(); } });
  $("ex-act").onchange = showKind;
  $("ex-add").onclick = addEx;
  $("wd-form").oninput = preview;
  $("wd-form").onkeydown = (e) => { if (e.key === "Enter" && e.target.closest(".kind")) { e.preventDefault(); addEx(); } };
  $("wd-form").onsubmit = saveWorkout;
  $("wd-items").onclick = (e) => { const b = e.target.closest("[data-rm]"); if (b) { draft.splice(+b.dataset.rm, 1); drawDraft(); } };
}

// ---------- Liaison avec l'app Santé (iPhone, via un raccourci) ----------
async function loadLink() {
  const { data } = await sb.from("health_tokens").select("created_at, last_used_at").maybeSingle();
  link = data;
  drawHealth();
}

function drawHealth() {
  $("health-unlinked").classList.toggle("hidden", !!link);
  $("health-linked").classList.toggle("hidden", !link);
  if (!link) return;
  $("health-name").textContent = SHORTCUT_NAME;
  $("health-last").textContent = link.last_used_at
    ? "Dernière synchronisation : " + new Date(link.last_used_at).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "Pas encore synchronisé : touche « Synchroniser mes pas » une première fois et accepte les autorisations demandées par iOS.";
}

async function linkHealth() {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await sb.from("health_tokens").upsert({ user_id: uid, token_hash: await sha256(token), last_used_at: null });
  if (error) return toast("Liaison impossible : " + error.message);
  $("hl-token").textContent = token;
  $("hl-open").classList.toggle("hidden", !SHORTCUT_URL);
  $("hl-nolink").classList.toggle("hidden", !!SHORTCUT_URL);
  if (SHORTCUT_URL) $("hl-open").href = SHORTCUT_URL;
  $("hl-copied").textContent = "";
  link = { created_at: new Date().toISOString(), last_used_at: null };
  drawHealth();
  $("health-dlg").showModal();
  copyToken();
}

async function copyToken() {
  try { await navigator.clipboard.writeText($("hl-token").textContent); $("hl-copied").textContent = "Code copié."; }
  catch (e) { $("hl-copied").textContent = "Touche « Copier le code » ou maintiens le code appuyé."; }
}

function syncHealth() { // ouvre Raccourcis, qui envoie les pas puis revient ici
  const back = encodeURIComponent(window.location.origin + window.location.pathname);
  window.location.href = `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&x-success=${back}&x-cancel=${back}&x-error=${back}`;
}

async function unlinkHealth() {
  if (!confirm("Délier ton compte Santé ? Le raccourci ne pourra plus envoyer de pas.")) return;
  const { error } = await sb.from("health_tokens").delete().eq("user_id", uid);
  if (error) return toast("Impossible de délier : " + error.message);
  link = null;
  drawHealth();
  toast("Compte Santé délié");
}
