-- M5b step 3, part 2 (docs/plans/m5b-3-players.md, build orders 3 and 4; ruled 2026-10-30, S4-3 and S4-4; Francis's
-- ruling of 2026-11-03 on the plan's ⚑ 1: a secret activity's cost applies when the GM accepts; the answer kind is
-- Yes / No plus the GM's own Hit / Miss on the pack's chance).
--   1. answer_secret_activity: the GM's answer to a secret activity's request (kind secretActivity; one of g4's
--      requests, not a second system). As answer_request, and when the answer is Yes the activity's cost comes off
--      the group's travel budget today in the same request (`spend` points, or all that's left), so the one Undo of
--      the answer puts both back. The GM's own Hit / Miss on the pack's chance is a check result (check.record, the
--      GM's own secret check: GM-only until Downtime), never in the request's answer: the requester reads their
--      request, and must read nothing of the roll (S4-3).
--      Hidden means hidden: the request's lines are its requester's own (private.log_audience_requests, unchanged);
--      the travel row's line is the GM's (no audience function, m5b-1); the budget itself drops for the group, which
--      is the cost the button showed.
--   2. known_places (What we know, S4-4): for the reader's groups, every place the GM has shown them on the
--      expedition under way, with the pieces shown (as scene_pieces, but over every visit, not the current one
--      alone). Nothing of a place that was never shown, nor of a piece hidden again.
-- Adds two functions. Replaces nothing; drops nothing; no rows are removed, renamed or changed.

-- 1. The GM's answer to a secret activity ------------------------------------------------------------------------------

create function public.answer_secret_activity(request uuid, answer jsonb, spend integer default 0, all_left boolean default false, seen_version integer default null)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  found public.requests;
  row_now public.travel_groups;
  points integer;
begin
  select * into found from public.requests r where r.id = request;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.kind <> 'secretActivity' then
    raise exception 'That isn''t a secret activity.';
  end if;
  if found.status = 'answered' and private.repeated_request('requests', found.id) then
    return found;
  end if;
  if spend is null or spend < 0 or spend > 100000 then
    raise exception 'A whole number of points, 0 or more, is needed.';
  end if;
  -- The answer itself, as any request's (status, answer, answered_by and answered_at; the repeat and version checks).
  found := public.answer_request(request, answer, null, null, seen_version);
  if coalesce((answer ->> 'yes')::boolean, false) and (spend > 0 or all_left) then
    row_now := private.travel_row(found.campaign_id, coalesce(found.group_number, 1));
    points := case when all_left then greatest(0, row_now.total - row_now.spent) else spend end;
    if points > 0 then
      update public.travel_groups t set spent = least(100000, t.spent + points) where t.id = row_now.id;
    end if;
  end if;
  return found;
end;
$$;
revoke execute on function public.answer_secret_activity(uuid, jsonb, integer, boolean, integer) from public, anon;
grant execute on function public.answer_secret_activity(uuid, jsonb, integer, boolean, integer) to authenticated, service_role;

-- 2. What we know --------------------------------------------------------------------------------------------------------

-- The places shown to the reader's groups on the expedition under way, visit by visit, with the pieces shown on each
-- (as scene_pieces reads the current place): the GM reads none here (the GM has the place cards).
create function public.known_places(campaign uuid)
returns table (visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text)
language sql stable security definer set search_path = '' as $$
  select gp.id, gp.group_number, p.id, p.name, gp.created_at, pc.id, pc.kind, pc.body
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and x.ended_at is null and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.in_my_group(campaign, gp.group_number)
  order by gp.created_at, gp.id, s.shown_at, s.id;
$$;
revoke execute on function public.known_places(uuid) from public, anon;
grant execute on function public.known_places(uuid) to authenticated, service_role;
