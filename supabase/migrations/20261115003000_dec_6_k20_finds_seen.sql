-- K20 of docs/plans/dec-6-the-whole-pack-tab.md: "New until Got it", the seen mark (ruling pk-13, 2026-11-14, Francis:
-- "A player marks their new finds as seen. That is one mark the player writes on their own character, readable only
-- by that player and you."; narrowed by the lead to the player's own APPROVED character). Brief:
-- docs/plans/briefs/dec-6-k20-seen-mark-cloud-brief.md.
--
-- Add-only: one new table and its own rules, one function, its log audience and its logged_commands row. No policy on
-- any existing table changes; nothing is dropped, renamed or deleted.
--   1. public.finds_seen: one row per character, the time its player last marked its finds as seen.
--   2. Read: the character's player and the campaign's GM; nobody else. Write: no one through the table (no insert,
--      update or delete grant or policy for anyone signed in); only public.mark_finds_seen writes it.
--   3. public.mark_finds_seen(character): the character's own player, the character approved and in the campaign, sets
--      seen_at to the SERVER's now(). The GM is refused, even on a character they own. As public.read_messages
--      (20261102120000_m5b_g4_messages.sql): a security definer function, 42501 when it isn't theirs, logged at the
--      verbose level (the function names its own line, grimoire.event_type), and not undoable (the table is not in
--      public.undoable_tables).
--   4. The log: a mark's lines are its player's (the GM reads every line), never another player's.

-- 1. The mark ----------------------------------------------------------------------------------------------------------

create table public.finds_seen (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id uuid not null unique references public.actors (id) on delete cascade,
  -- Set by the server, in mark_finds_seen, never sent by a device.
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index finds_seen_campaign on public.finds_seen (campaign_id);

-- 2. Who reads it, and that no one writes it through the table ------------------------------------------------------------

alter table public.finds_seen enable row level security;
grant select on public.finds_seen to authenticated;
grant select, insert, update, delete on public.finds_seen to service_role;

create policy "finds seen: the character's player and the GM read" on public.finds_seen
  for select to authenticated using (
    private.is_gm(campaign_id)
    or exists (
      select 1 from public.actors a
      where a.id = actor_id and a.campaign_id = finds_seen.campaign_id
        and a.owner_type = 'user' and a.owner_user_id = (select auth.uid())
        and private.is_member(a.campaign_id)
    )
  );

create trigger refuse_when_retired before insert or update or delete on public.finds_seen
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.finds_seen
  for each row execute function private.log_change();

-- 3. Got it -------------------------------------------------------------------------------------------------------------

-- character.seenFinds: the character's own player marks its finds as seen, now. Refused (42501) for anyone else, the
-- GM included, and for a character not approved or not in play in a campaign the player is still in. A repeat moves
-- the time on; nothing else changes.
create function public.mark_finds_seen("character" uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  campaign uuid;
  seen timestamptz := now();
begin
  select a.campaign_id into campaign
  from public.actors a
  where a.id = "character" and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active'
    and a.owner_type = 'user' and a.owner_user_id = who;
  if who is null or campaign is null or not private.is_member(campaign) or private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- The line is named by the function itself (grimoire.event_type, as light.burnOut's is), so it reads as
  -- character.seenFinds at the verbose level however the function is called, tagged by the app or not.
  perform set_config('grimoire.event_type', 'character.seenFinds', true);
  insert into public.finds_seen as f (campaign_id, actor_id, seen_at)
  values (campaign, "character", seen)
  on conflict (actor_id) do update set seen_at = seen, updated_at = seen;
  perform set_config('grimoire.event_type', '', true);
  return seen;
end;
$$;
revoke execute on function public.mark_finds_seen(uuid) from public, anon;
grant execute on function public.mark_finds_seen(uuid) to authenticated, service_role;

-- 4. Who reads a mark's log lines -----------------------------------------------------------------------------------------

-- The character's player (the GM reads every line); with no player, the GM alone. Never another player.
create function private.log_audience_finds_seen(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
  carrier_owner_type text;
  carrier_owner uuid;
begin
  select a.owner_type, a.owner_user_id into carrier_owner_type, carrier_owner
  from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  if carrier_owner_type = 'user' and carrier_owner is not null then
    who_sees := 'owner';
    owner := carrier_owner;
  else
    who_sees := 'gm';
    owner := null;
  end if;
end;
$$;
revoke execute on function private.log_audience_finds_seen(jsonb, jsonb) from public, anon, authenticated;

insert into public.logged_commands (name, level, gm_only) values ('character.seenFinds', 'verbose', false);
