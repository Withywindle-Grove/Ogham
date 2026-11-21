-- M4b, character creation step 3: what guided creation records on a character (docs/04 PC extras; ruled
-- 2026-10-25): actors.creation, a small object kept for the GM's review and for M7's purse.
--   method: the creation method's id; rolled: the scores as rolled at the table ({"STR": 14}), before the race's
--   changes and the player's adjustments (the review shows "16 (rolled 14)"). Later steps add startingMoney and
--   spent. Like the level, race and class: the player sets it while the character waits or is sent back; once
--   approved, only the GM. Drops nothing.

alter table public.actors
  add column creation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(creation) = 'object' and pg_column_size(creation) <= 4000);

create function private.guard_creation_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(old.campaign_id) then
    return new;
  end if;
  if old.approval = 'approved' and new.creation is distinct from old.creation then
    raise exception 'Only the GM can change how an approved character was made.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_creation_record before update on public.actors
  for each row execute function private.guard_creation_record();
