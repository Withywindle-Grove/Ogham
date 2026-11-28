-- dec5-gaps piece E (#189; G-228, rulings dg-11, dg-12, dg-16; dgb-1, Francis: B1 = A, function-only): a send can come
-- from a person. The GM's send (find.give) also takes a held thing's key beside today's hoard row keys:
-- "held:<the person's pack id>:<the item's id>" (the person as the piece names her, "NPC: <id>"; the item's bare id, as
-- a shop's itemRef is read). Pack ids, not row ids: they survive a pack updated, or deleted and imported again, so what
-- she gave stays given (dg-12, "wherever they next appear"). The key goes where a hoard row's key goes: on the send's
-- one GM-only line (`rows`), beside the place (rp-4). The party's lines are unchanged, naming neither the person nor
-- the key. The send's Undo (public.undo_find) is unchanged and is Take it back.
--
-- Replaces public.give_find only (its one definition, in 20261115090000_dec_6_k16b_send_find.sql), copied whole with one
-- change: the rows' shape check takes the held key too. Same arguments, so its grants stay. The server checks the
-- key's shape only, never the person or the item (as it never checks a row against the place's treasure: the GM may
-- give anything). No table, column, read rule or stored row changes; nothing is dropped or renamed.
-- builds on: public.give_find from 20261115090000_dec_6_k16b_send_find.sql

-- find.give: the GM sends things and coin, to a character (to_actor) or, with no character, to the party stash. `things`
-- is a list of at most 100: { "libraryEntryId": <an item of the campaign's setting rules>, "qty" } or a one-off
-- { "name", "qty" }; `coins` a map of the setting's coins to whole numbers of 0 or more (0 leaves that coin out); `rows`
-- the hoard rows sent (at most 25), or a held thing's key ("held:<person id>:<item id>", each id 1 to 80 of a pack id's
-- characters). Returns the send's first log line, for the GM's Undo. The same request sent again
-- changes nothing and answers the same line.
create or replace function public.give_find(campaign uuid, to_actor uuid, place uuid, things jsonb, coins jsonb, rows jsonb default '[]'::jsonb)
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
    or exists (select 1 from jsonb_array_elements(rows) r where jsonb_typeof(r.value) <> 'string' or (r.value #>> '{}') !~ '^(\d{1,4}:(thing|coin)|held:[a-z0-9][a-z0-9_.-]{0,79}:[a-z0-9][a-z0-9_.-]{0,79})$') then
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
