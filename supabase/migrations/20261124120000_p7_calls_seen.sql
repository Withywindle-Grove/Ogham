-- P7 of docs/plans/dec-9-the-players-scene.md: the call to adventure reaching a player, its "Got it" (rulings p7-1 to
-- p7-3, docs/design/rulings/p7-call-card-2026-11-24.md; Francis, 2026-11-24, "P7 all a", with his yes said first in
-- plain words: "A player marks a call sent to them as seen. That is one mark the player writes for themselves,
-- readable only by that player and you; nothing is dropped, renamed or deleted."). Modelled on K20's finds_seen
-- (20261115003000_dec_6_k20_finds_seen.sql), but one mark a send and a player's account (p7-3), never changed.
--
-- Add-only: one new table and its own rules, one function, its log audience and its logged_commands row. No policy on
-- any existing table changes; nothing is dropped, renamed or deleted.
--   1. public.calls_seen: one row a send (public.hook_sends: a call to adventure or a given rumour) and a player's
--      account, with the time that player tapped "Got it" (the server's).
--   2. Read: that player and the campaign's GM; never another player (p7-2). Write: no one through the table (no
--      insert, update or delete grant or policy for anyone signed in); only public.mark_call_seen writes it.
--   3. public.mark_call_seen(send): a member who is not the GM, on a live send they may read under hook_sends' own read
--      rule (to the party, or to a character whose player they were when it was sent; ca-1), marks it seen at the
--      SERVER's now(). The GM is refused (03: the GM reads every mark, never writes one). A repeat changes nothing and
--      gives back the first time (04: never changed). Logged at the verbose level (the function names its own line,
--      grimoire.event_type), and not undoable (the table is not in public.undoable_tables).
--   4. The log: a mark's lines are its player's alone (the GM reads every line), even for a call to the party.

-- 1. The mark ----------------------------------------------------------------------------------------------------------

create table public.calls_seen (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  send_id uuid not null references public.hook_sends (id) on delete cascade,
  -- The player whose mark it is (their account's, on every device; p7-3).
  player_user_id uuid not null references public.profiles (id) on delete cascade,
  -- Set by the server, in mark_call_seen, never sent by a device.
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (send_id, player_user_id)
);
create index calls_seen_campaign on public.calls_seen (campaign_id, player_user_id);

-- 2. Who reads it, and that no one writes it through the table ------------------------------------------------------------

alter table public.calls_seen enable row level security;
grant select on public.calls_seen to authenticated;
grant select, insert, update, delete on public.calls_seen to service_role;

create policy "calls seen: the player and the GM read" on public.calls_seen
  for select to authenticated using (
    private.is_gm(campaign_id)
    or (player_user_id = (select auth.uid()) and private.is_member(campaign_id))
  );

create trigger refuse_when_retired before insert or update or delete on public.calls_seen
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.calls_seen
  for each row execute function private.log_change();

-- 3. Got it -------------------------------------------------------------------------------------------------------------

-- hook.seen: a player marks a call or a rumour sent to them as seen, now. Refused (42501) for the GM, for anyone not in
-- the campaign, and for a send they may not read (undone, or to a character they didn't play when it was sent). A
-- repeat changes nothing and gives back the first mark's time.
create function public.mark_call_seen("send" uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  sent public.hook_sends;
  seen timestamptz;
begin
  select * into sent from public.hook_sends s where s.id = "send";
  if who is null or sent.id is null or sent.undone or not private.is_member(sent.campaign_id)
    or private.is_gm(sent.campaign_id)
    or (sent.actor_id is not null and sent.player_user_id is distinct from who) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select c.seen_at into seen from public.calls_seen c where c.send_id = sent.id and c.player_user_id = who;
  if seen is not null then
    return seen;
  end if;
  -- The line is named by the function itself (grimoire.event_type, as mark_finds_seen's is), so it reads as hook.seen
  -- at the verbose level however the function is called, tagged by the app or not.
  perform set_config('grimoire.event_type', 'hook.seen', true);
  insert into public.calls_seen (campaign_id, send_id, player_user_id)
  values (sent.campaign_id, sent.id, who)
  on conflict (send_id, player_user_id) do nothing
  returning seen_at into seen;
  perform set_config('grimoire.event_type', '', true);
  if seen is null then
    select c.seen_at into seen from public.calls_seen c where c.send_id = sent.id and c.player_user_id = who;
  end if;
  return seen;
end;
$$;
revoke execute on function public.mark_call_seen(uuid) from public, anon;
grant execute on function public.mark_call_seen(uuid) to authenticated, service_role;

-- 4. Who reads a mark's log lines -----------------------------------------------------------------------------------------

-- The player whose mark it is (the GM reads every line). Never another player, even for a call to the party (p7-2).
create function private.log_audience_calls_seen(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  owner := (this_row ->> 'player_user_id')::uuid;
  who_sees := case when owner is null then 'gm' else 'owner' end;
end;
$$;
revoke execute on function private.log_audience_calls_seen(jsonb, jsonb) from public, anon, authenticated;

insert into public.logged_commands (name, level, gm_only) values ('hook.seen', 'verbose', false);
