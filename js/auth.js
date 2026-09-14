import { supabaseClient } from "./supabaseClient.js";

/**
 * Inscription d'un nouvel utilisateur.
 * Le trigger SQL (handle_new_user) crée automatiquement sa ligne
 * de profil dès que le compte est créé côté Supabase.
 */
export async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * S'abonne aux changements d'état de connexion (connexion, déconnexion,
 * session restaurée au chargement, jeton rafraîchi...).
 * @param {(session: object|null) => void} callback
 * @returns {() => void} fonction pour se désabonner
 */
export function onAuthStateChange(callback) {
  const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Traduit les messages d'erreur Supabase les plus courants en français
 * compréhensible, plutôt que d'afficher le message technique brut.
 */
export function messageErreurAuth(error) {
  const msg = (error && error.message) || "";
  if (msg.includes("Invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (msg.includes("User already registered")) return "Un compte existe déjà avec cet email.";
  if (msg.includes("Password should be at least")) return "Le mot de passe doit faire au moins 6 caractères.";
  if (msg.includes("Unable to validate email address")) return "Adresse email invalide.";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Impossible de contacter le serveur, vérifie ta connexion internet.";
  return msg || "Une erreur inattendue est survenue.";
}
