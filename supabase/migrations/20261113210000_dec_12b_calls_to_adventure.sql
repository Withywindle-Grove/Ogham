-- Calls to adventure for the GM (December, dec-12 piece B; docs/plans/dec-12-calls-to-adventure-and-notes.md; ruled
-- mc-61 to mc-64 in docs/design/rulings/dec-mockup-rulings-sets3-5-2026-11-12.md, pf-7 and pf-7a in
-- dec-pack-formats-2026-11-11.md). An adventure pack's hooks are kept, the GM's alone, and the GM sends one to a
-- character or to the party.
--   1. adventureHook: one more kind of library entry, the GM's (an adventure's hook: its name, its words, what it
--      pays, who gives it). Not player-facing: private.player_facing is not touched, so the read rule on
--      library_entries keeps every hook from players, and import_pack's "what changed" line counts them as the GM's.
--      Replaces one check constraint (newest in 20261111140000_dec_4a_route_kind.sql), adding one kind.
--   2. hook_sends: one row per send of a hook: the campaign, the pack and the hook's id in it, who hears it (a
--      character, or the party: no character), that character's player when it was sent, the hook's name, the words
--      and the pays as sent (the GM may change them for this send; the pack never changes), and the campaign clock
--      at the send. Never deleted; Undo marks it undone. The name, words and pays are kept with every link mark
--      `[[kind:id|label]]` turned into its words (rp-11: a player never gets a link's code); this needs
--      private.plain_link_text from 20261113200000_players_never_get_link_ids.sql.
--      WHO MAY READ IT (a new read rule): the GM reads every send. A player reads a send to the party, and a send to
--      a character whose player they were when it was sent; never an undone one. No one else. A hook's words reach a
--      player only here, once sent (hard rule 5); an unsent hook stays in library_entries, which players never read.
--   3. send_hook (hook.send): the GM, on a hook of an adventure attached to the campaign, to a character in play or
--      to the party. A second send of the same hook to the same hearer is refused in words; a repeat of the same
--      request changes nothing.
--   4. The log: a send's lines are the party's (everyone in the campaign) or the character's player's (and the
--      GM's). logged_commands gains hook.send; undoable_makings gains it too (Undo marks the send undone), and
--      undoable_tables gains hook_sends.
-- Adds one table with its rules, triggers and policies, one function and rows in the app's command lists; replaces
-- one check constraint (adding a kind). Drops, renames and deletes no data; no rows are written to existing tables
-- other than the command lists.

-- 1. The kind -------------------------------------------------------------------------------------------------------

alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList',
  'gmReferencePanel', 'location', 'patch', 'patron', 'route', 'adventureHook'
));

-- 2. The sends ------------------------------------------------------------------------------------------------------

create table public.hook_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The pack and the hook's own id in it (kept across pack updates; no foreign key, like a place's pack link).
  pack_id uuid not null,
  hook_key text not null check (length(hook_key) between 1 and 200),
  -- Who hears it: a character, or the party (null).
  actor_id uuid references public.actors (id) on delete cascade,
  -- That character's player when it was sent (who reads it, with the GM); null for the party.
  player_user_id uuid references public.profiles (id) on delete set null,
  name text not null check (length(name) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 4000),
  pays text not null default '' check (length(pays) <= 500),
  -- The campaign clock at the send (its day is shown: "Sent to the party, day 1").
  clock_seconds bigint not null default 0,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hook_sends_campaign on public.hook_sends (campaign_id, created_at) where not undone;
-- One live send of a hook to each hearer.
create unique index hook_sends_once on public.hook_sends (campaign_id, pack_id, hook_key, coalesce(actor_id, '00000000-0000-0000-0000-000000000000'::uuid)) where not undone;

alter table public.hook_sends enable row level security;
grant select, update on public.hook_sends to authenticated;
grant select, insert, update, delete on public.hook_sends to service_role;

create policy "hook sends: the GM, the party, and the character's player" on public.hook_sends
  for select to authenticated using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and not undone
      and (actor_id is null or player_user_id = (select auth.uid()))
    )
  );
-- An undo by the GM (the log's undo runs as the person undoing and marks the row undone).
create policy "hook sends: an undo by the GM" on public.hook_sends
  for update to authenticated
  using (private.is_gm(campaign_id))
  with check (private.is_gm(campaign_id));

-- Written only by send_hook (and put back by an undo): nothing changes after the send but its undone mark.
create function private.hook_send_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.pack_id is distinct from old.pack_id
    or new.hook_key is distinct from old.hook_key or new.actor_id is distinct from old.actor_id
    or new.player_user_id is distinct from old.player_user_id or new.name is distinct from old.name
    or new.body is distinct from old.body or new.pays is distinct from old.pays
    or new.clock_seconds is distinct from old.clock_seconds or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  if not reverting and new.undone <> old.undone then
    raise exception 'That can''t be changed.';
  end if;
  return new;
end;
$$;
revoke execute on function private.hook_send_rules() from public, anon, authenticated;

-- Security invoker on purpose (as private.sheet_changes_by_functions): a direct write through the API is refused
-- unless it is an undo putting things back; send_hook runs as the database, so its insert passes.
create function private.hook_sends_by_functions() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and nullif(current_setting('grimoire.reverting', true), '') is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_copy_version before insert or update on public.hook_sends
  for each row execute function private.check_copy_version();
create trigger hook_send_rules before insert or update on public.hook_sends
  for each row execute function private.hook_send_rules();
create trigger hook_sends_by_functions before insert or update on public.hook_sends
  for each row execute function private.hook_sends_by_functions();
create trigger refuse_when_retired before insert or update or delete on public.hook_sends
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.hook_sends
  for each row execute function private.log_change();

-- A send's lines: the party's go to everyone in the campaign; a character's to its player (the GM reads every line).
create function private.log_audience_hook_sends(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  if this_row ->> 'actor_id' is null then
    who_sees := 'all';
    owner := null;
    return;
  end if;
  owner := (this_row ->> 'player_user_id')::uuid;
  who_sees := case when owner is null then 'gm' else 'owner' end;
end;
$$;
revoke execute on function private.log_audience_hook_sends(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('hook_sends');

-- 3. Sending --------------------------------------------------------------------------------------------------------

-- hook.send: the GM sends a hook of an adventure attached to the campaign, to a character in play (`to_actor`) or to
-- the party (null), with the words and pays for this send (the book's, or the GM's changes). The hook's name is read
-- here, never sent from the device.
create function public.send_hook(campaign uuid, pack uuid, hook_key text, body text, pays text, to_actor uuid default null)
returns public.hook_sends
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('hook_sends');
  sent public.hook_sends;
  hook public.library_entries;
  who public.actors;
  -- A link's code never reaches a player (rp-11): the words and pays are kept with each link mark as its words only
  -- (private.plain_link_text, 20261113200000_players_never_get_link_ids.sql), whatever the device sent.
  words text := trim(private.plain_link_text(coalesce(send_hook.body, '')));
  paid text := trim(private.plain_link_text(coalesce(send_hook.pays, '')));
  now_seconds bigint;
begin
  if made is not null then
    select * into sent from public.hook_sends s where s.id = made;
    return sent;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select e.* into hook from public.library_entries e
  where e.pack_id = send_hook.pack and e.pack_entry_id = send_hook.hook_key and e.kind = 'adventureHook'
    and exists (select 1 from public.campaign_packs cp where cp.campaign_id = send_hook.campaign and cp.pack_id = e.pack_id);
  if hook.id is null then
    raise exception 'That call to adventure isn''t in an adventure this campaign uses.';
  end if;
  if to_actor is not null then
    select * into who from public.actors a where a.id = to_actor and a.campaign_id = send_hook.campaign;
    if who.id is null or who.kind <> 'pc' or who.approval <> 'approved' or who.status <> 'active'
      or who.owner_type <> 'user' or who.owner_user_id is null then
      raise exception 'Send it to a player''s character in play, or to the party.';
    end if;
  end if;
  if length(words) = 0 then
    raise exception 'Write the words to send.';
  end if;
  if length(words) > 4000 then
    raise exception 'The words are at most 4000 characters.';
  end if;
  if length(paid) > 500 then
    raise exception 'What it pays is at most 500 characters.';
  end if;
  if exists (
    select 1 from public.hook_sends s
    where s.campaign_id = send_hook.campaign and s.pack_id = send_hook.pack and s.hook_key = send_hook.hook_key
      and s.actor_id is not distinct from to_actor and not s.undone
  ) then
    raise exception 'It wasn''t sent again: % already has it. Nothing changed.',
      case when to_actor is null then 'the party' else who.name end;
  end if;
  select c.seconds into now_seconds from public.campaign_clocks c where c.campaign_id = send_hook.campaign;
  insert into public.hook_sends (campaign_id, pack_id, hook_key, actor_id, player_user_id, name, body, pays, clock_seconds)
  values (send_hook.campaign, send_hook.pack, send_hook.hook_key, to_actor, who.owner_user_id, trim(private.plain_link_text(hook.name)), words, paid, coalesce(now_seconds, 0))
  returning * into sent;
  return sent;
end;
$$;
revoke execute on function public.send_hook(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.send_hook(uuid, uuid, text, text, text, uuid) to authenticated, service_role;

-- 4. Logged-command rows and undo -----------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('hook.send', 'simple', true);
-- Sending makes a row: Undo marks it undone.
insert into public.undoable_makings (name) values ('hook.send');
