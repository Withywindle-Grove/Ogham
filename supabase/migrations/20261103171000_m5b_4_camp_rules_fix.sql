-- M5b step 4, part 2, fix forward: private.camp_rules (from 20261103170000_m5b_4_camp_night.sql, its newest
-- definition) read `free || 'applied_at'` as an array literal, so Next day's apply failed. Replaces one function;
-- changes no rows.

-- As in 20261103170000_m5b_4_camp_night.sql (its newest), but `applied_at` joins the free columns as text, not as an
-- array literal (that one failed: "malformed array literal").
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
  if tg_table_name = 'camp_entries' and new.undone and not old.undone and old.kind = 'cook'
    and (select coalesce(sum(e.qty), 0) from public.camp_entries e where e.camp_id = old.camp_id and e.kind = 'cook' and not e.undone and e.id <> old.id)
      < (select count(*) from public.camp_entries e where e.camp_id = old.camp_id and e.kind = 'meal' and e.from_pot and not e.undone) then
    raise exception 'Some of those portions were eaten: undo the meals first.';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
