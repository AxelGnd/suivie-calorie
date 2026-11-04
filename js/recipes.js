import { supabaseClient as sb } from "./supabaseClient.js";
import { getFoods } from "./nutrition.js";
import { avatarHtml } from "./account.js";
import { toast, buzz } from "./ui.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n0 = (n) => Math.round(Number(n) || 0);
const r2 = (n) => Math.round(n * 100) / 100;
const msg = (id, t) => { $(id).textContent = t; };
const photoUrl = (p) => (p ? sb.storage.from("recipe-photos").getPublicUrl(p).data.publicUrl : "");
const per = (r, k) => r.recipe_items.reduce((a, i) => a + +i[k], 0) / r.servings;
const cnt = (r, k) => (r[k] && r[k][0] ? r[k][0].count : 0);
const setCnt = (r, k, n) => { r[k] = [{ count: n }]; };
const who = (r) => (r.public_profiles && r.public_profiles.pseudo) || "Membre";

let uid = null, pseudo = null, recipes = [], liked = new Set(), saved = new Set();
let sub = "mine", current = null, draft = [], bound = false, loading = true;

export async function initRecipes(userId) {
  uid = userId; pseudo = null; recipes = []; sub = "mine"; loading = true;
  if (!bound) { bind(); bound = true; }
  syncSubtabs();
  render();
  await load();
}

async function load() {
  const [r, l, s] = await Promise.all([
    sb.from("recipes").select("*, public_profiles(pseudo, avatar_path), recipe_items(*), recipe_likes(count), recipe_comments(count)").order("created_at", { ascending: false }).limit(200),
    sb.from("recipe_likes").select("recipe_id").eq("user_id", uid),
    sb.from("recipe_saves").select("recipe_id").eq("user_id", uid),
  ]);
  loading = false;
  if (r.error) { $("recipe-list").textContent = "Impossible de charger les recettes. Vérifie ta connexion."; return; }
  recipes = r.data;
  liked = new Set((l.data || []).map((x) => x.recipe_id));
  saved = new Set((s.data || []).map((x) => x.recipe_id));
  render();
}

function syncSubtabs() {
  document.querySelectorAll(".subtab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.sub === sub)));
}

const card = (r) => `<button type="button" class="panel rcard" data-open="${r.id}">
  ${r.photo_path ? `<img src="${esc(photoUrl(r.photo_path))}" alt="" loading="lazy">` : `<span class="noimg"></span>`}
  <span class="rinfo"><b>${esc(r.title)}</b><small class="by">${avatarHtml(r.public_profiles, "av-sm")}par ${esc(who(r))}</small><span>${n0(per(r, "calories"))} kcal par portion</span>
  <small>${cnt(r, "recipe_likes")} j’aime, ${cnt(r, "recipe_comments")} commentaires${saved.has(r.id) ? ", enregistrée" : ""}</small></span></button>`;

function render() {
  const only = sub === "community" && $("only-saved").checked;
  const list = recipes.filter((r) => (sub === "mine" ? r.user_id === uid : r.user_id !== uid && (!only || saved.has(r.id))));
  $("saved-filter").classList.toggle("hidden", sub !== "community");
  const empty = sub === "mine" ? "Tu n’as pas encore créé de recette. Touche Nouvelle recette pour commencer."
    : only ? "Tu n’as enregistré aucune recette de la communauté." : "Aucune recette de la communauté pour l’instant.";
  $("recipe-list").innerHTML = loading ? '<div class="skeleton"></div>'.repeat(4) : list.length ? list.map(card).join("") : `<p class="empty">${empty}</p>`;
}

// ---------- Détail d'une recette ----------
const actionsHtml = (r) => `<button type="button" class="btn-ghost" data-act="like" aria-pressed="${liked.has(r.id)}">J’aime (${cnt(r, "recipe_likes")})</button>
  <button type="button" class="btn-ghost" data-act="save" aria-pressed="${saved.has(r.id)}">${saved.has(r.id) ? "Enregistrée" : "Enregistrer"}</button>
  ${r.user_id === uid ? `<button type="button" class="btn-ghost" data-act="del">Supprimer</button>` : ""}`;

function viewHtml(r) {
  return `${r.photo_path ? `<img class="rv-photo" src="${esc(photoUrl(r.photo_path))}" alt="Photo : ${esc(r.title)}">` : ""}
  <h2>${esc(r.title)}</h2>
  <p class="by">${avatarHtml(r.public_profiles, "av-sm")}Par ${esc(who(r))}, pour ${r.servings} portion${r.servings > 1 ? "s" : ""}</p>
  <p><b>${n0(per(r, "calories"))} kcal par portion</b>. Protéines ${n0(per(r, "protein"))} g, glucides ${n0(per(r, "carbs"))} g, lipides ${n0(per(r, "fat"))} g.</p>
  <div class="rv-actions" id="rv-actions">${actionsHtml(r)}</div>
  <h3>Ingrédients</h3>
  <ul>${r.recipe_items.map((i) => `<li><span>${esc(i.food_name)}</span><span>${+i.quantity_g} g</span></li>`).join("")}</ul>
  ${r.instructions ? `<h3>Astuces et instructions</h3><p class="notes">${esc(r.instructions)}</p>` : ""}
  <h3>Commentaires</h3>
  <ul id="rv-comments"></ul>
  <form id="rv-cform"><div class="field"><label for="rv-comment">Ajouter un commentaire</label><input id="rv-comment" maxlength="1000" required autocomplete="off"></div>
  <button type="submit" class="btn-primary">Publier le commentaire</button></form>`;
}

function openView(id) {
  current = recipes.find((r) => r.id === id);
  if (!current) return;
  $("rv-body").innerHTML = viewHtml(current);
  msg("rv-msg", "");
  $("recipe-view").showModal();
  loadComments();
}

async function loadComments() {
  const id = current.id;
  const { data, error } = await sb.from("recipe_comments").select("*, public_profiles(pseudo, avatar_path)").eq("recipe_id", id).order("created_at");
  if (!current || current.id !== id) return;
  $("rv-comments").innerHTML = error ? `<li class="empty">Commentaires indisponibles.</li>`
    : data.length ? data.map((c) => `<li>${avatarHtml(c.public_profiles, "av-sm")} <b>${esc(who(c))}</b> <small>${new Date(c.created_at).toLocaleDateString("fr-FR")}</small><p>${esc(c.body)}</p>${c.user_id === uid ? `<button type="button" class="btn-link" data-cdel="${c.id}">Supprimer</button>` : ""}</li>`).join("")
    : `<li class="empty">Aucun commentaire pour l’instant.</li>`;
  if (!error) { setCnt(current, "recipe_comments", data.length); render(); }
}

async function act(kind) {
  const r = current, set = kind === "like" ? liked : saved, tbl = kind === "like" ? "recipe_likes" : "recipe_saves";
  const on = set.has(r.id);
  const { error } = on
    ? await sb.from(tbl).delete().eq("recipe_id", r.id).eq("user_id", uid)
    : await sb.from(tbl).insert({ recipe_id: r.id });
  if (error) return msg("rv-msg", "Action impossible : " + error.message);
  if (on) set.delete(r.id); else set.add(r.id);
  if (kind === "like") setCnt(r, "recipe_likes", cnt(r, "recipe_likes") + (on ? -1 : 1));
  $("rv-actions").innerHTML = actionsHtml(r);
  buzz();
  render();
}

async function delRecipe() {
  if (!confirm("Supprimer cette recette pour tout le monde ?")) return;
  const r = current;
  const { error } = await sb.from("recipes").delete().eq("id", r.id);
  if (error) return msg("rv-msg", "Suppression impossible : " + error.message);
  if (r.photo_path) sb.storage.from("recipe-photos").remove([r.photo_path]);
  recipes = recipes.filter((x) => x.id !== r.id);
  $("recipe-view").close();
  render();
}

async function addComment(e) {
  e.preventDefault();
  const body = $("rv-comment").value.trim();
  if (!body) return;
  const { error } = await sb.from("recipe_comments").insert({ recipe_id: current.id, body });
  if (error) return msg("rv-msg", "Commentaire impossible : " + error.message);
  $("rv-comment").value = "";
  loadComments();
}

async function delComment(id) {
  const { error } = await sb.from("recipe_comments").delete().eq("id", id);
  if (error) return msg("rv-msg", "Suppression impossible : " + error.message);
  loadComments();
}

// ---------- Création d'une recette ----------
function fillQty() {
  const f = getFoods().find((x) => x.id === $("re-food").value);
  if (f) $("re-qty").value = f.default_portion_g;
}

function drawDraft() {
  $("re-items").innerHTML = draft.map((d, i) => `<li><span>${esc(d.f.name)}, ${d.q} g</span><button type="button" class="btn-x" data-rm="${i}" aria-label="Retirer ${esc(d.f.name)}">✕</button></li>`).join("");
  const k = draft.reduce((a, d) => a + (d.f.calories * d.q) / 100, 0), s = +$("re-servings").value || 1;
  $("re-total").textContent = draft.length ? `Environ ${n0(k / s)} kcal par portion` : "Ajoute au moins un ingrédient.";
}

function openForm() {
  draft = [];
  $("re-form").reset();
  msg("re-msg", "");
  $("re-food").innerHTML = getFoods().map((f) => `<option value="${f.id}">${esc(f.name)} (${n0(f.calories)} kcal/100 g)</option>`).join("");
  fillQty();
  drawDraft();
  $("recipe-edit").showModal();
}

function addItem() {
  const f = getFoods().find((x) => x.id === $("re-food").value), q = +$("re-qty").value;
  if (!f || !(q > 0)) return msg("re-msg", "Choisis un aliment et une quantité en grammes.");
  draft.push({ f, q });
  msg("re-msg", "");
  drawDraft();
}

async function shrink(file) { // réduit la photo (max 1280 px) avant l'envoi
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
}

async function save(e) {
  e.preventDefault();
  if (!draft.length) return msg("re-msg", "Ajoute au moins un ingrédient.");
  const btn = $("re-save");
  btn.disabled = true;
  msg("re-msg", "Publication en cours…");
  let path = null;
  try {
    const file = $("re-photo").files[0];
    if (file) {
      path = `${uid}/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from("recipe-photos").upload(path, await shrink(file), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
    }
    const { data: r, error } = await sb.from("recipes").insert({
      title: $("re-name").value.trim(), servings: +$("re-servings").value,
      instructions: $("re-notes").value.trim() || null, photo_path: path,
    }).select().single();
    if (error) throw error;
    const rows = draft.map(({ f, q }) => ({
      recipe_id: r.id, food_name: f.name, quantity_g: q, calories: r2((f.calories * q) / 100),
      protein: r2((f.protein * q) / 100), carbs: r2((f.carbs * q) / 100), fat: r2((f.fat * q) / 100),
    }));
    const it = await sb.from("recipe_items").insert(rows);
    if (it.error) { await sb.from("recipes").delete().eq("id", r.id); throw it.error; }
    $("recipe-edit").close();
    toast("Recette publiée");
    sub = "mine";
    syncSubtabs();
    await load();
  } catch (err) {
    if (path) sb.storage.from("recipe-photos").remove([path]);
    msg("re-msg", "Publication impossible : " + (err.message || err));
  } finally {
    btn.disabled = false;
  }
}

function bind() {
  document.querySelectorAll(".subtab").forEach((b) => { b.onclick = () => { sub = b.dataset.sub; syncSubtabs(); render(); }; });
  $("only-saved").onchange = render;
  $("recipe-new").onclick = openForm;
  $("recipe-list").onclick = (e) => { const c = e.target.closest("[data-open]"); if (c) openView(c.dataset.open); };
  $("rv-close").onclick = () => $("recipe-view").close();
  $("recipe-view").addEventListener("close", () => { current = null; });
  $("rv-body").onclick = (e) => {
    const a = e.target.closest("[data-act]");
    if (a) return a.dataset.act === "del" ? delRecipe() : act(a.dataset.act);
    const c = e.target.closest("[data-cdel]");
    if (c) delComment(c.dataset.cdel);
  };
  $("rv-body").onsubmit = addComment;
  $("re-close").onclick = () => $("recipe-edit").close();
  $("re-food").onchange = fillQty;
  $("re-add").onclick = addItem;
  $("re-servings").oninput = drawDraft;
  $("re-items").onclick = (e) => { const b = e.target.closest("[data-rm]"); if (b) { draft.splice(+b.dataset.rm, 1); drawDraft(); } };
  $("re-form").onsubmit = save;
}
