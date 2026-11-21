-- A given rumour is named "A rumour" (dec-12 E follow-up; rm-2, the lead's ruling under rm-1, 2026-11-14): a player
-- reads the stored name of a give (hook_sends.name), and it was the table's name ("What they say in Reedmouth"); a
-- player's card and Notes call it "A rumour", so the database stores those words and the table's name never reaches a
-- player through a give.
-- Replaces public.give_rumour from its newest definition, 20261114220000_dec_12e_rumours.sql (no later one on main or in
-- the db-session folder): only `named` changes, to the fixed words 'A rumour'; every other line is as it was, its
-- arguments, return type, revoke and grant included.
-- No read rule changes. No existing row is rewritten: gives already made keep the name they were stored with. Drops,
-- renames and deletes no data.

create or replace function public.give_rumour(campaign uuid, pack uuid, table_key text, row_min integer, row_max integer, to_actor uuid default null)
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
  named := 'A rumour';
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
