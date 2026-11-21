-- p2p-b11: the marching order without its lock (docs/plans/scene-point-to-point.md, B11; ruling p2p-21; flag 5,
-- Francis, 2026-11-18: "the database stops looking at the marching order's lock; old locks stay stored and do
-- nothing; no saved data is changed or deleted").
-- One function is replaced and nothing else: private.marching_rules, the rule behind every change to a marching
-- order. A player is no longer refused because a lock is stored, on the order's own row or on the party's (group 1).
-- Add-only: nothing is dropped, renamed or deleted. The `locked` column, private.marching_locked, the function
-- public.lock_marching_order and every stored lock stay as they are; a stored lock now does nothing.
-- Unchanged, word for word: "Players can reorder marching order" off still refuses players ("Only the GM sets the
-- marching order in this campaign."); only the GM writes the `locked` value; the group never changes; rows of 1 to 3
-- of the group's own characters; saved orders need a name; an Undo puts back what was there.
-- builds on: private.marching_rules from 20261030230000_m5_party_groups.sql (its newest definition; the older copy in
-- 20261030201000_m5_marching.sql is superseded). The only lines taken out are the three that read:
--     if old.locked or private.marching_locked(new.campaign_id) then
--       raise exception 'The GM has locked the marching order.' using errcode = '42501';
--     end if;
create or replace function private.marching_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  preset jsonb;
begin
  if new.campaign_id is distinct from old.campaign_id or new.group_number is distinct from old.group_number then
    raise exception 'That can''t be changed.';
  end if;
  if not private.is_gm(new.campaign_id) then
    if new.locked is distinct from old.locked then
      raise exception 'Only the GM locks the marching order.' using errcode = '42501';
    end if;
    if (select c.settings -> 'playersReorderMarching' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then
      raise exception 'Only the GM sets the marching order in this campaign.' using errcode = '42501';
    end if;
  end if;
  -- An undo puts back what was there (a character in it may have left since); anything else is checked.
  if not reverting then
    if new.rows is distinct from old.rows then
      if not private.marching_rows_ok(new.campaign_id, new.rows) then
        raise exception 'Each row holds 1 to 3 of the party, each once.';
      end if;
      if exists (
        select 1 from jsonb_array_elements(new.rows) r(row_ids), jsonb_array_elements_text(r.row_ids) x(id)
        where not exists (
          select 1 from public.party_group_members m
          where m.actor_id::text = x.id and m.campaign_id = new.campaign_id and m.group_number = new.group_number
        )
      ) then
        raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
      end if;
    end if;
    if new.presets is distinct from old.presets then
      for preset in select p from jsonb_array_elements(new.presets) p loop
        if jsonb_typeof(preset) <> 'object' or jsonb_typeof(preset -> 'name') <> 'string'
          or length(trim(preset ->> 'name')) not between 1 and 60 or not private.marching_rows_ok(null, preset -> 'rows') then
          raise exception 'A saved order needs a name (up to 60 characters) and rows of 1 to 3.';
        end if;
      end loop;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
-- As before (replacing a function keeps who may run it; said again so it can't drift).
revoke execute on function private.marching_rules() from public, anon, authenticated;
