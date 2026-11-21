-- Patrons as a library entry kind players read (December step 1a; docs/plans/dec-1-creation.md 1a,
-- docs/plans/m5b-patrons.md part A; design/rulings/m5b-patrons-session-2026-11-07.md pt-1 … pt-8, "Not walked":
-- "a lord's stat block, plane and cult stay GM-only; the patron's follower page is player-readable").
--   patron   one entry of a pack's `patrons[]`: a god a cleric (or another class it names) follows: name, title,
--            blurb, description, depiction, realm, alignment, followers, holySymbol, holyGarb, prayer, strictures,
--            spells, marks, approval, approvalNote, source; and for the GM only, `cult` and `statBlockId`.
--            Players pick one at creation and read its entry, so it is a player-facing kind: private.player_facing
--            carries that to the read rule on library_entries (through private.player_facing_entry), the log's
--            audience and import_pack's "what changed" line for players.
--   Hard rule 5: a patron's `cult` and `statBlockId` never reach a player. private.hidden_keys names them for the
--            kind, so private.split_hidden_fields files them in library_entry_secrets (the GM's) on every write and
--            private.visible_of leaves them out, whether or not the pack lists them in `gmOnly`.
-- Replaces one check constraint and private.player_facing (both newest in 20261104150000_m5b_patches_kind.sql) and
-- private.hidden_keys (newest in 20261102130000_m5b_g5_gm_reference_hidden.sql). private.player_facing_entry, the
-- read policy and public.import_pack (newest in 20261104230000_fix_review_2026_11_04.sql) ask private.player_facing,
-- so they follow without being replaced.
--   Garb: a player reads an item only when it is known, for sale or in a starting kit (private.item_readable). A
--            patron's holy garb may be none of those (not for sale, or magic), and the Gear step puts it in the
--            player's pack from the player's own device, so it must be readable there: private.item_readable also
--            says yes for an item a patron's `holyGarb[].itemIds` names, in a pack the reader's campaign uses (the
--            review of #636). Replaces private.item_readable (newest in 20261029090000_m4b_rulings_fixes.sql); adds
--            private.item_in_patron_garb.
-- Data: changes no existing row (no entry of kind `patron` can exist before this constraint allows it). Drops,
-- renames and deletes no data.

alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList',
  'gmReferencePanel', 'location', 'patch', 'patron'
));

create or replace function private.player_facing(kind text) returns boolean
language sql immutable set search_path = '' as $$
  select kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook', 'traitList', 'fieldTemplate', 'patch', 'patron');
$$;

-- As in 20261102130000_m5b_g5_gm_reference_hidden.sql, plus a patron's cult and stat block.
create or replace function private.hidden_keys(kind text, data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array(
    select distinct k from (
      select jsonb_array_elements_text(case when jsonb_typeof(data -> 'gmOnly') = 'array' then data -> 'gmOnly' else '[]'::jsonb end) as k
      union all
      select e.key from jsonb_each(case when kind = 'rulesSet' then data else '{}'::jsonb end) e
      where e.key in ('monsters', 'magicItems', 'procedures', 'gmReference')
        or (jsonb_typeof(e.value) = 'object' and (e.value -> 'gmOnly') = 'true'::jsonb)
      union all
      select e.key from jsonb_each(case when kind = 'patron' and jsonb_typeof(data) = 'object' then data else '{}'::jsonb end) e
      where e.key in ('cult', 'statBlockId')
      union all
      select 'byOption' where kind = 'rulesSet' and jsonb_typeof(data -> 'byOption') = 'object'
        and private.overrides_for_players(data) is distinct from data -> 'byOption'
      union all
      select 'specialSeasons' where kind = 'rulesSet' and jsonb_typeof(data -> 'specialSeasons') = 'array'
        and private.special_seasons_for_players(data -> 'specialSeasons') is distinct from data -> 'specialSeasons'
      union all
      select 'weather' where kind = 'rulesSet' and jsonb_typeof(data -> 'weather') = 'object'
        and private.weather_for_players(data -> 'weather') is distinct from data -> 'weather'
      union all
      select 'exploration' where kind = 'rulesSet' and jsonb_typeof(data -> 'exploration') = 'object'
        and private.exploration_for_players(data -> 'exploration') is distinct from data -> 'exploration'
    ) keys
  );
$$;

-- Whether a patron in the campaign's setting rules names the item as holy garb (`holyGarb[].itemIds`, any tier): the
-- garb is given free at creation, by the player's own device. A patron's garb is in its readable part.
create function private.item_in_patron_garb(campaign uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.campaign_packs cp
    join public.library_entries p on p.pack_id = cp.pack_id and p.kind = 'patron'
    where cp.campaign_id = campaign
      and jsonb_path_exists(p.data, '$.holyGarb[*].itemIds[*] ? (@ == $id)', jsonb_build_object('id', item))
  );
$$;
revoke execute on function private.item_in_patron_garb(uuid, text) from public, anon;
grant execute on function private.item_in_patron_garb(uuid, text) to authenticated, service_role;

-- As in 20261029090000_m4b_rulings_fixes.sql, plus: an item a patron's holy garb names.
create or replace function private.item_readable(pack uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_packs cp
    where cp.pack_id = pack and private.is_member(cp.campaign_id)
      and (
        exists (select 1 from public.known_items k where k.campaign_id = cp.campaign_id and k.item_id = item)
        or private.item_for_sale_in(cp.campaign_id, item)
        or private.item_in_kit(cp.campaign_id, item)
        or private.item_in_patron_garb(cp.campaign_id, item)
      )
  );
$$;
