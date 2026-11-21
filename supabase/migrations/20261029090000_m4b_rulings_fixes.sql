-- M4b rulings of 2026-10-29 (A1, A4):
--   A1. Items listed in a starting kit count as known to the party: kits are player-readable, so the items they
--       list can show at creation. Extends "for sale or known to the party" from
--       20261028100000_m4b_known_items.sql: an item is also readable when a starting kit in one of the campaign's
--       setting rules lists it (in its items, or in a row of one of its rolls). Worked out when read; no rows added.
--   A4. The GM's exceptions (which setting rules win for an entry, "kind:id" -> the entry's name) are the GM's
--       alone. Until now the ones for player-facing kinds sat in campaign_packs.overrides, which every member
--       reads, so an exception for an item the party doesn't know showed its name. All exceptions now live in
--       campaign_pack_secrets (only the GM reads it); campaign_packs.overrides stays, always empty. Players get,
--       through public.campaign_exceptions, only the exceptions for entries they can read (so their device picks
--       the same winning version as the GM's); the GM gets them all. Earlier log lines that named a
--       player-facing exception become the GM's (they stay in the log).
-- Moves data, drops none: each campaign's exceptions are copied into campaign_pack_secrets before the readable
-- column is emptied. Two check constraints are replaced; four functions and one trigger are added or replaced.

-- A4. Exceptions move where only the GM reads them (re-filed, not a change anyone made: not logged, and allowed
-- in a retired campaign).
alter table public.campaign_packs drop constraint campaign_packs_overrides_player_facing;
alter table public.campaign_pack_secrets drop constraint campaign_pack_secrets_overrides_gm_only;

alter table public.campaign_packs disable trigger user;
alter table public.campaign_pack_secrets disable trigger user;
update public.campaign_pack_secrets s
set overrides = s.overrides || cp.overrides
from public.campaign_packs cp
where cp.id = s.id and cp.overrides <> '{}'::jsonb;
update public.campaign_packs set overrides = '{}'::jsonb where overrides <> '{}'::jsonb;
alter table public.campaign_pack_secrets enable trigger user;
alter table public.campaign_packs enable trigger user;

-- From now on the readable column holds nothing. Undoing an exception made before this change writes it back
-- here; it's filed with the GM's instead (so such an undo still works).
create function private.file_exceptions_with_gm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.overrides is distinct from '{}'::jsonb then
    update public.campaign_pack_secrets s set overrides = s.overrides || new.overrides where s.id = new.id;
    new.overrides := '{}'::jsonb;
  end if;
  return new;
end;
$$;
revoke execute on function private.file_exceptions_with_gm() from public, anon, authenticated;
create trigger file_exceptions_with_gm before update of overrides on public.campaign_packs
  for each row execute function private.file_exceptions_with_gm();
alter table public.campaign_packs add constraint campaign_packs_overrides_empty check (overrides = '{}'::jsonb);

-- Earlier log lines that named a player-facing exception become the GM's (they stay in the log).
update public.events e
  set audience = 'gm'
  where e.target_table = 'campaign_packs' and e.audience <> 'gm'
    and (coalesce(e.before, '{}'::jsonb) ? 'overrides' or coalesce(e.after, '{}'::jsonb) ? 'overrides')
    and (coalesce(e.before -> 'overrides', '{}'::jsonb) <> '{}'::jsonb or coalesce(e.after -> 'overrides', '{}'::jsonb) <> '{}'::jsonb);

-- As in 20261028100000_m4b_known_items.sql, with the GM's exceptions read from where they now live.
create or replace function private.item_for_sale_in(campaign uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.for_sale(e.data)
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    left join public.campaign_pack_secrets s on s.id = cp.id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'item' and e.pack_entry_id = item
    where cp.campaign_id = campaign
    order by coalesce(s.overrides ? ('item:' || item), false) desc, (p.kind = 'homebrew') desc, cp.priority desc, cp.pack_id::text
    limit 1
  ), false);
$$;

-- A1. Whether a starting kit in the campaign's setting rules lists the item (07 startingKits: items, or a row of
-- one of its rolls).
create function private.item_in_kit(campaign uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.campaign_packs cp
    join public.library_entries k on k.pack_id = cp.pack_id and k.kind = 'startingKit'
    where cp.campaign_id = campaign
      and (
        jsonb_path_exists(k.data, '$.items[*] ? (@.itemId == $id)', jsonb_build_object('id', item))
        or jsonb_path_exists(k.data, '$.rolls[*].rows[*].items[*] ? (@.itemId == $id)', jsonb_build_object('id', item))
      )
  );
$$;
revoke execute on function private.item_in_kit(uuid, text) from public, anon;
grant execute on function private.item_in_kit(uuid, text) to authenticated, service_role;

-- As in 20261028100000_m4b_known_items.sql, plus: an item a starting kit lists (A1).
create or replace function private.item_readable(pack uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_packs cp
    where cp.pack_id = pack and private.is_member(cp.campaign_id)
      and (
        exists (select 1 from public.known_items k where k.campaign_id = cp.campaign_id and k.item_id = item)
        or private.item_for_sale_in(cp.campaign_id, item)
        or private.item_in_kit(cp.campaign_id, item)
      )
  );
$$;

-- A4. The GM's exceptions in a campaign, by attached setting rules (the link's id): the GM gets them all; a
-- player only those for entries they can read (a player-facing kind and, for an item, one they may read), so
-- their device picks the same winning version without learning about the rest. Nothing for a non-member.
create function public.campaign_exceptions(campaign uuid) returns table (id uuid, overrides jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id,
    case
      when private.is_gm(campaign) then s.overrides
      else coalesce((
        select jsonb_object_agg(o.key, o.value)
        from jsonb_each(s.overrides) o
        cross join lateral (select split_part(o.key, ':', 1) as kind) k
        where private.player_facing(k.kind)
          and (k.kind <> 'item' or private.item_readable(cp.pack_id, substring(o.key from char_length(k.kind) + 2)))
      ), '{}'::jsonb)
    end
  from public.campaign_pack_secrets s
  join public.campaign_packs cp on cp.id = s.id
  where s.campaign_id = campaign and private.is_member(campaign);
$$;
revoke execute on function public.campaign_exceptions(uuid) from public, anon;
grant execute on function public.campaign_exceptions(uuid) to authenticated, service_role;
