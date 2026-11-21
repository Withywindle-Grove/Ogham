-- M5b, the full sheet revised, review round 1 on #567 (Design's rulings of 2026-11-08 on the three ⚑; fix forward on
-- 20261108200000_m5b_sheet_changes.sql, already on the test project):
--   1. Approval is only for the rules set's own figures: the pack's scores, Max HP and the level. A field the GM made
--      (a number field included) saves at once. private.score_keys(campaign) names the pack's scores: the `abilities`
--      of the campaign's top rules set that lists them (homebrew first, then by priority, as the app reads them), each
--      as written and as a field key made from it (lower case, anything but a-z and 0-9 as "_", at most 36 long; the
--      app's holdsAbility).
--   2. The database enforces it: a player may no longer write Max HP (from none too: ruling 3, Set max waits for the
--      GM) or a score straight onto an approved character. private.guard_rules_figures, a trigger before an update of
--      hp_max or fields on public.actors, on the pattern of private.guard_class_race (20261102311000), lets the change
--      through for the database itself (no auth.uid()), an undo (grimoire.reverting), the GM, or a character not yet
--      approved; anyone else changing hp_max or a score key is refused (42501). The GM's answer runs as the GM.
--   3. public.request_sheet_change (newest copy: 20261108200000) asks only for a score key, Max HP ('hpMax') or the
--      level ('level'); a score whose field is hidden (retired) is refused.
--   4. public.answer_sheet_change (newest copy: 20261108200000) refuses Approve when the figure on the character is no
--      longer the one asked from ("That's changed since"), and writes the level for a level change.
-- Adds two functions and one trigger; replaces two functions. Drops, renames and deletes nothing; no rows change.

-- 1. The pack's scores -----------------------------------------------------------------------------------------------

create function private.score_keys(campaign uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  with top as (
    select e.data -> 'abilities' as abilities
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    where cp.campaign_id = campaign and jsonb_typeof(e.data -> 'abilities') = 'array' and jsonb_array_length(e.data -> 'abilities') > 0
    order by (p.kind = 'homebrew') desc, cp.priority desc, cp.created_at desc
    limit 1
  ),
  named as (
    select case when jsonb_typeof(a) = 'string' then a #>> '{}' else a ->> 'key' end as key
    from top, jsonb_array_elements(top.abilities) a
  )
  select coalesce(array_agg(distinct k), '{}')
  from named, lateral (
    values (named.key),
      (left(trim(both '_' from regexp_replace(normalize(lower(named.key), NFKD), '[^a-z0-9]+', '_', 'g')), 36))
  ) as v(k)
  where named.key is not null and length(trim(named.key)) > 0 and length(k) > 0;
$$;
revoke execute on function private.score_keys(uuid) from public, anon, authenticated;

-- 2. The guard -------------------------------------------------------------------------------------------------------

create function private.guard_rules_figures() returns trigger
language plpgsql set search_path = '' as $$
declare
  scores text[];
  key text;
begin
  if (select auth.uid()) is null
    or nullif(current_setting('grimoire.reverting', true), '') is not null
    or private.is_gm(old.campaign_id)
    or old.approval <> 'approved' then
    return new;
  end if;
  if new.hp_max is distinct from old.hp_max then
    raise exception 'Your GM approves a change to Max HP: send it from Edit.' using errcode = '42501';
  end if;
  if new.fields is not distinct from old.fields then
    return new;
  end if;
  scores := private.score_keys(old.campaign_id);
  foreach key in array scores loop
    if (coalesce(new.fields, '{}'::jsonb) -> key) is distinct from (coalesce(old.fields, '{}'::jsonb) -> key) then
      raise exception 'Your GM approves a change to a score: send it from Edit.' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function private.guard_rules_figures() from public, anon, authenticated;

create trigger guard_rules_figures before update of hp_max, fields on public.actors
  for each row execute function private.guard_rules_figures();

-- 3. Asking (as in 20261108200000, with the figures limited to the rules set's own: marked) ---------------------------

create or replace function public.request_sheet_change(actor uuid, field text, label text, to_value integer)
returns public.sheet_changes
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('sheet_changes');
  change public.sheet_changes;
  who public.actors;
  before integer;
  raw jsonb;
begin
  if made is not null then
    select * into change from public.sheet_changes s where s.id = made;
    return change;
  end if;
  select * into who from public.actors a where a.id = actor;
  if who.id is null or who.owner_type <> 'user' or who.owner_user_id is distinct from (select auth.uid())
    or not private.is_member(who.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if who.approval <> 'approved' or who.status <> 'active' then
    raise exception 'Only a character in play asks the GM for a change.';
  end if;
  if to_value is null or to_value < 1 or to_value > 9999 then
    raise exception 'Ask for a whole number from 1 to 9999.';
  end if;
  if label is null or length(trim(label)) = 0 or length(trim(label)) > 80 then
    raise exception 'Say what the change is to.';
  end if;
  -- Changed: Max HP, the level, or one of the pack's scores whose field is in use (not hidden).
  if request_sheet_change.field = 'hpMax' then
    before := who.hp_max;
  elsif request_sheet_change.field = 'level' then
    before := who.level;
  elsif request_sheet_change.field = any (private.score_keys(who.campaign_id)) and exists (
    select 1 from public.field_definitions f
    where f.campaign_id = who.campaign_id and f.key = request_sheet_change.field and f.type = 'number' and not f.hidden
  ) then
    raw := who.fields -> request_sheet_change.field;
    before := case when jsonb_typeof(raw) = 'number' then (raw #>> '{}')::numeric::integer end;
  else
    raise exception 'That figure saves at once: only a score, Max HP or the level waits for the GM.';
  end if;
  if before is not distinct from to_value then
    raise exception 'That''s the figure already.';
  end if;
  update public.sheet_changes s set status = 'withdrawn'
  where s.actor_id = actor and s.field = request_sheet_change.field and s.status = 'waiting' and not s.undone;
  insert into public.sheet_changes (campaign_id, actor_id, requester_id, field, label, from_value, to_value)
  values (who.campaign_id, who.id, who.owner_user_id, request_sheet_change.field, trim(request_sheet_change.label), before, request_sheet_change.to_value)
  returning * into change;
  return change;
end;
$$;

-- 4. The GM's answer (as in 20261108200000, with the figure checked before Approve and the level written: marked) -----

create or replace function public.answer_sheet_change(change uuid, approve boolean, reason text default '', seen_version integer default null)
returns public.sheet_changes
language plpgsql security definer set search_path = '' as $$
declare
  found public.sheet_changes;
  who public.actors;
  now_value integer;
  raw jsonb;
begin
  select * into found from public.sheet_changes s where s.id = change;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.status in ('approved', 'refused') and private.repeated_request('sheet_changes', found.id) then
    return found;
  end if;
  if found.status = 'withdrawn' then
    raise exception 'Its player took it back.';
  end if;
  if found.status <> 'waiting' or found.undone then
    raise exception 'That change was already %.', found.status;
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  if length(coalesce(reason, '')) > 500 then
    raise exception 'Keep the reason under 500 characters.';
  end if;
  if approve then
    -- Changed: the figure must still be the one the player asked from.
    select * into who from public.actors a where a.id = found.actor_id;
    if found.field = 'hpMax' then
      now_value := who.hp_max;
    elsif found.field = 'level' then
      now_value := who.level;
    else
      raw := who.fields -> found.field;
      now_value := case when jsonb_typeof(raw) = 'number' then (raw #>> '{}')::numeric::integer end;
    end if;
    if now_value is distinct from found.from_value then
      raise exception 'That''s changed since: the sheet reads % now. Refuse it, or ask the player to send it again.', coalesce(now_value::text, 'nothing') using errcode = 'GR409';
    end if;
    if found.field = 'hpMax' then
      update public.actors a set hp_max = found.to_value where a.id = found.actor_id;
    elsif found.field = 'level' then
      update public.actors a set level = found.to_value where a.id = found.actor_id;
    else
      update public.actors a set fields = coalesce(a.fields, '{}'::jsonb) || jsonb_build_object(found.field, found.to_value)
      where a.id = found.actor_id;
    end if;
  end if;
  update public.sheet_changes s
  set status = case when approve then 'approved' else 'refused' end,
    reason = case when approve then '' else trim(coalesce(answer_sheet_change.reason, '')) end,
    answered_by = (select auth.uid()), answered_at = now()
  where s.id = change returning * into found;
  return found;
end;
$$;
