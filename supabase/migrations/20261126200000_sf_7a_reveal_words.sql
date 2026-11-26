-- Scene feedback, batch A1, row sf-7a (docs/plans/dec-scene-feedback.md; ruling
-- docs/design/rulings/scene-feedback-2026-11-25.md: the critique's finding 1 on page 44, "Preview, then send"; sf-20,
-- sf-22): what a reveal of an encounter result stores, and what players read.
--
-- What it changes, plainly. Add-only: one new table with its own rules, three functions and two rows in
-- public.logged_commands. No existing table, function or access rule changes; nothing is dropped, renamed or deleted.
--   1. public.check_reveals: one row a reveal. The hit it belongs to (a check result), the words the GM confirmed, when,
--      and whether it was taken back. Nothing of the check is copied onto it: no table, no roll, no row of the book.
--   2. Read: the campaign's GM alone reads the table (it names the hit). Write: no one through the table (no insert,
--      update or delete grant or policy for anyone signed in); only the two functions below write it.
--   3. public.show_check_words(result, words) (check.showWords, GM only): keeps the words and shows them to the
--      players. One reveal stands for a hit at a time. It does NOT set the result's `revealed`, so the result's own
--      row and log lines stay the GM's until the next Downtime, as before (sf-22).
--   4. public.take_back_check_words(reveal) (check.takeBackWords, GM only): marks the reveal taken back. The row stays
--      (hard rule 4).
--   5. public.revealed_words(campaign): what a member's device is sent. For each reveal that stands, its id, its words
--      and when it was shown, and nothing else: never the hit, the table, the roll or the book's row. A reveal taken
--      back, or one whose check result was undone, is not in the answer. Someone outside the campaign gets nothing.
--   6. The log (sf-20). Each command writes two lines in one request, itself (the table has no log trigger, since a
--      trigger's line carries the whole row, the hit's id with it):
--        the GM's line (audience 'gm'): the words, the hit, and the row as it was then, which names its table
--        (check.setRoll keeps "<table>: <row>");
--        the players' line (audience 'all'): the words they were shown and the reveal's id, and nothing of the check
--        (no hit, table, row, roll, stat line or count). A take-back's line says only that words were taken back; the
--        line of the showing keeps its words, as any log line does (hard rule 4).
--      Neither line can be undone from the log (the table is not in public.undoable_tables): taking a reveal back is
--      its own command.

-- 1. The reveal ---------------------------------------------------------------------------------------------------------

create table public.check_reveals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The hit it belongs to. The GM's alone: never in a player's answer, and never on a line a player reads.
  check_result_id uuid not null references public.check_results (id) on delete cascade,
  -- The words the GM confirmed in "Reveal to players": all a player is ever sent of the result.
  words text not null check (length(btrim(words)) between 1 and 2000),
  -- Set by the server, in show_check_words, never sent by a device.
  shown_at timestamptz not null default now(),
  taken_back boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One reveal stands for a hit at a time.
create unique index check_reveals_one_standing on public.check_reveals (check_result_id) where not taken_back;
create index check_reveals_campaign on public.check_reveals (campaign_id, shown_at desc);

-- 2. Who reads it, and that no one writes it through the table ------------------------------------------------------------

alter table public.check_reveals enable row level security;
grant select on public.check_reveals to authenticated;
grant select, insert, update, delete on public.check_reveals to service_role;

-- A player reads no row of it, whatever the row holds: their words come from public.revealed_words.
create policy "check reveals: the GM reads" on public.check_reveals
  for select to authenticated using (private.is_gm(campaign_id));

create trigger refuse_when_retired before insert or update or delete on public.check_reveals
  for each row execute function private.refuse_when_retired();

-- 3. Show players ---------------------------------------------------------------------------------------------------------

-- check.showWords: the GM shows the players these words for one hit. Refused (42501) for anyone but the campaign's GM.
-- A repeat of the same request gives back what the first made; so does a second request with the same words while the
-- reveal stands. Other words while one stands are refused: the first is taken back first, so players never read two.
create function public.show_check_words(result uuid, words text) returns public.check_reveals
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  tag jsonb := private.request_tag();
  request uuid;
  part integer;
  made uuid := private.made_by_request('check_reveals');
  hit public.check_results;
  said text := btrim(coalesce(show_check_words.words, ''));
  found public.check_reveals;
begin
  if made is not null then
    select * into found from public.check_reveals r where r.id = made;
    if found.id is null or not private.is_gm(found.campaign_id) then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    return found;
  end if;
  -- The hit's row is locked, so two devices can't each make its standing reveal.
  select * into hit from public.check_results r where r.id = show_check_words.result for update;
  if who is null or hit.id is null or not private.is_gm(hit.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if hit.undone then
    raise exception 'That result was undone.';
  end if;
  if hit.outcome <> 'hit' then
    raise exception 'Only a hit has something to show.';
  end if;
  if said = '' then
    raise exception 'Write what the players see first.';
  end if;
  if length(said) > 2000 then
    raise exception 'That''s too long to show. Keep it under 2,000 characters.';
  end if;
  select * into found from public.check_reveals r where r.check_result_id = hit.id and not r.taken_back;
  if found.id is not null then
    if found.words = said then
      return found;
    end if;
    raise exception 'The players were shown other words for this. Take those back first.';
  end if;

  insert into public.check_reveals (campaign_id, check_result_id, words)
  values (hit.campaign_id, hit.id, said)
  returning * into found;

  begin
    request := (tag ->> 'requestId')::uuid;
    part := (tag ->> 'part')::integer;
  exception when others then
    request := null;
    part := null;
  end;
  -- Called with no tag, the two lines still read as one action.
  request := coalesce(request, gen_random_uuid());

  -- The GM's line (sf-20): the words, the hit, and the row as it is now, which names its table (check.setRoll keeps
  -- "<table>: <row>" as the GM read it). Read by the GM alone.
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, after, audience, request_id, request_part)
  values (hit.campaign_id, 'check.showWords', 'simple', who, 'check_reveals', found.id,
    jsonb_strip_nulls(jsonb_build_object('words', found.words, 'check_result_id', hit.id, 'row', hit.row_text)),
    'gm', request, part);
  -- The players' line (sf-20): the words they were shown, and which reveal. Nothing of the check: no hit, table, row,
  -- roll, stat line or count.
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, after, audience, request_id, request_part)
  values (hit.campaign_id, 'check.showWords', 'simple', who, 'check_reveals', found.id,
    jsonb_build_object('shown', true, 'words', found.words), 'all', request, part);
  return found;
end;
$$;
revoke execute on function public.show_check_words(uuid, text) from public, anon;
grant execute on function public.show_check_words(uuid, text) to authenticated, service_role;

-- 4. Take it back ---------------------------------------------------------------------------------------------------------

-- check.takeBackWords: the GM takes a reveal back. Refused (42501) for anyone but the campaign's GM. One already taken
-- back is given back as it is, with no second line. The row stays; the hit can be shown again with a new reveal.
create function public.take_back_check_words(reveal uuid) returns public.check_reveals
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  tag jsonb := private.request_tag();
  request uuid;
  part integer;
  found public.check_reveals;
begin
  select * into found from public.check_reveals r where r.id = take_back_check_words.reveal for update;
  if who is null or found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.taken_back then
    return found;
  end if;
  update public.check_reveals r set taken_back = true, updated_at = now()
  where r.id = found.id
  returning * into found;

  begin
    request := (tag ->> 'requestId')::uuid;
    part := (tag ->> 'part')::integer;
  exception when others then
    request := null;
    part := null;
  end;
  request := coalesce(request, gen_random_uuid());

  -- The GM's line keeps the words that were taken back; the players' line says only that a reveal was taken back
  -- (the line of the showing, written before, keeps the words they were shown).
  -- Both are written as lines of their own (no `before`), so the log offers no Undo on them: showing again is the way back.
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, after, audience, request_id, request_part)
  values (found.campaign_id, 'check.takeBackWords', 'simple', who, 'check_reveals', found.id,
    jsonb_build_object('words', found.words, 'check_result_id', found.check_result_id, 'taken_back', true), 'gm', request, part);
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, after, audience, request_id, request_part)
  values (found.campaign_id, 'check.takeBackWords', 'simple', who, 'check_reveals', found.id, jsonb_build_object('shown', false), 'all', request, part);
  return found;
end;
$$;
revoke execute on function public.take_back_check_words(uuid) from public, anon;
grant execute on function public.take_back_check_words(uuid) to authenticated, service_role;

-- 5. What players read ----------------------------------------------------------------------------------------------------

-- The words of the reveals that stand in this campaign, newest first, for a member of it. Three columns and no other:
-- the reveal's own id, the words and when they were shown. Never the hit, its table, its roll or the book's row. A
-- reveal taken back is not in it; nor is one whose check result was undone (the GM's card for it is gone, so nothing
-- could take it back). Someone who is not a member gets no row.
create function public.revealed_words(campaign uuid)
returns table (id uuid, words text, shown_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.words, r.shown_at
  from public.check_reveals r
  join public.check_results c on c.id = r.check_result_id and not c.undone
  where r.campaign_id = revealed_words.campaign and not r.taken_back and private.is_member(revealed_words.campaign)
  order by r.shown_at desc, r.id;
$$;
revoke execute on function public.revealed_words(uuid) from public, anon;
grant execute on function public.revealed_words(uuid) to authenticated, service_role;

-- 6. The commands' rows ---------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('check.showWords', 'simple', true),
  ('check.takeBackWords', 'simple', true);
