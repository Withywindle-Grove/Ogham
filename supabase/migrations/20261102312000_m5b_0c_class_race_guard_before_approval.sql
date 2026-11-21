-- M5b step 0c, follow-up C, fix forward on 20261102311000. That guard kept a player's `classes` and `race_ref` to a
-- draft; docs/04 (PC extras) says "before approval the owner changes class, race and scores", and a waiting or sent-back
-- character is before approval too (supabase/tests/party.test.ts, approved behaviour: the player sets them while
-- waiting). Newest definition: 20261102311000_m5b_0c_class_race_guard.sql. Only the condition changes: a player changes
-- them until the character is approved; the GM always; an undo may always put them back. No data touched.

create or replace function private.guard_class_race() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.classes is not distinct from old.classes and new.race_ref is not distinct from old.race_ref then
    return new;
  end if;
  if (select auth.uid()) is null
    or nullif(current_setting('grimoire.reverting', true), '') is not null
    or private.is_gm(old.campaign_id)
    or old.approval <> 'approved' then
    return new;
  end if;
  raise exception 'Only the GM can change an approved character''s class or race.' using errcode = '42501';
end;
$$;
