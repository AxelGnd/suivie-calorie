import { supabaseClient as sb } from "./supabaseClient.js";
import { PSEUDO_RE, updatePassword, messageErreurAuth } from "./auth.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const say = (id, t, ok) => { const el = $(id); el.textContent = t; el.classList.toggle("ok", !!ok); };

let uid = null, me = null, bound = false;

/** Avatar rond : photo si elle existe, sinon l'initiale du pseudo. */
export function avatarHtml(profile, size = "") {
  const cls = "av " + size;
  if (profile && profile.avatar_path) {
    const url = sb.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl;
    return `<img class="${cls}" src="${esc(url)}" alt="">`;
  }
  return `<span class="${cls}">${esc(((profile && profile.pseudo) || "?")[0].toUpperCase())}</span>`;
}

export async function initAccount(userId) {
  uid = userId;
  me = null;
  if (!bound) { bind(); bound = true; }
  const { data } = await sb.from("public_profiles").select("pseudo, avatar_path").eq("user_id", uid).maybeSingle();
  me = data;
  paint();
}

function paint() {
  if (!me) return;
  $("btn-user").innerHTML = `${avatarHtml(me)}<span>${esc(me.pseudo)}</span>`;
  $("acc-av").innerHTML = avatarHtml(me, "av-lg");
  $("acc-pseudo").textContent = me.pseudo;
  $("new-pseudo").value = me.pseudo;
}

async function square(file, size = 256) { // recadre la photo au centre en carré
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
}

async function changePhoto(e) {
  const file = e.target.files[0];
  if (!file || !me) return;
  say("msg-photo", "Envoi en cours…");
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  try {
    const up = await sb.storage.from("avatars").upload(path, await square(file), { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const { error } = await sb.from("public_profiles").update({ avatar_path: path }).eq("user_id", uid);
    if (error) throw error;
    const old = me.avatar_path;
    me.avatar_path = path;
    paint();
    if (old) sb.storage.from("avatars").remove([old]);
    say("msg-photo", "Photo mise à jour.", true);
  } catch (err) {
    sb.storage.from("avatars").remove([path]);
    say("msg-photo", "Photo impossible : " + (err.message || err));
  }
  e.target.value = "";
}

async function changePseudo(e) {
  e.preventDefault();
  const p = $("new-pseudo").value.trim();
  if (!PSEUDO_RE.test(p)) return say("msg-pseudo", "3 à 20 caractères : lettres, chiffres, _ . ou -");
  const { error } = await sb.from("public_profiles").update({ pseudo: p }).eq("user_id", uid);
  if (error) return say("msg-pseudo", error.code === "23505" ? "Ce pseudo est déjà pris." : "Changement impossible : " + error.message);
  me.pseudo = p;
  paint();
  say("msg-pseudo", "Pseudo mis à jour.", true);
}

async function changeEmail(e) {
  e.preventDefault();
  const email = $("new-email").value.trim();
  const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: window.location.origin + window.location.pathname });
  if (error) return say("msg-email", messageErreurAuth(error));
  e.target.reset();
  say("msg-email", "Un e-mail de confirmation vient d’être envoyé. Clique sur le lien qu’il contient pour valider la nouvelle adresse.", true);
}

async function changePass(e) {
  e.preventDefault();
  const a = $("new-pass").value, b = $("new-pass2").value;
  if (a !== b) return say("msg-pass", "Les deux mots de passe ne sont pas identiques.");
  if (a.length < 6 || !/[a-z]/.test(a) || !/[A-Z]/.test(a) || !/[0-9]/.test(a)) {
    return say("msg-pass", "Le mot de passe doit contenir au moins 6 caractères, une majuscule, une minuscule et un chiffre.");
  }
  try {
    await updatePassword(a);
    e.target.reset();
    say("msg-pass", "Mot de passe mis à jour.", true);
  } catch (err) {
    say("msg-pass", messageErreurAuth(err));
  }
}

function bind() {
  document.querySelectorAll(".usubtab").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".usubtab").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      $("usub-settings").classList.toggle("hidden", b.dataset.usub !== "settings");
      $("usub-account").classList.toggle("hidden", b.dataset.usub !== "account");
    };
  });
  $("form-pseudo").onsubmit = changePseudo;
  $("form-email").onsubmit = changeEmail;
  $("form-pass").onsubmit = changePass;
  $("acc-photo").onchange = changePhoto;
}
