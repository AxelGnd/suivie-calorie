import { signUp, signIn, signOut, getSession, onAuthStateChange, messageErreurAuth } from "./auth.js";
import { THEMES, applyTheme, getCachedTheme, chargerThemeDepuisProfil, changerTheme } from "./theme.js";

// Applique tout de suite un thème (cache local) pour éviter un flash
// non stylé pendant que Supabase répond.
applyTheme(getCachedTheme());

const els = {
  loading: document.getElementById("screen-loading"),
  auth: document.getElementById("screen-auth"),
  app: document.getElementById("screen-app"),
  authTitle: document.getElementById("auth-title"),
  authSubtitle: document.getElementById("auth-subtitle"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authSubmit: document.getElementById("auth-submit"),
  authMessageArea: document.getElementById("auth-message-area"),
  authSwitchText: document.getElementById("auth-switch-text"),
  authSwitchBtn: document.getElementById("auth-switch-btn"),
  userEmail: document.getElementById("user-email"),
  btnLogout: document.getElementById("btn-logout"),
  themeGrid: document.getElementById("theme-grid"),
  themeSyncStatus: document.getElementById("theme-sync-status"),
};

let mode = "login"; // ou "signup"
let currentUserId = null;

function afficherEcran(nom) {
  els.loading.classList.toggle("hidden", nom !== "loading");
  els.auth.classList.toggle("hidden", nom !== "auth");
  els.app.classList.toggle("hidden", nom !== "app");
}

function afficherMessageAuth(texte, type) {
  if (!texte) { els.authMessageArea.innerHTML = ""; return; }
  els.authMessageArea.innerHTML = `<div class="auth-message ${type}">${texte}</div>`;
}

function basculerMode() {
  mode = mode === "login" ? "signup" : "login";
  afficherMessageAuth("", "");
  if (mode === "signup") {
    els.authTitle.textContent = "Créer un compte";
    els.authSubtitle.textContent = "Tes données te suivront sur tous tes appareils.";
    els.authSubmit.textContent = "Créer mon compte";
    els.authSwitchText.textContent = "Déjà un compte ?";
    els.authSwitchBtn.textContent = "Se connecter";
  } else {
    els.authTitle.textContent = "Connexion";
    els.authSubtitle.textContent = "Accède à tes données, synchronisées partout.";
    els.authSubmit.textContent = "Se connecter";
    els.authSwitchText.textContent = "Pas encore de compte ?";
    els.authSwitchBtn.textContent = "Créer un compte";
  }
}

els.authSwitchBtn.addEventListener("click", basculerMode);

els.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  afficherMessageAuth("", "");
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;

  els.authSubmit.disabled = true;
  try {
    if (mode === "login") {
      await signIn(email, password);
      // onAuthStateChange se charge d'afficher l'écran app
    } else {
      const data = await signUp(email, password);
      if (data.session) {
        // Confirmation email désactivée sur ce projet : connexion immédiate.
        // On repasse quand même le formulaire en mode "connexion" pour la prochaine fois.
        mode = "login";
      } else {
        afficherMessageAuth(
          "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.",
          "info"
        );
        basculerMode(); // repasse en mode connexion
      }
    }
  } catch (error) {
    afficherMessageAuth(messageErreurAuth(error), "error");
  } finally {
    els.authSubmit.disabled = false;
  }
});

els.btnLogout.addEventListener("click", async () => {
  try { await signOut(); } catch (error) { console.error(error); }
});

function rendreSelecteurTheme(themeActif) {
  els.themeGrid.innerHTML = "";
  THEMES.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-option" + (t.key === themeActif ? " active" : "");
    btn.innerHTML = `
      <div class="swatches">
        ${t.swatches.map((c) => `<span class="swatch" style="background:${c}"></span>`).join("")}
      </div>
      <div class="theme-name">${t.nom}</div>
      <div class="theme-desc">${t.description}</div>
    `;
    btn.addEventListener("click", async () => {
      applyTheme(t.key);
      Array.from(els.themeGrid.children).forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      els.themeSyncStatus.textContent = "Synchronisation...";
      els.themeSyncStatus.classList.remove("offline");
      const ok = await changerTheme(currentUserId, t.key);
      els.themeSyncStatus.textContent = ok
        ? "Synchronisé sur tous tes appareils"
        : "Enregistré sur cet appareil (pas de connexion pour synchroniser)";
      els.themeSyncStatus.classList.toggle("offline", !ok);
    });
    els.themeGrid.appendChild(btn);
  });
}

async function afficherApp(session) {
  currentUserId = session.user.id;
  els.userEmail.textContent = session.user.email;
  const themeActif = await chargerThemeDepuisProfil(currentUserId);
  rendreSelecteurTheme(themeActif || getCachedTheme() || THEMES[0].key);
  afficherEcran("app");
}

onAuthStateChange((session) => {
  if (session) {
    afficherApp(session);
  } else {
    currentUserId = null;
    els.authForm.reset();
    afficherEcran("auth");
  }
});

// État initial au chargement de la page
(async function init() {
  try {
    const session = await getSession();
    if (session) {
      await afficherApp(session);
    } else {
      afficherEcran("auth");
    }
  } catch (error) {
    console.error("Impossible de vérifier la session :", error);
    afficherEcran("auth");
  }
})();
