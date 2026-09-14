import { supabaseClient } from "./supabaseClient.js";

const THEME_CACHE_KEY = "app_theme_cache_v1";

export const THEMES = [
  {
    key: "nocturne",
    nom: "Nocturne",
    description: "Sombre et raffiné",
    swatches: ["#10141c", "#d4a44c", "#4fd1c5"],
  },
  {
    key: "clarte",
    nom: "Clarté",
    description: "Épuré et précis",
    swatches: ["#fafbfc", "#2563eb", "#10b981"],
  },
  {
    key: "seve",
    nom: "Sève",
    description: "Chaleureux et organique",
    swatches: ["#fcf3e6", "#6b8f71", "#e1a15a"],
  },
  {
    key: "pulse",
    nom: "Pulse",
    description: "Sportif et énergique",
    swatches: ["#f2f3f5", "#ff4d4d", "#2d9cdb"],
  },
];

const VALID_KEYS = THEMES.map((t) => t.key);

/** Applique un thème au document (juste du CSS, aucun accès réseau). */
export function applyTheme(themeKey) {
  const key = VALID_KEYS.includes(themeKey) ? themeKey : THEMES[0].key;
  document.documentElement.setAttribute("data-theme", key);
  try { localStorage.setItem(THEME_CACHE_KEY, key); } catch (e) { /* stockage indisponible, tant pis */ }
}

/** Thème mis en cache localement (dispo instantanément, avant tout appel réseau). */
export function getCachedTheme() {
  try { return localStorage.getItem(THEME_CACHE_KEY); } catch (e) { return null; }
}

/**
 * Charge le thème réel de l'utilisateur depuis son profil Supabase,
 * et met à jour le cache local en conséquence. À appeler juste après
 * la connexion. Si hors-ligne, on garde silencieusement le cache local.
 */
export async function chargerThemeDepuisProfil(userId) {
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("theme")
      .eq("id", userId)
      .single();
    if (error) throw error;
    if (data && data.theme) {
      applyTheme(data.theme);
      return data.theme;
    }
  } catch (e) {
    console.warn("Thème non synchronisé (hors-ligne ?), on garde le cache local.", e);
  }
  return getCachedTheme();
}

/**
 * Change le thème : application immédiate (aucune latence perçue),
 * puis tentative de synchronisation vers Supabase en arrière-plan.
 * @returns {Promise<boolean>} true si la synchro cloud a réussi
 */
export async function changerTheme(userId, themeKey) {
  applyTheme(themeKey);
  try {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ theme: themeKey })
      .eq("id", userId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Le nouveau thème n'a pas pu être synchronisé (hors-ligne ?).", e);
    return false;
  }
}
