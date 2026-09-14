-- ============================================================
-- SCHÉMA DE BASE — Fondation "comptes + synchro"
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

-- Table des profils utilisateurs (1 ligne par utilisateur, liée au
-- système d'authentification intégré de Supabase : auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  theme text not null default 'sombre',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Active la sécurité par ligne : sans ça, par défaut personne ne peut
-- rien lire/écrire (ce qui est le comportement sûr par défaut).
alter table public.profiles enable row level security;

-- Un utilisateur ne peut voir que sa propre ligne
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Un utilisateur ne peut modifier que sa propre ligne
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Un utilisateur ne peut créer que sa propre ligne (garde-fou,
-- normalement gérée automatiquement par le trigger ci-dessous)
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Fonction + trigger : à chaque inscription, crée automatiquement
-- la ligne de profil correspondante (thème par défaut = 'sombre')
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tient updated_at à jour automatiquement à chaque modification
create function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
