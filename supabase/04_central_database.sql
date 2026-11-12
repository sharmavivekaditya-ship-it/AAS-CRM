-- =====================================================================
-- AAS BD Desk : central database (nothing is ever erased)
-- Paste into Supabase > SQL Editor > New query > Run. Run once,
-- after 01, 02 and 03. Safe to run again.
--
-- What this does
--  1. "Delete" in BD Desk no longer erases anything. Rows get a
--     deleted_at / deleted_by stamp and simply stop showing in the app.
--  2. Real deletes are blocked for every login (admin included).
--  3. A lead marked "Not relevant" keeps a permanent stamp
--     (irrelevant_since), even if it is restored later.
--  4. Two read-only views give one central list of every company and
--     every person + number ever uploaded or added:
--       company_directory  - one row per company record
--       contact_directory  - one row per person (name, phone, email)
-- =====================================================================

-- ---------- 1. Soft-delete columns ----------
alter table public.companies    add column if not exists deleted_at timestamptz;
alter table public.companies    add column if not exists deleted_by uuid references public.profiles (id) on delete set null;
alter table public.activities   add column if not exists deleted_at timestamptz;
alter table public.activities   add column if not exists deleted_by uuid references public.profiles (id) on delete set null;
alter table public.leads        add column if not exists deleted_at timestamptz;
alter table public.leads        add column if not exists deleted_by uuid references public.profiles (id) on delete set null;
alter table public.leads        add column if not exists irrelevant_since timestamptz;
alter table public.lead_batches add column if not exists deleted_at timestamptz;
alter table public.lead_batches add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

-- Leads already marked not relevant get their stamp now.
update public.leads set irrelevant_since = coalesce(updated_at, now())
 where dropped and irrelevant_since is null;

-- ---------- 2. Stamps kept by the database itself ----------
create or replace function public.stamp_soft_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := coalesce(new.deleted_by, auth.uid());
  end if;
  -- once deleted, a row stays deleted from the app's side
  if old.deleted_at is not null and new.deleted_at is null and auth.uid() is not null then
    new.deleted_at := old.deleted_at; new.deleted_by := old.deleted_by;
  end if;
  return new;
end $$;

drop trigger if exists companies_soft_delete on public.companies;
create trigger companies_soft_delete before update on public.companies for each row execute function public.stamp_soft_delete();
drop trigger if exists activities_soft_delete on public.activities;
create trigger activities_soft_delete before update on public.activities for each row execute function public.stamp_soft_delete();
drop trigger if exists leads_soft_delete on public.leads;
create trigger leads_soft_delete before update on public.leads for each row execute function public.stamp_soft_delete();
drop trigger if exists batches_soft_delete on public.lead_batches;
create trigger batches_soft_delete before update on public.lead_batches for each row execute function public.stamp_soft_delete();

-- "Not relevant" leaves a permanent mark.
create or replace function public.stamp_irrelevant() returns trigger
language plpgsql as $$
begin
  if new.dropped and not coalesce(old.dropped, false) then
    new.irrelevant_since := coalesce(old.irrelevant_since, now());
  else
    new.irrelevant_since := coalesce(old.irrelevant_since, new.irrelevant_since);
  end if;
  return new;
end $$;
drop trigger if exists leads_irrelevant on public.leads;
create trigger leads_irrelevant before update on public.leads for each row execute function public.stamp_irrelevant();

-- Deleting a batch hides its leads; deleting a company hides its calls.
create or replace function public.cascade_soft_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if tg_table_name = 'lead_batches' then
      update public.leads set deleted_at = new.deleted_at, deleted_by = new.deleted_by
       where batch_id = new.id and deleted_at is null;
    elsif tg_table_name = 'companies' then
      update public.activities set deleted_at = new.deleted_at, deleted_by = new.deleted_by
       where company_id = new.id and deleted_at is null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists batches_cascade on public.lead_batches;
create trigger batches_cascade after update on public.lead_batches for each row execute function public.cascade_soft_delete();
drop trigger if exists companies_cascade on public.companies;
create trigger companies_cascade after update on public.companies for each row execute function public.cascade_soft_delete();

-- ---------- 3. No real deletes from the app ----------
drop policy if exists companies_delete on public.companies;
drop policy if exists activities_delete on public.activities;
drop policy if exists leads_admin_delete on public.leads;
drop policy if exists batches_admin_delete on public.lead_batches;
-- (with RLS on and no delete policy, every delete from a login is refused)

-- ---------- 4. Central views ----------
create or replace view public.company_directory with (security_invoker = true) as
select
  'uploaded lead'::text            as record_type,
  l.id                             as record_id,
  l.name                           as company,
  l.location                       as city,
  l.industry,
  l.rating,
  l.bank_limits_cr,
  b.name                           as lead_list,
  b.provided_on                    as list_given_on,
  l.company_id                     as crm_company_id,
  l.dropped                        as currently_not_relevant,
  l.irrelevant_since,
  l.deleted_at,
  jsonb_array_length(l.contacts)   as persons,
  l.notes,
  l.created_at
from public.leads l
left join public.lead_batches b on b.id = l.batch_id
union all
select
  'crm company', c.id, c.name, c.city, c.sector, null, null, null, null, c.id,
  c.stage in ('no_req', 'not_interested', 'lost'), null, c.deleted_at,
  jsonb_array_length(c.contacts), c.notes, c.created_at
from public.companies c;

create or replace view public.contact_directory with (security_invoker = true) as
select
  d.record_type, d.company, d.city, d.industry, d.lead_list, d.list_given_on,
  p ->> 'name'        as person,
  p ->> 'designation' as designation,
  p ->> 'phone'       as phone,
  p ->> 'email'       as email,
  d.currently_not_relevant, d.irrelevant_since, d.deleted_at, d.created_at
from public.company_directory d
join lateral (
  select contacts from public.leads where id = d.record_id and d.record_type = 'uploaded lead'
  union all
  select contacts from public.companies where id = d.record_id and d.record_type = 'crm company'
) src on true
cross join lateral jsonb_array_elements(src.contacts) p
where coalesce(p ->> 'name', '') <> '' or coalesce(p ->> 'phone', '') <> '';

grant select on public.company_directory, public.contact_directory to authenticated;
