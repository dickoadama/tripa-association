-- ============================================================
-- TRIPA — Schéma Supabase multi-rôles (Super Admin / Admin / User)
-- À exécuter EN ENTIER dans l'éditeur SQL du dashboard Supabase
-- (projet ldfjbjwtqcikcfsjotgt). ATTENTION : DROP complet des
-- données existantes (remise à zero demandée).
-- ============================================================

create extension if not exists pgcrypto;

-- 0) Nettoyage (script ré-exécutable) --------------------------------
drop table if exists public.adherents, public.cotisations, public.evenements, public.activites,
  public.communications, public.achats, public.documents, public.taches,
  public.activity, public.profiles, public.invitations cascade;
drop function if exists public.is_super_admin() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_user() cascade;
drop function if exists public.my_admin_id() cascade;
drop function if exists public.has_super_admin() cascade;
drop function if exists public.trg_profile_bootstrap() cascade;
drop function if exists public.trg_profile_guard() cascade;
drop function if exists public.trg_set_owner() cascade;
drop function if exists public.trg_touch() cascade;

-- 1) Comptes et invitations -------------------------------------------
create table public.profiles (
  row_id    uuid primary key default gen_random_uuid(),
  id        uuid unique references auth.users (id),
  email     text not null,
  prenom    text default '',
  nom       text default '',
  telephone text default '',
  asso_type text default '',
  role      text not null default 'admin'   check (role  in ('super_admin','admin','user')),
  status    text not null default 'pending' check (status in ('active','pending','suspended','revoked')),
  admin_id  uuid,
  invited   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  token      uuid primary key default gen_random_uuid(),
  email      text not null,
  prenom     text default '',
  nom        text default '',
  telephone  text default '',
  asso_type  text default '',
  role       text not null check (role in ('admin','user')),
  created_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- 2) Tables d'entités (forme générique : champs dans cols jsonb) ------
create table public.adherents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.cotisations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.evenements (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.activites (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.communications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.achats (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.documents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.taches (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  cols jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.activity (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_by uuid,
  action text, entity text, label text, user_email text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- 3) Fonctions de rôle (security definer : évite la récursion RLS) ----
create or replace function public.is_super_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin' and status = 'active');
$$;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_user() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'user' and status = 'active');
$$;

create or replace function public.my_admin_id() returns uuid
language sql security definer stable set search_path = public as $$
  select admin_id from profiles where id = auth.uid() and role = 'user';
$$;

-- Le frontend (rôle anon) doit savoir si le Super Admin existe déjà.
create or replace function public.has_super_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where role = 'super_admin');
$$;

-- 4) Triggers ----------------------------------------------------------
-- Bootstrap : 1er inscrit = Super Admin ; sinon réclame l'invitation.
create or replace function public.trg_profile_bootstrap() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  if new.id is null then new.id := auth.uid(); end if;
  if new.email is null or new.email = '' then
    new.email := coalesce(auth.jwt() ->> 'email', '');
  end if;

  if not exists (select 1 from profiles where role = 'super_admin') then
    new.role := 'super_admin';
    new.status := 'active';
    new.invited := false;
    new.admin_id := null;
    return new;
  end if;

  select * into inv from invitations
   where lower(email) = lower(new.email) and accepted_at is null
   order by created_at desc limit 1;

  if inv.token is null then
    raise exception 'TRIPA_NO_INVITATION : cette adresse email na pas ete invitee.';
  end if;

  new.role      := inv.role;
  new.status    := 'active';
  new.invited   := true;
  new.admin_id  := case when inv.role = 'user' then inv.created_by else null end;
  new.prenom    := coalesce(nullif(new.prenom, ''),    inv.prenom);
  new.nom       := coalesce(nullif(new.nom, ''),       inv.nom);
  new.telephone := coalesce(nullif(new.telephone, ''), inv.telephone);
  new.asso_type := coalesce(nullif(new.asso_type, ''), inv.asso_type);
  update invitations set accepted_at = now() where token = inv.token;
  return new;
end $$;

create trigger profile_bootstrap before insert on public.profiles
  for each row execute function public.trg_profile_bootstrap();

-- Personne ne modifie role/status/admin_id/email sauf le Super Admin.
create or replace function public.trg_profile_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_super_admin() then
    new.updated_at := now();
    return new;
  end if;
  new.role     := old.role;
  new.status   := old.status;
  new.admin_id := old.admin_id;
  new.email    := old.email;
  new.id       := old.id;
  new.invited  := old.invited;
  new.updated_at := now();
  return new;
end $$;

create trigger profile_guard before update on public.profiles
  for each row execute function public.trg_profile_guard();

-- Horodatage/propriétaire des données : auth.uid() côté serveur.
create or replace function public.trg_set_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_user() then
    new.owner_id := public.my_admin_id();
  else
    new.owner_id := coalesce(auth.uid(), new.owner_id);
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.updated_at := now();
  return new;
end $$;

create or replace function public.trg_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- 5) RLS : activation + politiques -------------------------------------
alter table public.profiles      enable row level security;
alter table public.invitations   enable row level security;
alter table public.activity      enable row level security;
alter table public.adherents     enable row level security;
alter table public.cotisations   enable row level security;
alter table public.evenements    enable row level security;
alter table public.activites     enable row level security;
alter table public.communications enable row level security;
alter table public.achats        enable row level security;
alter table public.documents     enable row level security;
alter table public.taches        enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profile self select"  on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "super select all"     on public.profiles for select to authenticated
  using (public.is_super_admin());
create policy "admin select users"   on public.profiles for select to authenticated
  using (role = 'user' and admin_id = auth.uid());
create policy "profile insert own"   on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profile self update"  on public.profiles for update to authenticated
  using (id = auth.uid());
create policy "super update all"     on public.profiles for update to authenticated
  using (public.is_super_admin()) with check (true);
create policy "super delete all"     on public.profiles for delete to authenticated
  using (public.is_super_admin());

-- invitations ------------------------------------------------------------
-- Lecture pré-inscription (formulaire ?invite=token) : uniquement les
-- invitations non encore acceptées, colonnes non sensibles via la requête.
create policy "claim read"           on public.invitations for select to anon, authenticated
  using (accepted_at is null);
create policy "super read all"       on public.invitations for select to authenticated
  using (public.is_super_admin());
create policy "issuer read"          on public.invitations for select to authenticated
  using (created_by = auth.uid());
create policy "super insert admin"   on public.invitations for insert to authenticated
  with check (public.is_super_admin() and role = 'admin' and created_by = auth.uid());
create policy "admin insert user"    on public.invitations for insert to authenticated
  with check (public.is_admin() and role = 'user' and created_by = auth.uid());
create policy "issuer or super delete" on public.invitations for delete to authenticated
  using (public.is_super_admin() or created_by = auth.uid());

-- Tables d'entités + journal : l'admin gère SES données (owner = lui),
-- l'utilisateur lit les données de son admin et ne peut que loguer/achever
-- des tâches. Le Super Admin ne touche aucune donnée métier.
do $$
declare t text;
begin
  foreach t in array array['adherents','cotisations','evenements','activites','communications','achats','documents','taches'] loop
    execute format('create policy "owner_all" on public.%I for all to authenticated
      using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    execute format('create policy "user_read" on public.%I for select to authenticated
      using (public.is_user() and owner_id = public.my_admin_id())', t);
    execute format('create trigger "trg_%s_insert" before insert on public.%I
      for each row execute function public.trg_set_owner()', t, t);
    execute format('create trigger "trg_%s_update" before update on public.%I
      for each row execute function public.trg_touch()', t, t);
  end loop;
end $$;

-- Politique UPDATE supplémentaire sur les tâches pour le rôle user.
create policy "user_update_taches" on public.taches for update to authenticated
  using (public.is_user() and owner_id = public.my_admin_id())
  with check (owner_id = public.my_admin_id());

-- Journal d'activité -------------------------------------------------------
create policy "owner_all" on public.activity for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "user_read" on public.activity for select to authenticated
  using (public.is_user() and owner_id = public.my_admin_id());
create policy "user_insert" on public.activity for insert to authenticated
  with check (public.is_user() and owner_id = public.my_admin_id());
create trigger trg_activity_insert before insert on public.activity
  for each row execute function public.trg_set_owner();
create trigger trg_activity_update before update on public.activity
  for each row execute function public.trg_touch();

-- 6) Privilèges -----------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.invitations to anon;
grant execute on function public.has_super_admin() to anon, authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_user() to authenticated;
grant execute on function public.my_admin_id() to authenticated;

-- Les fonctions de role n'ont rien a faire du cote anon (default privileges
-- Supabase les rend executables) : on retire explicitement.
revoke execute on function public.is_super_admin() from anon, public;
revoke execute on function public.is_admin()       from anon, public;
revoke execute on function public.is_user()        from anon, public;
revoke execute on function public.my_admin_id()    from anon, public;
