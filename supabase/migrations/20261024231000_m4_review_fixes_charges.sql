-- Fix forward for 20261024230000_m4_review_fixes.sql: an item with no charges of its own got "unknown" (null)
-- instead of "no" for hidden charges when the setting rules hide charges, which the line refuses. Replaces one
-- function. Drops nothing.
create or replace function private.charges_hidden_for(campaign uuid, category text, item jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  with charge_rules as (
    select e.data -> 'magicItems' -> 'charges' as charges, cp.priority
    from public.campaign_packs cp
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    where cp.campaign_id = campaign and jsonb_typeof(e.data -> 'magicItems' -> 'charges') = 'object'
  )
  select coalesce(
    (select (r.charges ->> 'hidden')::boolean from charge_rules r where jsonb_typeof(r.charges -> 'hidden') = 'boolean'
     order by r.priority desc limit 1),
    false)
  and (
    coalesce(jsonb_typeof(item -> 'charges') = 'object', false)
    or exists (select 1 from charge_rules r where jsonb_typeof(r.charges -> category) = 'string')
  );
$$;
