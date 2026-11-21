-- M5b step 0c, follow-up C, fix forward on 20261102310000 (ruled 2026-11-02, cf-7; docs/04 PC extras: before approval
-- the owner changes class, race and scores only through creation.redo, on a draft). The actor guard let a player change
-- `classes` and `race_ref` on any unapproved character of theirs; the database's permission run showed it allowed a
-- player to change them on a character already sent to the GM. This guard keeps those two columns to the GM once the
-- character is sent (pending, rejected or approved): a player changes them only while it's a draft. An undo (the log's,
-- `grimoire.reverting`) may always put them back. No data touched; no drops, renames or deletes.

create function private.guard_class_race() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.classes is not distinct from old.classes and new.race_ref is not distinct from old.race_ref then
    return new;
  end if;
  if (select auth.uid()) is null
    or nullif(current_setting('grimoire.reverting', true), '') is not null
    or private.is_gm(old.campaign_id)
    or old.approval = 'draft' then
    return new;
  end if;
  raise exception 'Only the GM can change a character''s class or race once it''s sent.' using errcode = '42501';
end;
$$;

create trigger guard_class_race before update of classes, race_ref on public.actors
  for each row execute function private.guard_class_race();
