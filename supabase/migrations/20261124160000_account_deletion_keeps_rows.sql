-- Deleting an account keeps every row it is linked to (Francis, 2026-11-24, "yes to both questions", on #77's ⚑ 5:
-- every table whose guard would still block deleting an account, on #77's principle: the row stays, only its link to
-- the deleted account is emptied; hard rule 4). Fix forward of 20261124140000_account_deletion_keeps_calls.sql, which
-- did it for calls (hook_sends, calls_seen) alone.
--   0. private.account_links(table): the table's links to public.profiles that are `on delete set null`, read from
--      the catalogue. private.gone_account_cleared(table, before, after): true when the one change between two
--      versions of a row is one or more of those links emptied, each because its account is gone (#77's
--      private.only_gone_accounts_cleared, generated columns aside). private.account_gone(id): no profile any more.
--   1. Each table's own change guard (the `<table>_rules` triggers listed below, all `before insert or update`) is
--      skipped for exactly that change, by a WHEN on its update trigger; its insert half becomes a trigger of its own,
--      `<name>_on_insert`, which runs the same function as before (no trigger sorts between the two names, so the
--      order the triggers run in is unchanged). The guard functions themselves are not touched. Every other change is
--      refused as before, even with the secret key, and a link to an account that still stands can't be emptied.
--   2. private.stamp_row (its only definition, 20261019120000_m1_core_tables.sql) put `created_by` back on every
--      change, so a deleted account's link silently stayed (or, where the row has a second link to the same account,
--      the deletion failed on the foreign key). It now lets the emptying through once the account is gone.
--   3. private.refuse_when_retired (newest definition, 20261124140000_account_deletion_keeps_calls.sql): in a retired
--      campaign, the same change goes through on every table, campaigns.created_by and actors.owner_user_id included,
--      not only on hook_sends and calls_seen.
--   4. private.is_gone_account_line (newest definition, 20261124140000): the database's own log line for that change,
--      on any table, is not a later change that blocks an Undo (private.undo_check_made reads it; unchanged here).
-- Cascades are untouched: a membership, a library pack the account owns, and the account's private messages and
-- message recipients still go with it (04, Account deletion). Drops, renames and deletes no data; no row changes.
-- Drops and re-creates 27 triggers (the same functions, the same names, plus an `_on_insert` twin each).

-- 0. Which links, and the one change a deleted account may make --------------------------------------------------

create function private.account_links(rel regclass) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(a.attname::text order by a.attname), '{}')
  from pg_catalog.pg_constraint k
  join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
  where k.conrelid = rel and k.contype = 'f' and k.confdeltype = 'n' and k.confrelid = 'public.profiles'::regclass;
$$;
revoke execute on function private.account_links(regclass) from public, anon, authenticated;

-- The table's generated columns: a before-update trigger sees them empty in the new row (Postgres fills them in
-- after), so they are left out of the comparison (assets.storage_path).
create function private.generated_columns(rel regclass) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(a.attname::text), '{}')
  from pg_catalog.pg_attribute a
  where a.attrelid = rel and a.attnum > 0 and not a.attisdropped and a.attgenerated <> '';
$$;
revoke execute on function private.generated_columns(regclass) from public, anon, authenticated;

-- Read in a trigger's WHEN, so whoever changes the row runs it: granted to signed-in users and the secret key.
create function private.gone_account_cleared(rel regclass, before_row jsonb, after_row jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.only_gone_accounts_cleared(before_row - private.generated_columns(rel),
    after_row - private.generated_columns(rel), private.account_links(rel));
$$;
revoke execute on function private.gone_account_cleared(regclass, jsonb, jsonb) from public, anon;
grant execute on function private.gone_account_cleared(regclass, jsonb, jsonb) to authenticated, service_role;

create function private.account_gone(account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select account is not null and not exists (select 1 from public.profiles p where p.id = account);
$$;
revoke execute on function private.account_gone(uuid) from public, anon;
grant execute on function private.account_gone(uuid) to authenticated, service_role;

-- 1. Each table's change guard lets exactly that change through ---------------------------------------------------

drop trigger activity_run_rules on public.activity_runs;
create trigger activity_run_rules before update on public.activity_runs for each row
  when (not private.gone_account_cleared('public.activity_runs', to_jsonb(old), to_jsonb(new))) execute function private.activity_run_rules();
create trigger activity_run_rules_on_insert before insert on public.activity_runs for each row execute function private.activity_run_rules();

drop trigger camp_rules on public.camp_entries;
create trigger camp_rules before update on public.camp_entries for each row
  when (not private.gone_account_cleared('public.camp_entries', to_jsonb(old), to_jsonb(new))) execute function private.camp_rules();
create trigger camp_rules_on_insert before insert on public.camp_entries for each row execute function private.camp_rules();

drop trigger camp_rules on public.camps;
create trigger camp_rules before update on public.camps for each row
  when (not private.gone_account_cleared('public.camps', to_jsonb(old), to_jsonb(new))) execute function private.camp_rules();
create trigger camp_rules_on_insert before insert on public.camps for each row execute function private.camp_rules();

drop trigger check_result_rules on public.check_results;
create trigger check_result_rules before update on public.check_results for each row
  when (not private.gone_account_cleared('public.check_results', to_jsonb(old), to_jsonb(new))) execute function private.check_result_rules();
create trigger check_result_rules_on_insert before insert on public.check_results for each row execute function private.check_result_rules();

drop trigger expedition_place_rules on public.expedition_places;
create trigger expedition_place_rules before update on public.expedition_places for each row
  when (not private.gone_account_cleared('public.expedition_places', to_jsonb(old), to_jsonb(new))) execute function private.expedition_place_rules();
create trigger expedition_place_rules_on_insert before insert on public.expedition_places for each row execute function private.expedition_place_rules();

drop trigger expedition_rules on public.expeditions;
create trigger expedition_rules before update on public.expeditions for each row
  when (not private.gone_account_cleared('public.expeditions', to_jsonb(old), to_jsonb(new))) execute function private.expedition_rules();
create trigger expedition_rules_on_insert before insert on public.expeditions for each row execute function private.expedition_rules();

drop trigger gm_message_rules on public.gm_messages;
create trigger gm_message_rules before update on public.gm_messages for each row
  when (not private.gone_account_cleared('public.gm_messages', to_jsonb(old), to_jsonb(new))) execute function private.gm_message_rules();
create trigger gm_message_rules_on_insert before insert on public.gm_messages for each row execute function private.gm_message_rules();

drop trigger group_lost_rules on public.group_lost;
create trigger group_lost_rules before update on public.group_lost for each row
  when (not private.gone_account_cleared('public.group_lost', to_jsonb(old), to_jsonb(new))) execute function private.group_lost_rules();
create trigger group_lost_rules_on_insert before insert on public.group_lost for each row execute function private.group_lost_rules();

drop trigger group_place_rules on public.group_places;
create trigger group_place_rules before update on public.group_places for each row
  when (not private.gone_account_cleared('public.group_places', to_jsonb(old), to_jsonb(new))) execute function private.group_place_rules();
create trigger group_place_rules_on_insert before insert on public.group_places for each row execute function private.group_place_rules();

drop trigger knowledge_share_rules on public.knowledge_shares;
create trigger knowledge_share_rules before update on public.knowledge_shares for each row
  when (not private.gone_account_cleared('public.knowledge_shares', to_jsonb(old), to_jsonb(new))) execute function private.knowledge_share_rules();
create trigger knowledge_share_rules_on_insert before insert on public.knowledge_shares for each row execute function private.knowledge_share_rules();

drop trigger message_rules on public.messages;
create trigger message_rules before update on public.messages for each row
  when (not private.gone_account_cleared('public.messages', to_jsonb(old), to_jsonb(new))) execute function private.message_rules();
create trigger message_rules_on_insert before insert on public.messages for each row execute function private.message_rules();

drop trigger piece_show_rules on public.piece_shows;
create trigger piece_show_rules before update on public.piece_shows for each row
  when (not private.gone_account_cleared('public.piece_shows', to_jsonb(old), to_jsonb(new))) execute function private.piece_show_rules();
create trigger piece_show_rules_on_insert before insert on public.piece_shows for each row execute function private.piece_show_rules();

drop trigger place_move_rules on public.place_moves;
create trigger place_move_rules before update on public.place_moves for each row
  when (not private.gone_account_cleared('public.place_moves', to_jsonb(old), to_jsonb(new))) execute function private.place_move_rules();
create trigger place_move_rules_on_insert before insert on public.place_moves for each row execute function private.place_move_rules();

drop trigger place_piece_rules on public.place_pieces;
create trigger place_piece_rules before update on public.place_pieces for each row
  when (not private.gone_account_cleared('public.place_pieces', to_jsonb(old), to_jsonb(new))) execute function private.place_piece_rules();
create trigger place_piece_rules_on_insert before insert on public.place_pieces for each row execute function private.place_piece_rules();

drop trigger place_rule_switch_rules on public.place_rule_switches;
create trigger place_rule_switch_rules before update on public.place_rule_switches for each row
  when (not private.gone_account_cleared('public.place_rule_switches', to_jsonb(old), to_jsonb(new))) execute function private.place_rule_switch_rules();
create trigger place_rule_switch_rules_on_insert before insert on public.place_rule_switches for each row execute function private.place_rule_switch_rules();

drop trigger place_rules on public.places;
create trigger place_rules before update on public.places for each row
  when (not private.gone_account_cleared('public.places', to_jsonb(old), to_jsonb(new))) execute function private.place_rules();
create trigger place_rules_on_insert before insert on public.places for each row execute function private.place_rules();

drop trigger reminder_rules on public.reminders;
create trigger reminder_rules before update on public.reminders for each row
  when (not private.gone_account_cleared('public.reminders', to_jsonb(old), to_jsonb(new))) execute function private.reminder_rules();
create trigger reminder_rules_on_insert before insert on public.reminders for each row execute function private.reminder_rules();

drop trigger request_rules on public.requests;
create trigger request_rules before update on public.requests for each row
  when (not private.gone_account_cleared('public.requests', to_jsonb(old), to_jsonb(new))) execute function private.request_rules();
create trigger request_rules_on_insert before insert on public.requests for each row execute function private.request_rules();

drop trigger session_rules on public.sessions;
create trigger session_rules before update on public.sessions for each row
  when (not private.gone_account_cleared('public.sessions', to_jsonb(old), to_jsonb(new))) execute function private.session_rules();
create trigger session_rules_on_insert before insert on public.sessions for each row execute function private.session_rules();

drop trigger sheet_change_rules on public.sheet_changes;
create trigger sheet_change_rules before update on public.sheet_changes for each row
  when (not private.gone_account_cleared('public.sheet_changes', to_jsonb(old), to_jsonb(new))) execute function private.sheet_change_rules();
create trigger sheet_change_rules_on_insert before insert on public.sheet_changes for each row execute function private.sheet_change_rules();

drop trigger shop_stock_rules on public.shop_stock;
create trigger shop_stock_rules before update on public.shop_stock for each row
  when (not private.gone_account_cleared('public.shop_stock', to_jsonb(old), to_jsonb(new))) execute function private.shop_stock_rules();
create trigger shop_stock_rules_on_insert before insert on public.shop_stock for each row execute function private.shop_stock_rules();

drop trigger table_pin_rules on public.table_pins;
create trigger table_pin_rules before update on public.table_pins for each row
  when (not private.gone_account_cleared('public.table_pins', to_jsonb(old), to_jsonb(new))) execute function private.table_pin_rules();
create trigger table_pin_rules_on_insert before insert on public.table_pins for each row execute function private.table_pin_rules();

drop trigger table_read_rules on public.table_reads;
create trigger table_read_rules before update on public.table_reads for each row
  when (not private.gone_account_cleared('public.table_reads', to_jsonb(old), to_jsonb(new))) execute function private.table_read_rules();
create trigger table_read_rules_on_insert before insert on public.table_reads for each row execute function private.table_read_rules();

drop trigger town_piece_show_rules on public.town_piece_shows;
create trigger town_piece_show_rules before update on public.town_piece_shows for each row
  when (not private.gone_account_cleared('public.town_piece_shows', to_jsonb(old), to_jsonb(new))) execute function private.town_piece_show_rules();
create trigger town_piece_show_rules_on_insert before insert on public.town_piece_shows for each row execute function private.town_piece_show_rules();

drop trigger travel_group_rules on public.travel_groups;
create trigger travel_group_rules before update on public.travel_groups for each row
  when (not private.gone_account_cleared('public.travel_groups', to_jsonb(old), to_jsonb(new))) execute function private.travel_group_rules();
create trigger travel_group_rules_on_insert before insert on public.travel_groups for each row execute function private.travel_group_rules();

drop trigger waiting_encounter_rules on public.waiting_encounters;
create trigger waiting_encounter_rules before update on public.waiting_encounters for each row
  when (not private.gone_account_cleared('public.waiting_encounters', to_jsonb(old), to_jsonb(new))) execute function private.waiting_encounter_rules();
create trigger waiting_encounter_rules_on_insert before insert on public.waiting_encounters for each row execute function private.waiting_encounter_rules();

drop trigger weather_roll_rules on public.weather_rolls;
create trigger weather_roll_rules before update on public.weather_rolls for each row
  when (not private.gone_account_cleared('public.weather_rolls', to_jsonb(old), to_jsonb(new))) execute function private.weather_roll_rules();
create trigger weather_roll_rules_on_insert before insert on public.weather_rolls for each row execute function private.weather_roll_rules();


-- 2. created_by empties once its account is gone (as in 20261019120000_m1_core_tables.sql, plus that) -------------

create or replace function private.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce((select auth.uid()), new.created_by);
  else
    new.created_at := old.created_at;
    -- Kept as it was, unless its account was deleted (the foreign key empties it): then it stays empty.
    if not (new.created_by is null and private.account_gone(old.created_by)) then
      new.created_by := old.created_by;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 3. The retired guard: as in 20261124140000_account_deletion_keeps_calls.sql, the deleted account's link on every
-- table --------------------------------------------------------------------------------------------------------------

create or replace function private.refuse_when_retired() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  this_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  campaign uuid;
begin
  -- An account deleted while it is linked to rows in a retired campaign: the row stays, its link emptied (Francis,
  -- 2026-11-24). Nothing else.
  if tg_op = 'UPDATE' and private.gone_account_cleared(tg_relid, to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if tg_table_name = 'campaigns' then
    if tg_op = 'UPDATE' then
      if old.retired_at is null then
        -- Retiring: the database stamps the time.
        if new.retired_at is not null then
          new.retired_at := now();
        end if;
        return new;
      end if;
      -- Retired: only bringing it back, with nothing else changed.
      if new.retired_at is null
        and (to_jsonb(new) - 'retired_at' - 'updated_at') = (to_jsonb(old) - 'retired_at' - 'updated_at') then
        return new;
      end if;
      raise exception 'This campaign is retired, so nothing in it can change.';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Deletes that follow from another change (a cascade) go through.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_table_name = 'actor_secrets' then
    select a.campaign_id into campaign from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  elsif tg_table_name in ('library_entries', 'library_entry_secrets') then
    select p.campaign_id into campaign from public.packs p where p.id = (this_row ->> 'pack_id')::uuid;
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  if private.campaign_is_retired(campaign) then
    raise exception 'This campaign is retired, so nothing in it can change.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function private.refuse_when_retired() from public, anon, authenticated;

-- 4. The database's own line for that change, on any table (as in 20261124140000, any table's links) ----------------

-- Written by no one, and only the table's links to an account, each now empty, each to an account that is gone.
create or replace function private.is_gone_account_line(line public.events) returns boolean
language sql stable security definer set search_path = '' as $$
  select line.actor_user_id is null and to_regclass('public.' || line.target_table) is not null
    and line.before is not null and line.after is not null and line.after <> '{}'::jsonb
    and not exists (
      select 1 from jsonb_each(line.after) a
      where a.key <> all (private.account_links(to_regclass('public.' || line.target_table))) or a.value <> 'null'::jsonb
    )
    and not exists (
      select 1 from jsonb_each_text(line.before) b join public.profiles p on p.id::text = b.value
    );
$$;
