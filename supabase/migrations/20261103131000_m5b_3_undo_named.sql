-- M5b step 3, fix forward: an activity's undo is logged under its own command (activity.undo), as every command's
-- events carry its name (supabase/tests/commands.test.ts checks they match), not as event.undo. Each change still links
-- to the one it reverses (reverts_event_id), so the log marks the activity undone.
-- Replaces public.undo_activity (newest copy: 20261103130000_m5b_3_activities.sql). Drops nothing; no rows are removed.

create or replace function public.undo_activity(run_id uuid) returns public.activity_runs
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
  return run;
end;
$$;
