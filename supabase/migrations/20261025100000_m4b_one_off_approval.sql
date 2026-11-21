-- M4b step 1d: player one-off items wait for the GM under a campaign setting (ruled 2026-10-24; docs/04, 05 "One-off
-- items"). Replaces one function. Drops nothing.
--   campaigns.settings.oneOffApproval: true by default; false lets a player's one-off count at once.
--   The GM may edit a waiting one-off (name, weight, slots) as part of approving it: the guard only stops players.

-- As in 20261024230000_m4_review_fixes.sql, plus the campaign setting: a player's one-off waits only when
-- "One-off items need approval" is on (the default).
create or replace function private.guard_lines_from_players() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.how_got = 'given' then
      raise exception 'Only the GM gives items.' using errcode = '42501';
    end if;
    if new.library_entry_id is null and new.source_pack_id is not null
      and nullif(current_setting('grimoire.splitting', true), '') is null then
      raise exception 'That item isn''t in this campaign''s setting rules.' using errcode = '42501';
    end if;
    -- A one-off (from no setting rules) waits for the GM, unless the campaign says one-offs don't need approval.
    if new.library_entry_id is null and new.source_pack_id is null then
      new.approval := case
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
  return new;
end;
$$;
