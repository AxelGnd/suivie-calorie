import { supabaseClient as sb } from "./supabaseClient.js";

const TYPES = [
  ["petit_dejeuner", "Petit-déjeuner"],
  ["dejeuner", "Déjeuner"],
  ["diner", "Dîner"],
  ["collation", "Collations"],
];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const iso = (d) => d.toLocaleDateString("sv-SE"); // AAAA-MM-JJ en heure locale
const n0 = (n) => Math.round(Number(n) || 0);
const n1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => n0(n).toLocaleString("fr-FR");

let uid = null, day = iso(new Date()), entries = [], foods = [], goal = 2000;
let meal = null, picked = null, bound = false;

export async function initNutrition(userId) {
  uid = userId;
  day = iso(new Date());
  entries = [];
  if (!bound) { bind(); bound = true; }
  render();
  await Promise.all([loadGoal(), loadFoods()]);
  await loadDay();
}

async function loadGoal() {
  const { data } = await sb.from("goals").select("calories_target").maybeSingle();
  goal = data ? data.calories_target : 2000;
}

async function loadFoods() {
  const { data, error } = await sb.from("foods").select("*").order("name");
  if (error) return console.error(error);
  foods = data;
}

async function loadDay() {
  const d = day;
  const { data, error } = await sb.from("meal_entries").select("*").eq("eaten_on", d).order("created_at");
  if (d !== day) return; // l'utilisateur a changé de jour entre-temps
  if (error) { $("meals").textContent = "Impossible de charger ton journal. Vérifie ta connexion."; return; }
  entries = data;
  render();
}

function render() {
  const t = entries.reduce((a, e) => ({ k: a.k + +e.calories, p: a.p + +e.protein, c: a.c + +e.carbs, f: a.f + +e.fat }), { k: 0, p: 0, c: 0, f: 0 });
  const left = goal - t.k;
  $("day-label").textContent = day === iso(new Date())
    ? "Aujourd’hui"
    : new Date(day + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("kcal-left").textContent = fmt(Math.abs(left));
  $("kcal-caption").textContent = left >= 0
    ? `kcal restantes sur ${fmt(goal)}`
    : `kcal au-dessus de ton objectif de ${fmt(goal)}`;
  const bar = $("kcal-bar");
  bar.style.width = Math.min(100, (t.k / goal) * 100) + "%";
  bar.classList.toggle("over", left < 0);
  $("macros").innerHTML = [["Protéines", t.p], ["Glucides", t.c], ["Lipides", t.f]]
    .map(([l, v]) => `<div><strong>${n0(v)} g</strong><span>${l}</span></div>`).join("");
  $("meals").innerHTML = TYPES.map(([key, label]) => {
    const list = entries.filter((e) => e.meal_type === key);
    const sum = list.reduce((a, e) => a + +e.calories, 0);
    const items = list.length
      ? `<ul>${list.map((e) => `<li><div><b>${esc(e.food_name)}</b><small>${n1(e.quantity_g)} g</small></div><span>${n0(e.calories)} kcal</span><button class="btn-x" data-del="${e.id}" aria-label="Supprimer ${esc(e.food_name)}">✕</button></li>`).join("")}</ul>`
      : `<p class="empty">Aucun aliment. Touche Ajouter pour commencer.</p>`;
    return `<section class="panel meal"><header><h2>${label}</h2><span>${n0(sum)} kcal</span><button class="btn-ghost" data-add="${key}" aria-label="Ajouter à ${label}">Ajouter</button></header>${items}</section>`;
  }).join("");
}

function shift(n) {
  const d = new Date(day + "T12:00");
  d.setDate(d.getDate() + n);
  day = iso(d);
  entries = [];
  render();
  loadDay();
}

async function editGoal() {
  const v = prompt("Objectif de calories par jour", goal);
  if (v === null) return;
  const n = Math.round(+v);
  if (!(n >= 1000 && n <= 6000)) { alert("Entre un nombre compris entre 1 000 et 6 000."); return; }
  const { error } = await sb.from("goals").upsert({ user_id: uid, calories_target: n });
  if (error) { alert("Enregistrement impossible : " + error.message); return; }
  goal = n;
  render();
}

function openSheet(key) {
  meal = key;
  picked = null;
  $("sheet-title").textContent = TYPES.find((t) => t[0] === key)[1];
  $("food-search").value = "";
  $("sheet-msg").textContent = "";
  $("entry-form").classList.add("hidden");
  listFoods();
  $("sheet").showModal();
}

function listFoods() {
  const q = $("food-search").value.trim().toLowerCase();
  const res = foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 40);
  $("food-list").innerHTML = res.length
    ? res.map((f) => `<li><button type="button" data-food="${f.id}"><b>${esc(f.name)}</b><small>${n0(f.calories)} kcal / 100 g</small></button></li>`).join("")
    : `<li class="empty">Aucun résultat. Crée cet aliment ci-dessous.</li>`;
}

function pick(id) {
  picked = foods.find((f) => f.id === id);
  if (!picked) return;
  $("picked-name").textContent = picked.name;
  $("qty").value = n1(picked.default_portion_g);
  $("entry-form").classList.remove("hidden");
  preview();
  $("qty").select();
}

function preview() {
  const q = +$("qty").value || 0;
  $("qty-preview").textContent = picked ? `${n0((picked.calories * q) / 100)} kcal` : "";
}

async function addEntry(e) {
  e.preventDefault();
  const q = +$("qty").value;
  if (!picked || !(q > 0)) return;
  const k = q / 100;
  const { error } = await sb.from("meal_entries").insert({
    eaten_on: day, meal_type: meal, food_id: picked.id, food_name: picked.name, quantity_g: q,
    calories: r2(picked.calories * k), protein: r2(picked.protein * k), carbs: r2(picked.carbs * k), fat: r2(picked.fat * k),
  });
  if (error) { $("sheet-msg").textContent = "Ajout impossible : " + error.message; return; }
  $("sheet").close();
  loadDay();
}

async function addFood(e) {
  e.preventDefault();
  const v = (id) => $(id).value;
  const { data, error } = await sb.from("foods").insert({
    name: v("nf-name").trim(), calories: +v("nf-kcal"), protein: +v("nf-p") || 0, carbs: +v("nf-c") || 0, fat: +v("nf-f") || 0,
  }).select().single();
  if (error) { $("sheet-msg").textContent = "Création impossible : " + error.message; return; }
  foods.push(data);
  foods.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  e.target.reset();
  e.target.closest("details").open = false;
  $("sheet-msg").textContent = "";
  listFoods();
  pick(data.id);
}

function bind() {
  $("day-prev").onclick = () => shift(-1);
  $("day-next").onclick = () => shift(1);
  $("goal-edit").onclick = editGoal;
  $("meals").onclick = async (e) => {
    const add = e.target.closest("[data-add]");
    if (add) return openSheet(add.dataset.add);
    const del = e.target.closest("[data-del]");
    if (del) {
      const { error } = await sb.from("meal_entries").delete().eq("id", del.dataset.del);
      if (error) alert("Suppression impossible : " + error.message);
      else loadDay();
    }
  };
  $("food-search").oninput = listFoods;
  $("food-list").onclick = (e) => { const b = e.target.closest("[data-food]"); if (b) pick(b.dataset.food); };
  $("qty").oninput = preview;
  $("entry-form").onsubmit = addEntry;
  $("food-form").onsubmit = addFood;
  $("sheet-close").onclick = () => $("sheet").close();
}
