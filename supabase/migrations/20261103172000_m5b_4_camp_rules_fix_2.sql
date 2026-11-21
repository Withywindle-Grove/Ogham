-- M5b step 4, part 2, fix forward (2): private.camp_rules (from 20261103171000_m5b_4_camp_rules_fix.sql, its newest
-- definition) named `old.kind` in a condition plpgsql also resolves for a camps row, which has none ("record old has
-- no field kind"), so Next day's apply failed; the cooking check now reads the row as json. And a waiting card's
-- `watch` (Which watch?) is now logged like its state, so its Undo works. Replaces one function, adds one trigger;
-- changes no rows.

create or replace function private.camp_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  writing boolean := current_setting('grimoire.camp_write', true) = 'on';
  free text[] := array['undone', 'version', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    if not writing then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    new.undone := false;
    new.created_by := (select auth.uid());
    if tg_table_name = 'camps' then
      new.applied_at := null;
    end if;
    return new;
  end if;
  if tg_table_name = 'camps' and (writing or reverting) then
    free := array_append(free, 'applied_at');
  end if;
  if not (reverting or (writing and tg_table_name = 'camps'))
    or (to_jsonb(new) - free) is distinct from (to_jsonb(old) - free)
    or (writing and not reverting and new.undone is distinct from old.undone) then
    raise exception 'That can''t be changed.';
  end if;
  if tg_table_name = 'camps' and new.undone and not old.undone
    and exists (select 1 from public.camp_entries e where e.camp_id = new.id and not e.undone) then
    raise exception 'Undo the camp''s steps first.';
  end if;
  -- Nested: a camps row has no `kind` (plpgsql resolves every field in one condition).
  if tg_table_name = 'camp_entries' and new.undone and not old.undone then
    if (to_jsonb(old) ->> 'kind') = 'cook'
      and (select coalesce(sum(e.qty), 0) from public.camp_entries e where e.camp_id = (to_jsonb(old) ->> 'camp_id')::uuid and e.kind = 'cook' and not e.undone and e.id <> old.id)
        < (select count(*) from public.camp_entries e where e.camp_id = (to_jsonb(old) ->> 'camp_id')::uuid and e.kind = 'meal' and e.from_pot and not e.undone) then
      raise exception 'Some of those portions were eaten: undo the meals first.';
    end if;
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

-- Which watch? is a logged change (encounter.watch), undone like any other.
create trigger log_watch after update of watch on public.waiting_encounters
  for each row execute function private.log_change();
