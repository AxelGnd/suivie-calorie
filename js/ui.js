// Petites interactions partagées : notifications, vibration légère, fenêtres, mot de passe.
const $ = (id) => document.getElementById(id);

/** Notification discrète, avec action facultative (ex. « Annuler »). */
export function toast(text, { action, onAction, ms = 5000 } = {}) {
  const el = document.createElement("div");
  el.className = "toast";
  const span = document.createElement("span");
  span.textContent = text;
  el.appendChild(span);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 200); };
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action;
    b.onclick = () => { if (onAction) onAction(); close(); };
    el.appendChild(b);
  }
  $("toasts").appendChild(el);
  setTimeout(close, ms);
}

/** Vibration courte sur téléphone (ignorée ailleurs). */
export function buzz(ms = 10) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* non supporté */ }
}

export function initUi() {
  // Toucher en dehors d'une fenêtre la ferme
  document.querySelectorAll("dialog:not(#sheet)").forEach((d) => d.addEventListener("click", (e) => {
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));
  // Afficher / masquer un mot de passe
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".pw-toggle");
    if (!b) return;
    const input = $(b.dataset.target);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.textContent = show ? "Masquer" : "Afficher";
    b.setAttribute("aria-pressed", String(show));
  });
}
