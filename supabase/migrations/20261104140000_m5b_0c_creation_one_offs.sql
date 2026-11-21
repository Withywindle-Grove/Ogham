-- M5b creation survey, one-offs from creation (bq3-6, ruled 2026-11-04; docs/plans/m5b-0c-one-offs.md; docs/04, 05).
--   A new character's trinket (a table row) and a kit's or background's { name } lines are one-off items, so the
--   guard on players' item lines made them wait for the GM beside the character's own approval. Now a player's
--   one-off on a character of their own that isn't approved yet (draft, waiting or sent back) comes in approved: the
--   GM sees the pack when approving the character. An approved character's one-off waits as before (unless the
--   campaign's "One-off items need approval" is off); "given" stays the GM's; a split keeps its stack's approval.
--   A one-off moved off such a character by its owner waits again where it lands, so the creation path can't put an
--   approved one-off on an approved character.
-- Replaces one function (private.guard_lines_from_players; the newest copy is in 20261030100000_m5_small_fixes.sql).
-- Drops nothing; no rows are removed.


create or replace function private.guard_lines_from_players() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  splitting text := nullif(current_setting('grimoire.splitting', true), '');
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.how_got = 'given' then
      raise exception 'Only the GM gives items.' using errcode = '42501';
    end if;
    if new.library_entry_id is null and new.source_pack_id is not null and splitting is null then
      raise exception 'That item isn''t in this campaign''s setting rules.' using errcode = '42501';
    end if;
    -- Part of a stack split off (public.split_inventory_line): it is what the stack was, approved or waiting.
    if splitting is not null then
      new.approval := coalesce((select l.approval from public.inventory_lines l where l.id::text = splitting), 'pending');
      return new;
    end if;
    -- A one-off (from no setting rules) waits for the GM, unless the campaign says one-offs don't need approval,
    -- or it goes on a character of the player's own that isn't approved yet (the character's approval covers it).
    if new.library_entry_id is null and new.source_pack_id is null then
      new.approval := case
        when private.is_own_unapproved_character(new.actor_id) then 'approved'
        when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
        else 'pending'
      end;
    end if;
    return new;
  end if;
  if new.approval is distinct from old.approval or new.how_got is distinct from old.how_got then
    raise exception 'Only the GM approves items.' using errcode = '42501';
  end if;
  if new.name is distinct from old.name or new.category is distinct from old.category
    or new.weight_coin is distinct from old.weight_coin or new.slots is distinct from old.slots
    or new.stack is distinct from old.stack or new.per_units is distinct from old.per_units
    or new.library_entry_id is distinct from old.library_entry_id
    or new.source_pack_id is distinct from old.source_pack_id or new.source_entry_id is distinct from old.source_entry_id then
    raise exception 'Only the GM changes what an item is.' using errcode = '42501';
  end if;
  -- Magic armour's base is picked once; after that only the GM changes it.
  if new.base_armour_id is distinct from old.base_armour_id and old.base_armour_id is not null then
    raise exception 'Only the GM changes the base armour once it''s chosen.' using errcode = '42501';
  end if;
  -- A one-off leaving a character of the player's own that isn't approved yet waits again where it lands.
  if new.actor_id is distinct from old.actor_id and old.actor_id is not null
    and new.library_entry_id is null and new.source_pack_id is null
    and private.is_own_unapproved_character(old.actor_id) then
    new.approval := case
      when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
      else 'pending'
    end;
  end if;
  return new;
end;
$$;

-- Is this a player character of the signed-in person's own that isn't approved yet (draft, waiting or sent back)?
create function private.is_own_unapproved_character(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.actors a
    where a.id = actor and a.kind = 'pc' and a.owner_type = 'user'
      and a.owner_user_id = (select auth.uid()) and a.approval <> 'approved'
  );
$$;
revoke execute on function private.is_own_unapproved_character(uuid) from public, anon, authenticated;
