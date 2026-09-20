// ============================================================
// Connexion à Supabase.
// ============================================================

const SUPABASE_URL = "https://mqodxfqyswnfzpvsxvoj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xb2R4ZnF5c3duZnpwdnN4dm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjk3NjAsImV4cCI6MjEwNDkwNTc2MH0.2Yxrs1lYWm-uWk4feb8p0J_mkshtsTCiSJyO1Zg_dfM";

if (typeof window.supabase === "undefined") {
  throw new Error(
    "La librairie Supabase ne s'est pas chargée (vérifie la balise <script> dans index.html et ta connexion internet)."
  );
}

export const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

export const isConfigured = true; 
