-- fix-one-off-undo-approval: an Undo never makes a one-off approved that the GM hasn't approved (Francis, 2026-11-21:
-- "Yes"). Replaces one function; adds, drops, renames and deletes nothing, and changes no read rule.
-- Built from the newest definition of private.guard_lines_from_players, 20261104230000_fix_review_2026_11_04.sql
-- (point 3); no later migration replaces it. Its opening let every Undo (grimoire.reverting) through unchecked, and no
-- older trigger guards inventory_lines.approval. A player's one-off on their own unapproved character X comes in
-- approved (X's approval covers it). Two Undos then put it on X approved after the GM had approved X without seeing it:
--   a move: moved to an approved character it waits again; the GM approves X; the player's Undo of the move
--     (private.unmove_line puts back the move's own before-values, approval 'approved' among them) landed it back on X
--     approved. The same for a one-off moved between two of the player's drafts, the first approved since.
--   a drop: dropped from X; the GM approves X; the player's Undo of the drop (private.undo_restore_drops inserts the
--     line as the drop's log kept it) brought it back on X approved.
-- Both Undos write through this guard, so this one function closes both. In a player's Undo, a one-off that would end
-- up approved is worked out as for a one-off added there now (approved on a character of the player's own that isn't
-- approved yet, or when the campaign's one-offs need no approval; else waiting for the GM) when:
--   moved, or its approval put back: unless it already stood approved on its own (approved, and not on a character of
--     the player's own that isn't approved yet: the GM's approval, or one-offs needing none when it was added);
--   brought back after a drop: when the GM has approved the character it comes back to since the drop.
-- Every other Undo through this guard is as before: the GM's (and the database's) Undo; a dropped line the GM approved,
-- or on a character approved before the drop; a split-off part merged back (its stack's count put back; no move, no
-- approval); a whole line a move merged into a stack, made again (never a one-off: one-offs don't join); a give, a move
-- into a container or the stash, of a line the GM approved; any other undone change to a line (no move, no approval).
-- Tests: supabase/tests/fix-one-off-undo-approval.test.ts.
-- The trigger guard_lines_from_players (20261024120000_m4_add_item_rulings.sql) calls this function and stays as made.
create or replace function private.guard_lines_from_players() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  splitting text := nullif(current_setting('grimoire.splitting', true), '');
  reverting text := nullif(current_setting('grimoire.reverting', true), '');
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id) then
    return new;
  end if;
  -- A player's Undo puts back what their action changed, but never makes a one-off approved that the GM hasn't
  -- approved: a one-off it moves comes back as if moved there now, unless it already stood approved on its own.
  if reverting is not null then
    if tg_op = 'UPDATE' and new.library_entry_id is null and new.source_pack_id is null
      and new.approval = 'approved'
      and (new.actor_id is distinct from old.actor_id or new.approval is distinct from old.approval)
      and not (old.approval = 'approved' and not private.is_own_unapproved_character(old.actor_id)) then
      new.approval := case
        when private.is_own_unapproved_character(new.actor_id) then 'approved'
        when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
        else 'pending'
      end;
    end if;
    -- A dropped one-off brought back to a character the GM has approved since the drop: the GM never saw it there.
    if tg_op = 'INSERT' and new.library_entry_id is null and new.source_pack_id is null
      and new.approval = 'approved'
      and not private.is_own_unapproved_character(new.actor_id)
      and exists (
        select 1 from public.events a
        where a.campaign_id = new.campaign_id and a.target_table = 'actors' and a.target_id = new.actor_id
          and a.after ->> 'approval' = 'approved'
          and a.seq > (select d.seq from public.events d where d.id = reverting::uuid)
      ) then
      new.approval := case
        when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
        else 'pending'
      end;
    end if;
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
  -- A one-off leaving a character of the player's own that isn't approved yet waits again where it lands, unless it
  -- lands on another such character of theirs.
  if new.actor_id is distinct from old.actor_id and old.actor_id is not null
    and new.library_entry_id is null and new.source_pack_id is null
    and private.is_own_unapproved_character(old.actor_id) then
    new.approval := case
      when private.is_own_unapproved_character(new.actor_id) then 'approved'
      when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
      else 'pending'
    end;
  end if;
  return new;
end;
$$;
