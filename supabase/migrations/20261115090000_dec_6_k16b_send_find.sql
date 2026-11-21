-- K16b of docs/plans/dec-6-the-whole-pack-tab.md: the GM sends a find (ruling pk-12, 2026-11-14, Francis: "When you send
-- a find from a hoard, one action adds the things and the coin together, and your Undo takes both back in one step";
-- pk-1: to a character or to the party stash; pk-2: it lands loose in what the character carries). Brief:
-- docs/plans/briefs/dec-6-k16b-send-find-cloud-brief.md; the lead's answer on #828 (option b, a dedicated Undo).
--
-- Add-only: three new functions (one a helper) and two logged_commands rows. No read rule, policy or table changes; no
-- existing function is replaced (private.coin_action_lines and private.undo_as_gm stay as they are: the generic Undo
-- keeps refusing a find, and the find's own Undo below doesn't go through them). Nothing is dropped, renamed or deleted.
--   1. private.campaign_coin_keys(campaign): the setting's coins, as the app reads them (denominationsOf): the
--      `currency` keys of the top rules set that names any, each with a whole valueInBase of 1 or more.
--   2. public.give_find (find.give, GM only): in ONE request, the things as new lines on the target's carrier (a
--      character's, or the party stash's), how_got "found", and the coin into the target's purse. Every line of the
--      request is named find.give, ids only, never a name or an amount (K28's shape). Hidden means hidden (rp-4; the
--      lead on #828): the lines the party reads (the things', the purse's) carry {"find": {"to", "coin"?}} only, never
--      the place or the hoard's rows; one GM-only line of the same request (audience 'gm', written directly as
--      public.note_rule_skipped writes its line) carries {"find": {"to", "placeId", "coin"?, "rows"?}} and, in its
--      `after`, the items the send taught the party ({"learned": [...]}, for the Undo). `rows` is the hoard rows sent
--      ("<entry>:thing" or "<entry>:coin", K16a's rows), so "Sent to <Name>" is read from the GM's log.
--      The purse's line keeps the purse's own readers (private.log_audience for purses: pu-9, rule 5): only they read
--      the amount; everyone else reads "coin" from the reason. The things' lines are the party's, as today.
--      The server checks the shape (whole amounts of 0 or more, the setting's coins, a thing's count and words), never
--      the rows against the place's treasure: the GM may give anything.
--   3. public.undo_find (find.undo, GM only): the GM's Undo of the GM's own send, whole. Every line the send made must
--      be untouched since (no later change to it, nothing put inside it) and the coin it added still in the purse;
--      the send's lines are locked first, so it runs once only; otherwise "That's changed
--      since. Undo the later change first." with nothing changed. Then, in one request, the lines come out and the coin
--      goes back, each change a reversal of the send's line it undoes. The lines are deleted under hard rule 4's
--      exception of 2026-11-03 ("undoing an action that created an item removes that item while nobody has touched
--      it"; docs/design/rulings/m5b-3-yield-undo-2026-11-03.md; confirmed for a find by the lead, 2026-11-14): the log
--      keeps each line's whole copy. A player can't call it, and the generic Undo (public.undo_request) still refuses a
--      find ("Making or deleting things can't be undone."), so a player's Undo of a send stays refused.
--      And the knowledge that came with it: an item the send taught the party (known_items) is unknown again once no
--      line the party holds has one (private.held_by_party: a player's or the party's approved character, or the
--      Party stash; an NPC's or a GM-owned hireling's copy doesn't count, as it never taught the party); hard rule 4's exception of 2026-11-03, extended to that knowledge by Francis
--      (uf-2, 2026-11-14: "Yes"). The log keeps the row's copy on a GM-only reversal line.
--   4. The two commands' rows in public.logged_commands.
-- Who may read what is unchanged (the new GM-only line is read by the GM alone, by the events table's existing rule).

-- 1. The setting's coins ------------------------------------------------------------------------------------------------

create function private.campaign_coin_keys(campaign uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  sets jsonb := private.campaign_rules_sets(campaign);
  i integer;
  keys text[];
begin
  -- The top rules set last (as private.down_at reads them): the first from the top that names a coin wins.
  for i in reverse jsonb_array_length(sets) - 1 .. 0 loop
    select coalesce(array_agg(distinct c.value ->> 'key'), '{}') into keys
    from jsonb_array_elements(case when jsonb_typeof(sets -> i -> 'currency') = 'array' then sets -> i -> 'currency' else '[]'::jsonb end) c
    where jsonb_typeof(c.value) = 'object'
      and jsonb_typeof(c.value -> 'key') = 'string' and length(c.value ->> 'key') between 1 and 40
      and c.value ->> 'key' = btrim(c.value ->> 'key')
      and jsonb_typeof(c.value -> 'valueInBase') = 'number' and (c.value ->> 'valueInBase') ~ '^[1-9][0-9]{0,8}$';
    if cardinality(keys) > 0 then
      return keys;
    end if;
  end loop;
  return '{}';
end;
$$;
revoke execute on function private.campaign_coin_keys(uuid) from public, anon, authenticated;

-- 2. The send ---------------------------------------------------------------------------------------------------------------

-- find.give: the GM sends things and coin, to a character (to_actor) or, with no character, to the party stash. `things`
-- is a list of at most 100: { "libraryEntryId": <an item of the campaign's setting rules>, "qty" } or a one-off
-- { "name", "qty" }; `coins` a map of the setting's coins to whole numbers of 0 or more (0 leaves that coin out); `rows`
-- the hoard rows sent (at most 25). Returns the send's first log line, for the GM's Undo. The same request sent again
-- changes nothing and answers the same line.
create function public.give_find(campaign uuid, to_actor uuid, place uuid, things jsonb, coins jsonb, rows jsonb default '[]'::jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  stash uuid;
  coin_keys text[];
  wanted jsonb := '{}'::jsonb;
  coin record;
  thing jsonb;
  amount text;
  entry uuid;
  what text;
  request uuid;
  first_event uuid;
  reason jsonb;
  gm_reason jsonb;
  target public.purses;
  made uuid[] := '{}';
  made_one uuid;
  known_before text[];
  learned text[];
begin
  if who is null or campaign is null or not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- Where it goes: an approved character or hireling of this campaign, or its party stash.
  if to_actor is not null then
    if not exists (
      select 1 from public.actors a
      where a.id = to_actor and a.campaign_id = campaign and a.kind in ('pc', 'hireling') and a.approval = 'approved'
    ) then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  else
    select l.id into stash from public.locations l where l.campaign_id = campaign and l.kind = 'stash';
    if stash is null then
      raise exception 'This campaign has no party stash.' using errcode = '22023';
    end if;
  end if;
  if place is null or not exists (select 1 from public.places p where p.id = place and p.campaign_id = campaign and not p.undone) then
    raise exception 'That place isn''t in this campaign.' using errcode = '22023';
  end if;

  -- The shape, all of it before anything is written.
  things := coalesce(things, '[]'::jsonb);
  rows := coalesce(rows, '[]'::jsonb);
  if jsonb_typeof(things) <> 'array' or jsonb_array_length(things) > 100 then
    raise exception 'Send at most 100 things, as a list.' using errcode = '22023';
  end if;
  if coins is not null and jsonb_typeof(coins) <> 'object' then
    raise exception 'Say the coin as whole numbers, 0 or more.' using errcode = '22023';
  end if;
  coin_keys := private.campaign_coin_keys(campaign);
  for coin in select c.key, c.value from jsonb_each(coalesce(coins, '{}'::jsonb)) c loop
    if not (coin.key = any (coin_keys)) then
      raise exception '% isn''t a coin of this setting.', coin.key using errcode = '22023';
    end if;
    if jsonb_typeof(coin.value) <> 'number' or (coin.value #>> '{}') !~ '^\d{1,9}$' then
      raise exception 'Say how many: a whole number, 0 or more.' using errcode = '22023';
    end if;
    if (coin.value #>> '{}')::bigint > 0 then
      wanted := wanted || jsonb_build_object(coin.key, (coin.value #>> '{}')::bigint);
    end if;
  end loop;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 25
    or exists (select 1 from jsonb_array_elements(rows) r where jsonb_typeof(r.value) <> 'string' or (r.value #>> '{}') !~ '^\d{1,4}:(thing|coin)$') then
    raise exception 'Send at most 25 rows of a hoard at once.' using errcode = '22023';
  end if;
  for thing in select t.value from jsonb_array_elements(things) t loop
    amount := case when jsonb_typeof(thing) = 'object' and jsonb_typeof(thing -> 'qty') = 'number' then thing ->> 'qty' end;
    if amount is null or amount !~ '^\d{1,6}$' or amount::integer < 1 or amount::integer > 100000 then
      raise exception 'How many must be a whole number, 1 or more.' using errcode = '22023';
    end if;
    if jsonb_typeof(thing -> 'libraryEntryId') = 'string' then
      -- An item of the setting rules this campaign uses (inventory_lines.library_entry_id has no foreign key, and a
      -- line naming an entry that isn't there would keep no item's words): checked here, before anything is written.
      if (thing ->> 'libraryEntryId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        or not exists (
          select 1 from public.library_entries e join public.campaign_packs cp on cp.pack_id = e.pack_id
          where e.id = (thing ->> 'libraryEntryId')::uuid and e.kind = 'item' and cp.campaign_id = campaign
        ) then
        raise exception 'That item isn''t in this campaign''s setting rules.' using errcode = '22023';
      end if;
    elsif jsonb_typeof(thing -> 'name') <> 'string' or length(btrim(thing ->> 'name')) not between 1 and 200 then
      raise exception 'A thing needs its words or its item.' using errcode = '22023';
    end if;
  end loop;
  if jsonb_array_length(things) = 0 and wanted = '{}'::jsonb then
    raise exception 'Choose something to send.' using errcode = '22023';
  end if;

  -- The request's own name and id (as every purse function), then its one reason.
  perform private.begin_coin_action('find.give');
  request := (private.request_tag() ->> 'requestId')::uuid;
  select e.id into first_event from public.events e
  where e.campaign_id = campaign and e.request_id = request and e.type = 'find.give' and e.actor_user_id = who
  order by e.seq limit 1;
  if first_event is not null then
    perform private.end_coin_action();
    return first_event;
  end if;
  -- Hidden means hidden (rp-4; the lead, 2026-11-14, on #828): the lines the party reads (the things', and the purse's)
  -- carry who it went to and whether coin went, never the place or the hoard's rows, which may name or count something
  -- a player was never shown. Where it was found and which rows went are on one GM-only line of the same request.
  reason := jsonb_build_object('find',
    jsonb_build_object('to', to_actor)
    || case when wanted <> '{}'::jsonb then jsonb_build_object('coin', true) else '{}'::jsonb end);
  gm_reason := jsonb_build_object('find',
    jsonb_build_object('to', to_actor, 'placeId', place)
    || case when wanted <> '{}'::jsonb then jsonb_build_object('coin', true) else '{}'::jsonb end
    || case when jsonb_array_length(rows) > 0 then jsonb_build_object('rows', rows) else '{}'::jsonb end);
  -- private.log_change keeps at most 500 characters of a reason: a cut one wouldn't read, so it is refused instead.
  if length(gm_reason::text) > 500 then
    raise exception 'Send at most 25 rows of a hoard at once.' using errcode = '22023';
  end if;
  perform set_config('grimoire.event_reason', reason::text, true);

  -- The things: new lines, loose (pk-2), found. A line from the setting rules is filled from its entry by
  -- private.copy_item_details, which also refuses an item that isn't in the campaign's setting rules.
  -- What the party knew before (private.learn_item adds an item the party holds to known_items as each line lands).
  known_before := array(select k.item_id from public.known_items k where k.campaign_id = campaign);
  for thing in select t.value from jsonb_array_elements(things) t loop
    entry := case when jsonb_typeof(thing -> 'libraryEntryId') = 'string' then (thing ->> 'libraryEntryId')::uuid end;
    what := case when entry is null then btrim(thing ->> 'name') else 'Item' end;
    insert into public.inventory_lines (campaign_id, actor_id, location_id, library_entry_id, name, qty, how_got, item_data)
    values (campaign, to_actor, stash, entry, what, (thing ->> 'qty')::integer, 'found', '{}'::jsonb)
    returning id into made_one;
    made := made || made_one;
  end loop;
  -- The items this send taught the party (known now, not before, and held by a line it made): kept on the GM's line
  -- below, so the Undo knows which knowledge came with the find and never has to guess (uf-2).
  learned := array(
    select distinct l.source_entry_id from public.inventory_lines l
    where l.id = any (made) and l.source_entry_id is not null and not (l.source_entry_id = any (known_before))
      and exists (select 1 from public.known_items k where k.campaign_id = campaign and k.item_id = l.source_entry_id)
  );
  -- The coin: into the target's purse, its line read only by the purse's readers.
  if wanted <> '{}'::jsonb then
    target := private.purse_of(campaign, to_actor, stash);
    if target.id is null then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    perform private.lock_purses(array[target.id]);
    perform private.change_purse(private.purse_now(target.id), wanted, 1);
  end if;
  -- The GM's line: the place and the rows, read by the GM alone (audience 'gm', as public.note_rule_skipped writes
  -- its line), in the same request so the log reads it with the send.
  -- Its `after` keeps the items the send taught the party ({"learned": [<item id>, …]}).
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, after, reason, audience, request_id, request_part)
  values (campaign, 'find.give', 'simple', who, 'places', place, jsonb_build_object('learned', to_jsonb(learned)), gm_reason::text, 'gm',
    request, (private.request_tag() ->> 'part')::integer);

  select e.id into first_event from public.events e
  where e.campaign_id = campaign and e.request_id = request and e.type = 'find.give'
  order by e.seq limit 1;
  perform private.end_coin_action();
  return first_event;
end;
$$;
revoke execute on function public.give_find(uuid, uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.give_find(uuid, uuid, uuid, jsonb, jsonb, jsonb) to authenticated, service_role;

-- 3. The GM's Undo of a send ----------------------------------------------------------------------------------------------------

-- find.undo: `event_id` is any line of the send. Checks everything first, then writes.
create function public.undo_find(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  picked public.events;
  change public.events;
  coin_line public.events;
  line public.inventory_lines;
  p public.purses;
  added jsonb := '{}'::jsonb;
  gm_line public.events;
  item text;
  known public.known_items;
begin
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null or not private.is_gm(picked.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if picked.type <> 'find.give' or picked.request_id is null or picked.reverts_event_id is not null then
    raise exception 'That can''t be undone.';
  end if;
  perform private.begin_coin_action('find.undo');
  -- Once only: the send's lines are locked first, so a second Undo (a double tap, another device) waits for this one
  -- and then finds it already undone (a coin-only send has no inventory line to lock).
  perform 1 from public.events e where e.campaign_id = picked.campaign_id and e.request_id = picked.request_id order by e.seq for update;
  if exists (
    select 1 from public.events r join public.events e on e.id = r.reverts_event_id
    where e.campaign_id = picked.campaign_id and e.request_id = picked.request_id
  ) then
    raise exception 'That was already undone.';
  end if;

  -- Each line the send made: still there, and nothing changed it since.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id and e.request_id = picked.request_id and e.type = 'find.give'
      and e.target_table = 'inventory_lines' and e.before is null
    order by e.seq
  loop
    select * into line from public.inventory_lines l where l.id = change.target_id for update;
    if line.id is null
      -- A line put inside a found bag since: the players' own things never fall out of a bag being taken back.
      or exists (select 1 from public.inventory_lines c where c.container_line_id = change.target_id)
      or exists (
      -- A change to the line or to its secret part (a charge, a reveal: inventory_line_secrets shares the line's id).
      select 1 from public.events later
      where later.campaign_id = picked.campaign_id and later.target_table in ('inventory_lines', 'inventory_line_secrets')
        and later.target_id = change.target_id and later.seq > change.seq
        and later.request_id is distinct from picked.request_id
    ) then
      raise exception 'That''s changed since. Undo the later change first.';
    end if;
  end loop;
  -- The coin it added: still in the purse.
  select * into coin_line from public.events e
  where e.campaign_id = picked.campaign_id and e.request_id = picked.request_id and e.type = 'find.give' and e.target_table = 'purses'
  order by e.seq limit 1;
  if coin_line.id is not null then
    select coalesce(jsonb_object_agg(k.key, k.n), '{}'::jsonb) into added
    from (
      select keys.key, coalesce((coin_line.after -> 'coins' ->> keys.key)::bigint, 0) - coalesce((coin_line.before -> 'coins' ->> keys.key)::bigint, 0) as n
      from (
        select jsonb_object_keys(case when jsonb_typeof(coin_line.after -> 'coins') = 'object' then coin_line.after -> 'coins' else '{}'::jsonb end) as key
        union
        select jsonb_object_keys(case when jsonb_typeof(coin_line.before -> 'coins') = 'object' then coin_line.before -> 'coins' else '{}'::jsonb end)
      ) keys
    ) k
    where k.n > 0;
    perform private.lock_purses(array[coin_line.target_id]);
    p := private.purse_now(coin_line.target_id);
    if p.id is null or exists (select 1 from jsonb_each(added) c where coalesce((p.coins ->> c.key)::bigint, 0) < (c.value #>> '{}')::bigint) then
      raise exception 'That''s changed since. Undo the later change first.';
    end if;
  end if;

  -- Then write: the lines out (the log keeps each whole copy), the coin back; each a reversal of the line it undoes.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id and e.request_id = picked.request_id and e.type = 'find.give'
      and e.target_table = 'inventory_lines' and e.before is null
    order by e.seq
  loop
    perform set_config('grimoire.reverting', change.id::text, true);
    delete from public.inventory_lines l where l.id = change.target_id;
  end loop;
  if coin_line.id is not null and added <> '{}'::jsonb then
    perform set_config('grimoire.reverting', coin_line.id::text, true);
    perform private.change_purse(p, added, -1);
  end if;
  perform set_config('grimoire.reverting', '', true);
  -- The knowledge that came with the find (uf-2, Francis, 2026-11-14: "Yes"): an item the send taught the party (its
  -- GM line's `learned`) is no longer known once no line the party holds has one (the lead's reading of the yes:
  -- "nobody else" is nobody in the party; private.held_by_party(actor uuid, place uuid), defined in
  -- 20261028100000_m4b_known_items.sql and never redefined, the same test learn_item uses). known_items has no log of its own,
  -- so its removal is written here as the GM's reversal of the send's GM line, keeping the row's whole copy.
  select * into gm_line from public.events e
  where e.campaign_id = picked.campaign_id and e.request_id = picked.request_id and e.type = 'find.give' and e.audience = 'gm'
    and e.target_table = 'places'
  order by e.seq limit 1;
  if gm_line.id is not null and jsonb_typeof(gm_line.after -> 'learned') = 'array' then
    for item in select jsonb_array_elements_text(gm_line.after -> 'learned') loop
      if not exists (
        select 1 from public.inventory_lines l
        where l.campaign_id = picked.campaign_id and l.source_entry_id = item and private.held_by_party(l.actor_id, l.location_id)
      ) then
        delete from public.known_items k where k.campaign_id = picked.campaign_id and k.item_id = item returning * into known;
        if known.item_id is not null then
          insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, before, audience, request_id, request_part, reverts_event_id)
          values (picked.campaign_id, 'find.undo', 'simple', (select auth.uid()), 'known_items', null, to_jsonb(known), 'gm',
            (private.request_tag() ->> 'requestId')::uuid, (private.request_tag() ->> 'part')::integer, gm_line.id);
        end if;
        known := null;
      end if;
    end loop;
  end if;
  perform private.end_coin_action();
end;
$$;
revoke execute on function public.undo_find(uuid) from public, anon;
grant execute on function public.undo_find(uuid) to authenticated, service_role;

-- 4. The commands' rows ---------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('find.give', 'simple', true),
  ('find.undo', 'simple', true);
