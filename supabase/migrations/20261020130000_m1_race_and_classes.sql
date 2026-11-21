-- M1: race and class slots on each character (docs/04-data-model.md, PC extras), filled from packs in M3/M4b.
-- classes: a list of {classRef, level, xp}; one entry in R1 screens, several allowed for multi-class later.
-- race_ref: the race's id in a pack, or empty.
-- Like the level: the player sets them while the character is waiting or sent back; once approved only the GM.

alter table public.actors
  add column classes jsonb not null default '[]'::jsonb check (jsonb_typeof(classes) = 'array'),
  add column race_ref text;

create function private.guard_race_and_classes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(old.campaign_id) then
    return new;
  end if;
  if old.approval = 'approved'
    and (new.classes is distinct from old.classes or new.race_ref is distinct from old.race_ref) then
    raise exception 'Only the GM can change an approved character''s race or class.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_race_and_classes before update on public.actors
  for each row execute function private.guard_race_and_classes();
