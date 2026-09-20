import { supabaseClient } from "./supabaseClient.js";

/**
 * Inscription d'un nouvel utilisateur.
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

export async function resetPasswordEmail(email) {
  const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
  return data;
}

export function onAuthStateChange(callback) {
  const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export function messageErreurAuth(error) {
  const msg = (error && error.message) || "";
  if (msg.includes("Invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (msg.includes("User already registered")) return "Un compte existe déjà avec cet email.";
  if (msg.includes("Password should be at least")) return "Le mot de passe doit faire au moins 6 caractères.";
  if (msg.includes("Password should contain") || msg.includes("password policy")) {
    return "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.";
  }
  if (msg.includes("Unable to validate email address")) return "Adresse email invalide.";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Impossible de contacter le serveur, vérifie ta connexion internet.";
  return msg || "Une erreur inattendue est survenue.";
}
