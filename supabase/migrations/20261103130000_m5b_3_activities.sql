-- M5b step 3: activities on the players' wilderness screen (docs/plans/m5b-3-players.md, build orders 1–2; ruled
-- 2026-10-30, D3, S4-8; docs/05 "Activities"; docs/03 the Activities row). A player (or the GM) runs one of the
-- pack's non-secret activities for their group: the cost comes off today's travel budget and what it yields goes
-- into the finder's pack, in one request, so one log line; Undo puts both back.
--   1. activity_runs: one row per activity done: the group, the activity (the pack's id and name, as it was), who
--      acted, the rolls entered, the outcome, what came off the budget and the yield (the item, how many, the line it
--      made). The GM reads all; a player reads their own group's rows (private.in_my_group). Its lines are everyone's
--      (the pack's non-secret activities; a secret activity is a request, build order 3, not a run).
--   2. apply_activity (activity.apply): checks who may (the GM, or a member with a character in the group; everyone
--      named must be an active character of the group, the finder one of them), spends the points (never blocked:
--      what's left shows 0), puts the yield in the finder's pack (a line from the setting rules, found), and makes the
--      run. Runs as the database: a player can't write the group's travel row or another's pack themselves.
--   3. undo_activity (activity.undo): the run's author or the GM, the same day only: the yield comes out of the pack
--      (the line it made, while it's untouched: the log keeps its copy), the points go back and the run is marked
--      undone, each change linked to the one it reverses and logged as an undo (event.undo), as the log's Undo does.
--      The generic undo can't remove a made line (hard rule 4); D3 rules the yield's Undo (05: "with Undo").
-- Adds one table with its rules, trigger and policy, three functions and rows in logged_commands and undoable_tables.
-- Replaces nothing; drops nothing; no rows are removed, renamed or changed.

-- 1. The runs ----------------------------------------------------------------------------------------------------------

create table public.activity_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  group_number integer not null,
  -- The expedition's day of the group's travel row it was spent from (null: nothing spent).
  travel_group_id uuid references public.travel_groups (id) on delete set null,
  day integer check (day is null or day between 0 and 10000000),
  activity_id text not null check (length(activity_id) between 1 and 200),
  activity_name text not null check (length(activity_name) between 1 and 200),
  actor_ids uuid[] not null default '{}',
  -- [{actorId, roll}] as entered.
  rolls jsonb not null default '[]'::jsonb check (jsonb_typeof(rolls) = 'array'),
  outcome text not null check (outcome in ('worked', 'failed', 'done')),
  spent integer not null default 0 check (spent between 0 and 100000),
  finder_id uuid references public.actors (id) on delete set null,
  yield_line_id uuid,
  yield_name text check (yield_name is null or length(yield_name) between 1 and 200),
  yield_qty integer not null default 0 check (yield_qty between 0 and 100000),
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade,
  check ((yield_qty = 0) = (yield_line_id is null))
);
create index activity_runs_campaign on public.activity_runs (campaign_id, created_at desc);

alter table public.activity_runs enable row level security;
grant select on public.activity_runs to authenticated;
grant select, insert, update, delete on public.activity_runs to service_role;

create policy "activities: the GM, and players for their own group" on public.activity_runs
  for select to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));

-- A run never changes but for being undone, and only by an undo.
create function private.activity_run_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if not reverting or (to_jsonb(new) - 'undone' - 'version' - 'updated_at') is distinct from (to_jsonb(old) - 'undone' - 'version' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.activity_run_rules() from public, anon, authenticated;

create trigger activity_run_rules before insert or update on public.activity_runs
  for each row execute function private.activity_run_rules();
create trigger refuse_when_retired before insert or update or delete on public.activity_runs
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update of undone on public.activity_runs
  for each row execute function private.log_change();

-- The lines are everyone's: the pack's non-secret activities, done at the table.
create function private.log_audience_activity_runs(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  who_sees := 'all';
  owner := null;
end;
$$;
revoke execute on function private.log_audience_activity_runs(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('activity_runs');

-- 2. Doing one ---------------------------------------------------------------------------------------------------------

-- Whether an actor is an active, approved character (or hireling) of the campaign in this group.
create function private.actor_in_group(campaign uuid, group_no integer, actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.actors a
    left join public.party_group_members m on m.actor_id = a.id
    where a.id = actor and a.campaign_id = campaign and a.kind in ('pc', 'hireling') and a.approval = 'approved' and a.status = 'active'
      and coalesce(m.group_number, 1) = group_no
  );
$$;
revoke execute on function private.actor_in_group(uuid, integer, uuid) from public, anon, authenticated;

-- activity.apply: one activity done by a group. `spend` is what comes off today's budget (the device works it out:
-- the pack's number, all that's left, or the terrain's); `yield_*` the item from the setting rules and how many (0:
-- nothing). A repeat of the same request gives back the run it made.
create function public.apply_activity(
  campaign uuid, group_no integer, activity_id text, activity_name text, actors uuid[], finder uuid,
  rolls jsonb, outcome text, spend integer,
  yield_entry uuid default null, yield_name text default null, yield_category text default '', yield_weight integer default null,
  yield_slots integer default null, yield_stack integer default 1, yield_qty integer default 0
)
returns public.activity_runs
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('activity_runs');
  run public.activity_runs;
  trip uuid;
  row_now public.travel_groups;
  line_id uuid;
  who uuid;
begin
  if made is not null then
    select * into run from public.activity_runs r where r.id = made;
    return run;
  end if;
  if not (private.is_gm(campaign) or private.in_my_group(campaign, group_no)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  trip := private.expedition_under_way(campaign);
  if trip is null then
    raise exception 'Start an expedition first.';
  end if;
  if actors is null or cardinality(actors) = 0 then
    raise exception 'Pick who''s acting.';
  end if;
  foreach who in array actors loop
    if not private.actor_in_group(campaign, group_no, who) then
      raise exception 'Everyone acting must be in the group.';
    end if;
  end loop;
  if outcome is null or outcome not in ('worked', 'failed', 'done') then
    raise exception 'Say how it went.';
  end if;
  if spend is null or spend < 0 or spend > 100000 then
    raise exception 'A whole number of points, 0 or more, is needed.';
  end if;
  if coalesce(yield_qty, 0) < 0 or coalesce(yield_qty, 0) > 100000 then
    raise exception 'How many must be a whole number, 0 or more.';
  end if;
  if coalesce(yield_qty, 0) > 0 then
    if finder is null or not (finder = any (actors)) then
      raise exception 'The finder must be one of those acting.';
    end if;
    if yield_entry is null or yield_name is null or length(trim(yield_name)) = 0 then
      raise exception 'That item isn''t in the setting rules.';
    end if;
    line_id := gen_random_uuid();
  end if;
  if spend > 0 then
    row_now := private.travel_row(campaign, group_no);
  end if;

  insert into public.activity_runs (
    campaign_id, expedition_id, group_number, travel_group_id, day, activity_id, activity_name, actor_ids, rolls, outcome,
    spent, finder_id, yield_line_id, yield_name, yield_qty
  ) values (
    campaign, trip, group_no, row_now.id, row_now.day, left(trim(activity_id), 200), left(trim(activity_name), 200), actors,
    coalesce(rolls, '[]'::jsonb), outcome, spend, case when line_id is null then null else finder end, line_id,
    case when line_id is null then null else left(trim(yield_name), 200) end, case when line_id is null then 0 else yield_qty end
  ) returning * into run;

  if spend > 0 then
    update public.travel_groups t set spent = least(100000, t.spent + spend) where t.id = row_now.id;
  end if;
  if line_id is not null then
    insert into public.inventory_lines (id, campaign_id, actor_id, library_entry_id, name, category, weight_coin, slots, stack, item_data, qty, how_got)
    values (line_id, campaign, finder, yield_entry, left(trim(yield_name), 200), coalesce(yield_category, ''), yield_weight, yield_slots,
      greatest(1, coalesce(yield_stack, 1)), '{}'::jsonb, yield_qty, 'found');
  end if;
  return run;
end;
$$;
revoke execute on function public.apply_activity(uuid, integer, text, text, uuid[], uuid, jsonb, text, integer, uuid, text, text, integer, integer, integer, integer) from public, anon;
grant execute on function public.apply_activity(uuid, integer, text, text, uuid[], uuid, jsonb, text, integer, uuid, text, text, integer, integer, integer, integer) to authenticated, service_role;

-- 3. Undoing one -------------------------------------------------------------------------------------------------------

-- activity.undo: the yield comes out, the points go back, the run is marked undone; each change reverses the one it
-- undoes and is logged as an undo. The run's author or the GM; the same day only; refused once the yield was touched.
create function public.undo_activity(run_id uuid) returns public.activity_runs
language plpgsql security definer set search_path = '' as $$
declare
  run public.activity_runs;
  made_event uuid;
  request uuid;
  author uuid;
  change_id uuid;
  line public.inventory_lines;
  row_now public.travel_groups;
begin
  select * into run from public.activity_runs r where r.id = run_id for update;
  if run.id is null or not (private.is_gm(run.campaign_id) or (private.is_member(run.campaign_id) and run.created_by = (select auth.uid()))) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if run.undone then
    raise exception 'That was already undone.';
  end if;
  select e.id, e.request_id, e.actor_user_id into made_event, request, author from public.events e
  where e.campaign_id = run.campaign_id and e.target_table = 'activity_runs' and e.target_id = run.id and e.before is null
  order by e.seq limit 1;

  perform set_config('grimoire.event_type', 'event.undo', true);
  -- The yield: the line it made, as it made it (in the finder's pack, the same count, not put in anything).
  if run.yield_line_id is not null then
    select * into line from public.inventory_lines l where l.id = run.yield_line_id for update;
    if line.id is null or line.actor_id is distinct from run.finder_id or line.qty <> run.yield_qty or line.container_line_id is not null then
      raise exception 'That''s changed since: the % was used or moved. Undo the later change first.', run.yield_name;
    end if;
    select e.id into change_id from public.events e
    where e.campaign_id = run.campaign_id and e.target_table = 'inventory_lines' and e.target_id = line.id and e.before is null
      and e.request_id is not distinct from request
    order by e.seq limit 1;
    perform set_config('grimoire.reverting', coalesce(change_id, made_event)::text, true);
    delete from public.inventory_lines l where l.id = line.id;
  end if;
  -- The points: back on the same day's row.
  if run.spent > 0 and run.travel_group_id is not null then
    select * into row_now from public.travel_groups t where t.id = run.travel_group_id for update;
    if row_now.id is null or row_now.undone or row_now.day is distinct from run.day then
      raise exception 'A new day has started: that can''t be undone now.';
    end if;
    select e.id into change_id from public.events e
    where e.campaign_id = run.campaign_id and e.target_table = 'travel_groups' and e.target_id = row_now.id
      and e.request_id is not distinct from request and e.actor_user_id is not distinct from author
    order by e.seq desc limit 1;
    perform set_config('grimoire.reverting', coalesce(change_id, made_event)::text, true);
    update public.travel_groups t set spent = greatest(0, t.spent - run.spent) where t.id = row_now.id;
  end if;
  perform set_config('grimoire.reverting', made_event::text, true);
  update public.activity_runs r set undone = true where r.id = run.id returning * into run;
  perform set_config('grimoire.reverting', '', true);
  perform set_config('grimoire.event_type', '', true);
  return run;
end;
$$;
revoke execute on function public.undo_activity(uuid) from public, anon;
grant execute on function public.undo_activity(uuid) to authenticated, service_role;

insert into public.logged_commands (name, level, gm_only) values
  ('activity.apply', 'simple', false),
  ('activity.undo', 'simple', false);
