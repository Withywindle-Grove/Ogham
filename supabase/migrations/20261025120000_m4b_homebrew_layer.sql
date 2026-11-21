-- M4b step 1g: homebrew is one layer (ruled 2026-10-24; docs/05 "Stacking", 07 "Homebrew"). Drops one trigger
-- (no data): the campaign's own homebrew can now be removed from its campaign like any homebrew pack (saving
-- homebrew again attaches it again). Replaces one function so the database reads the stack as the app does:
-- every homebrew pack above every setting and adventure pack, then the GM's order.

drop trigger refuse_homebrew_detach on public.campaign_packs;
drop function private.refuse_homebrew_detach();

-- As in 20261024231000_m4_review_fixes_charges.sql, with the homebrew layer first.
create or replace function private.charges_hidden_for(campaign uuid, category text, item jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  with charge_rules as (
    select e.data -> 'magicItems' -> 'charges' as charges, (p.kind = 'homebrew') as homebrew, cp.priority
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    where cp.campaign_id = campaign and jsonb_typeof(e.data -> 'magicItems' -> 'charges') = 'object'
  )
  select coalesce(
    (select (r.charges ->> 'hidden')::boolean from charge_rules r where jsonb_typeof(r.charges -> 'hidden') = 'boolean'
     order by r.homebrew desc, r.priority desc limit 1),
    false)
  and (
    coalesce(jsonb_typeof(item -> 'charges') = 'object', false)
    or exists (select 1 from charge_rules r where jsonb_typeof(r.charges -> category) = 'string')
  );
$$;
