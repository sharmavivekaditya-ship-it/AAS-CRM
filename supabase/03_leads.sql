-- =====================================================================
-- AAS BD Desk : Leads section (lead batches uploaded from Excel)
-- Paste into Supabase > SQL Editor > New query > Run. Run once.
-- =====================================================================

create table if not exists public.lead_batches (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  provided_on  date not null default current_date,
  source_file  text,
  notes        text,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.lead_batches (id) on delete cascade,
  company_id      uuid references public.companies (id) on delete set null,
  rank            int,
  priority        text,
  name            text not null,
  website         text,
  ownership       text,
  industry        text,
  location        text,
  project         text,
  project_cr      numeric,
  project_stage   text,
  rating          text,
  bank_limits_cr  numeric,
  untied_cr       numeric,
  turnover_cr     numeric,
  md              text,
  cfo             text,
  contacts        jsonb not null default '[]'::jsonb,
  trigger_note    text,
  aas_solution    text,
  notes           text,
  phone_gap       text,
  facilities      jsonb not null default '[]'::jsonb,
  dropped         boolean not null default false,
  drop_reason     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists leads_batch_idx on public.leads (batch_id);
create index if not exists leads_company_idx on public.leads (company_id);

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.lead_batches enable row level security;
alter table public.leads        enable row level security;

-- Batches: everyone reads, only admin uploads, edits or deletes.
drop policy if exists batches_read on public.lead_batches;
create policy batches_read on public.lead_batches for select to authenticated using (public.is_member());
drop policy if exists batches_admin_insert on public.lead_batches;
create policy batches_admin_insert on public.lead_batches for insert to authenticated with check (public.is_admin());
drop policy if exists batches_admin_update on public.lead_batches;
create policy batches_admin_update on public.lead_batches for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists batches_admin_delete on public.lead_batches;
create policy batches_admin_delete on public.lead_batches for delete to authenticated using (public.is_admin());

-- Leads: everyone reads, updates and deletes single leads;
-- only admin adds (uploads) leads.
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select to authenticated using (public.is_member());
drop policy if exists leads_admin_insert on public.leads;
create policy leads_admin_insert on public.leads for insert to authenticated with check (public.is_admin());
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists leads_admin_delete on public.leads;
create policy leads_admin_delete on public.leads for delete to authenticated using (public.is_member());

do $$
begin
  begin alter publication supabase_realtime add table public.lead_batches; exception when others then null; end;
  begin alter publication supabase_realtime add table public.leads;        exception when others then null; end;
end $$;
