-- A rumour table's truth, the GM's alone, and giving a rolled row (December, dec-12 piece E; docs/plans/
-- dec-12-calls-to-adventure-and-notes.md; ruled mc-65 in docs/design/rulings/dec-mockup-rulings-sets3-5-2026-11-12.md and
-- tb-1 in pack-rework-rulings-2026-11-11.md; who reads a given rumour: rm-1, Francis's yes of 2026-11-14).
--   The truth: a rumours table (a library entry of kind `table` with the use `world.rumours`, or the older
--     `"kind": "rumours"`) is not a player-facing kind, so the read rule on library_entries already keeps every row of
--     it, its `truth` and `note` included, from players. Nothing here changes that rule.
--   1. hook_sends.kind: 'hook' (every send so far, and every send_hook) or 'rumour' (a row given by give_rumour), so
--      the hooks' "6 of 17 sent" and the player's card tell them apart. Its own guard trigger keeps it as written; the
--      table's other columns and its trigger functions are not touched (dec-12 D adds a column of its own after this).
--   2. give_rumour (rumour.give): the GM gives one row of a rumours table of an adventure attached to the campaign to a
--      player's character in play or to the party. It copies the row's WORDS only (its `result`, each link mark as its
--      words, rp-11) into hook_sends, named by the table's name; the row's `truth` and `note` are never read into it.
--      The row is named by its range (min and max), and kept as the send's hook_key "<table id>#<min>-<max>" (a pack
--      id has no "#", so it never meets a hook's id). A second give of the row to the same hearer is refused in words,
--      as a hook's is; a repeat of the same request changes nothing.
--      WHO READS A GIVEN ROW (rm-1): hook_sends' read rule as it stands (ca-1 to ca-3): the GM every one; a player one
--      given to the party, or to a character they played when it was given, while it stands. Undo marks it undone and
--      players no longer read it; its log lines stay (nothing is erased).
--   3. logged_commands gains rumour.give (simple, the GM's); undoable_makings gains it (Undo marks the send undone).
-- Adds one column (with a default: every existing row is a hook), one check, one trigger and its function, two
-- functions and two command rows. Replaces nothing; drops, renames and deletes no data; no existing row changes.

-- 1. The kind -------------------------------------------------------------------------------------------------------

alter table public.hook_sends add column kind text not null default 'hook' check (kind in ('hook', 'rumour'));

-- A send's kind is as it was written: nothing changes it afterwards.
create function private.hook_send_kind_kept() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'That can''t be changed.';
  end if;
  return new;
end;
$$;
revoke execute on function private.hook_send_kind_kept() from public, anon, authenticated;

create trigger hook_send_kind_kept before update on public.hook_sends
  for each row execute function private.hook_send_kind_kept();

-- 2. Giving a rumour ------------------------------------------------------------------------------------------------

-- Whether a table entry's data is a rumours table: the use `world.rumours` (`uses` as a list or one string, or the
-- older `use`), or the older `"kind": "rumours"` (07, Rumours; ruled 2026-10-29: one concept).
create function private.is_rumours_table(data jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    (jsonb_typeof(data -> 'uses') = 'array' and (data -> 'uses') ? 'world.rumours')
    or (data ->> 'uses') = 'world.rumours'
    or (data ->> 'use') = 'world.rumours'
    or (jsonb_typeof(data -> 'use') = 'array' and (data -> 'use') ? 'world.rumours')
    or (data ->> 'kind') = 'rumours',
    false);
$$;
revoke execute on function private.is_rumours_table(jsonb) from public, anon;
grant execute on function private.is_rumours_table(jsonb) to authenticated, service_role;

-- rumour.give: the GM gives the row of a rumours table whose range is row_min to row_max, to a character in play
-- (`to_actor`) or to the party (null). Only the row's words leave the GM's library.
create function public.give_rumour(campaign uuid, pack uuid, table_key text, row_min integer, row_max integer, to_actor uuid default null)
returns public.hook_sends
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('hook_sends');
  sent public.hook_sends;
  tbl public.library_entries;
  found jsonb;
  who public.actors;
  words text;
  named text;
  row_key text;
  now_seconds bigint;
begin
  if made is not null then
    select * into sent from public.hook_sends s where s.id = made;
    return sent;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select e.* into tbl from public.library_entries e
  join public.packs p on p.id = e.pack_id
  where e.pack_id = give_rumour.pack and e.pack_entry_id = give_rumour.table_key and e.kind = 'table'
    and p.kind = 'adventure' and private.is_rumours_table(e.data)
    and exists (select 1 from public.campaign_packs cp where cp.campaign_id = give_rumour.campaign and cp.pack_id = e.pack_id);
  if tbl.id is null then
    raise exception 'That table of rumours isn''t in an adventure this campaign uses.';
  end if;
  -- The row by its range. Only its words are read: `truth` and `note` never are.
  select r into found
  from jsonb_array_elements(case when jsonb_typeof(tbl.data -> 'rows') = 'array' then tbl.data -> 'rows' else '[]'::jsonb end) r
  where jsonb_typeof(r) = 'object' and (r -> 'min') = to_jsonb(give_rumour.row_min) and (r -> 'max') = to_jsonb(give_rumour.row_max)
  limit 1;
  if found is null then
    raise exception 'That rumour isn''t in its table any more.';
  end if;
  words := trim(private.plain_link_text(coalesce(
    case when jsonb_typeof(found -> 'result') = 'string' then found ->> 'result' end,
    case when jsonb_typeof(found -> 'value') = 'string' then found ->> 'value' end,
    '')));
  if length(words) = 0 then
    raise exception 'This rumour has no words the players can read. It needs fixing in its pack.';
  end if;
  if length(words) > 4000 then
    raise exception 'The words are at most 4000 characters.';
  end if;
  named := left(trim(private.plain_link_text(coalesce(tbl.name, ''))), 200);
  if length(named) = 0 then
    named := 'A rumour';
  end if;
  row_key := give_rumour.table_key || '#' || give_rumour.row_min || '-' || give_rumour.row_max;
  if length(row_key) > 200 then
    raise exception 'That table of rumours isn''t in an adventure this campaign uses.';
  end if;
  if to_actor is not null then
    select * into who from public.actors a where a.id = to_actor and a.campaign_id = give_rumour.campaign;
    if who.id is null or who.kind <> 'pc' or who.approval <> 'approved' or who.status <> 'active'
      or who.owner_type <> 'user' or who.owner_user_id is null then
      raise exception 'Send it to a player''s character in play, or to the party.';
    end if;
  end if;
  if exists (
    select 1 from public.hook_sends s
    where s.campaign_id = give_rumour.campaign and s.pack_id = give_rumour.pack and s.hook_key = row_key
      and s.actor_id is not distinct from to_actor and not s.undone
  ) then
    raise exception 'It wasn''t sent again: % already has it. Nothing changed.',
      case when to_actor is null then 'the party' else who.name end;
  end if;
  select c.seconds into now_seconds from public.campaign_clocks c where c.campaign_id = give_rumour.campaign;
  begin
    insert into public.hook_sends (campaign_id, pack_id, hook_key, actor_id, player_user_id, name, body, pays, clock_seconds, kind)
    values (give_rumour.campaign, give_rumour.pack, row_key, to_actor, who.owner_user_id, named, words, '', coalesce(now_seconds, 0), 'rumour')
    returning * into sent;
  exception when unique_violation then
    -- Two gives of the row to one hearer in the same moment: the same words as the check above.
    raise exception 'It wasn''t sent again: % already has it. Nothing changed.', case when to_actor is null then 'the party' else who.name end;
  end;
  return sent;
end;
$$;
revoke execute on function public.give_rumour(uuid, uuid, text, integer, integer, uuid) from public, anon;
grant execute on function public.give_rumour(uuid, uuid, text, integer, integer, uuid) to authenticated, service_role;

-- 3. Logged-command rows and undo -----------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('rumour.give', 'simple', true);
-- Giving makes a row: Undo marks it undone.
insert into public.undoable_makings (name) values ('rumour.give');
