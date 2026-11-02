-- =====================================================================
-- Aditya ArthSetu BD CRM : database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- ---------- Team members (one row per login) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  role        text not null default 'user' check (role in ('admin', 'user')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Companies (accounts / leads) ----------
create table if not exists public.companies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  sector               text,
  city                 text,
  website              text,
  source               text,
  requirement          text,
  amount_cr            numeric,
  banks                text,
  notes                text,
  stage                text not null default 'new',
  contacts             jsonb not null default '[]'::jsonb,
  next_follow_up       date,
  next_follow_up_time  text,
  follow_up_note       text,
  meeting_date         date,
  meeting_time         text,
  created_by           uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------- Calls / activities (one row per contact attempt) ----------
create table if not exists public.activities (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  call_date       date not null,
  person          text,
  designation     text,
  phone           text,
  outcome         text not null,
  remarks         text,
  profile_shared  text,
  follow_up       date,
  follow_up_time  text,
  by_id           uuid default auth.uid() references public.profiles (id) on delete set null,
  by_name         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists activities_company_idx on public.activities (company_id);
create index if not exists activities_date_idx on public.activities (call_date);

-- ---------- Settings (single row) ----------
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  daily_target  int not null default 10,
  workdays      int[] not null default '{1,2,3,4,5}',
  holidays      date[] not null default '{}',
  updated_at    timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------- Helper functions ----------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists companies_touch on public.companies;
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();
drop trigger if exists activities_touch on public.activities;
create trigger activities_touch before update on public.activities
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- New login => profile row. The very first account becomes Admin.
-- Later accounts take the role the admin chose (stored in app_metadata,
-- which only the server can set).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when not exists (select 1 from public.profiles) then 'admin'
      when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'
      else 'user'
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stop anyone except an admin from changing roles / active flags.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    raise exception 'Only an admin can change team members';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------- Row level security ----------
alter table public.profiles   enable row level security;
alter table public.companies  enable row level security;
alter table public.activities enable row level security;
alter table public.settings   enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (public.is_member() or id = auth.uid());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Companies: every active member reads, adds and edits. Only admin deletes.
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select to authenticated using (public.is_member());
drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies for insert to authenticated with check (public.is_member());
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (public.is_member()) with check (public.is_member());
drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies for delete to authenticated using (public.is_admin());

-- Calls: every active member reads and logs. A user edits only her own
-- calls; admin edits and deletes any.
drop policy if exists activities_read on public.activities;
create policy activities_read on public.activities for select to authenticated using (public.is_member());
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert to authenticated with check (public.is_member());
drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities for update to authenticated
  using (public.is_admin() or (public.is_member() and by_id = auth.uid()))
  with check (public.is_admin() or (public.is_member() and by_id = auth.uid()));
drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities for delete to authenticated using (public.is_admin());

-- Settings: members read, admin changes.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (public.is_member());
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Live updates between logged-in people ----------
do $$
begin
  begin alter publication supabase_realtime add table public.companies;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.activities; exception when others then null; end;
  begin alter publication supabase_realtime add table public.settings;   exception when others then null; end;
end $$;
