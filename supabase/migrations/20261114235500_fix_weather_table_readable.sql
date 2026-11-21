-- Fix (found by the rv-3 review of #802): a player entering the weather could name a GM-only weather table and learn
-- its row. The weather roll's rules read the table with its hidden part (private.weather_read, a definer function),
-- and accepted any table the setting rules name, hidden parts included; the row's result and tags then went into
-- weather_rolls, which every member reads, and the log. Now a player's entry is taken only on a weather table the
-- readable part of the campaign's setting rules names (what the player's own app reads); the GM's is unchanged.
-- No read rule, policy or grant on a table changes. Francis's yes: wl-1, 2026-11-14 ("Yes close weather Leak too"),
-- option (2) only; a readable alternate table a player names stays open until option (1) (a test to do).

-- The weather tables the readable part of the campaign's setting rules names (library_entries.data only: the hidden
-- part, library_entry_secrets, is left out; its overrides are the players' version the split keeps there).
create function private.campaign_readable_weather_tables(campaign uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  with rules as (
    select e.data
    from public.campaign_packs cp
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    where cp.campaign_id = campaign
  ), named as (
    select private.weather_table_ids_in(r.data) as id from rules r
    union all
    select private.weather_table_ids_in(o.value) from rules r,
      jsonb_each(case when jsonb_typeof(r.data -> 'byOption') = 'object' then r.data -> 'byOption' else '{}'::jsonb end) o
    where jsonb_typeof(o.value) = 'object'
  )
  select coalesce(array_agg(distinct n.id), '{}') from named n where n.id is not null and length(trim(n.id)) > 0;
$$;
revoke execute on function private.campaign_readable_weather_tables(uuid) from public, anon, authenticated;
grant execute on function private.campaign_readable_weather_tables(uuid) to service_role;

-- As in 20261101120000_m5_review_fixes.sql, plus: a player's entry names a weather table of the readable setting
-- rules, checked before the table is read (so nothing of a hidden table, not even whether a roll has a row, comes
-- back). The words are the ones a table that isn't a weather table gets, so a hidden table's name gives nothing away.
create or replace function private.weather_roll_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  as_gm boolean := private.is_gm(new.campaign_id);
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  reading jsonb;
  due jsonb;
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.expeditions x
      where x.id = new.expedition_id and x.campaign_id = new.campaign_id and x.ended_at is null and not x.undone
    ) then
      raise exception 'The weather is entered while an expedition is under way.';
    end if;
    if who is not null and not as_gm
      and (select c.settings ->> 'weatherRolledBy' from public.campaigns c where c.id = new.campaign_id) = 'gm' then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    if who is not null and not as_gm then
      due := private.weather_now(new.campaign_id, new.expedition_id);
      if due is null then
        raise exception 'The weather isn''t rolled on this expedition.';
      end if;
      if new.period is distinct from (due ->> 'period')::integer then
        raise exception 'That isn''t the weather that''s due. Enter today''s.';
      end if;
      new.starts_at := (due ->> 'startsAt')::bigint;
      if exists (
        select 1 from public.weather_rolls w
        where w.expedition_id = new.expedition_id and w.period = new.period and w.undone and w.entered_by = who
      ) then
        raise exception 'You undid the weather for this step. The GM enters it now.';
      end if;
      if not (coalesce(trim(new.table_id), '') = any (private.campaign_readable_weather_tables(new.campaign_id))) then
        raise exception 'That isn''t one of the setting''s weather tables.';
      end if;
    end if;
    new.table_id := trim(new.table_id);
    new.roll := regexp_replace(coalesce(new.roll, ''), '\s+', '', 'g');
    reading := private.weather_read(new.campaign_id, new.table_id, new.roll);
    new.result := reading ->> 'result';
    new.tags := reading -> 'tags';
    new.entered_by := who;
    new.entered_at := now();
    new.corrected_by := null;
    new.undone := false;
    return new;
  end if;
  if old.undone then
    raise exception 'That weather was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.period is distinct from old.period or new.starts_at is distinct from old.starts_at
    or new.entered_by is distinct from old.entered_by or new.entered_at is distinct from old.entered_at
    or new.created_at is distinct from old.created_at then
    raise exception 'That can''t be changed.';
  end if;
  if who is not null and not as_gm then
    -- The entrant's Undo from the toast, and only that, while the toast could still be showing.
    if not (reverting and new.undone and old.entered_by = who and old.entered_at >= now() - interval '30 seconds'
      and new.table_id is not distinct from old.table_id and new.roll is not distinct from old.roll
      and new.result is not distinct from old.result and new.tags is not distinct from old.tags
      and new.corrected_by is not distinct from old.corrected_by) then
      raise exception 'Only the GM changes the weather once it''s in.' using errcode = '42501';
    end if;
  elsif not reverting then
    if new.table_id is distinct from old.table_id or new.roll is distinct from old.roll then
      new.table_id := trim(new.table_id);
      new.roll := regexp_replace(coalesce(new.roll, ''), '\s+', '', 'g');
      reading := private.weather_read(new.campaign_id, new.table_id, new.roll);
      new.result := reading ->> 'result';
      new.tags := reading -> 'tags';
      new.corrected_by := who;
    else
      new.result := old.result;
      new.tags := old.tags;
      new.corrected_by := old.corrected_by;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.weather_roll_rules() from public, anon, authenticated;
