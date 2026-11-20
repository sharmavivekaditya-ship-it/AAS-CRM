-- =====================================================================
-- AAS BD Desk : Banks & network (banks, NBFCs, consultants, CA firms, DSAs)
-- Paste into Supabase > SQL Editor > New query > Run. Run once, after 04.
-- =====================================================================

alter table public.companies
  add column if not exists category text not null default 'client';

do $$
begin
  alter table public.companies add constraint companies_category_check
    check (category in ('client', 'bank', 'consultant', 'ca', 'dsa', 'other'));
exception when duplicate_object then null;
end $$;

-- Add the type to the two central lists (new column goes at the end).
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
  l.created_at,
  'client'::text                   as category
from public.leads l
left join public.lead_batches b on b.id = l.batch_id
union all
select
  'crm company', c.id, c.name, c.city, c.sector, null, null, null, null, c.id,
  c.stage in ('no_req', 'not_interested', 'lost'), null, c.deleted_at,
  jsonb_array_length(c.contacts), c.notes, c.created_at, c.category
from public.companies c;

create or replace view public.contact_directory with (security_invoker = true) as
select
  d.record_type, d.company, d.city, d.industry, d.lead_list, d.list_given_on,
  p ->> 'name'        as person,
  p ->> 'designation' as designation,
  p ->> 'phone'       as phone,
  p ->> 'email'       as email,
  d.currently_not_relevant, d.irrelevant_since, d.deleted_at, d.created_at,
  d.category
from public.company_directory d
join lateral (
  select contacts from public.leads where id = d.record_id and d.record_type = 'uploaded lead'
  union all
  select contacts from public.companies where id = d.record_id and d.record_type = 'crm company'
) src on true
cross join lateral jsonb_array_elements(src.contacts) p
where coalesce(p ->> 'name', '') <> '' or coalesce(p ->> 'phone', '') <> '';

grant select on public.company_directory, public.contact_directory to authenticated;
