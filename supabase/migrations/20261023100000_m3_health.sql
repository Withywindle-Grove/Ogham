-- M3 health fixes (docs/health/M3.md, items 1 and 4; docs/09-decisions-log.md, 2026-10-23).
-- 1. The commands the log names, and their levels, are rows in public.logged_commands instead of lists
--    inside private.log_change, so a new command is one insert, not another full copy of the function.
--    Everyone signed in may read the list (the names are in the app anyway); nobody can change it through the API.
-- 4. private.player_facing(kind): the kinds players may read, in one place for the log. The read rule and
--    import_pack keep their own copies for now; supabase/tests/m3-health.test.ts checks all of them against
--    the app's PLAYER_FACING.

create table public.logged_commands (
  name text primary key,
  level text not null default 'simple' check (level in ('simple', 'verbose')),
  gm_only boolean not null default false
);
alter table public.logged_commands enable row level security;
grant select on public.logged_commands to authenticated;
grant select, insert, update, delete on public.logged_commands to service_role;
create policy "logged commands: everyone signed in reads" on public.logged_commands
  for select to authenticated using (true);

insert into public.logged_commands (name, level, gm_only) values
  ('campaign.create', 'simple', false),
  ('campaign.update', 'simple', true),
  ('campaign.setSigil', 'simple', true),
  ('campaign.clearSigil', 'simple', true),
  ('campaign.retire', 'simple', true),
  ('campaign.restore', 'simple', true),
  ('invite.create', 'simple', true),
  ('invite.revoke', 'simple', true),
  ('invite.redeem', 'simple', false),
  ('member.setActiveCharacter', 'simple', false),
  ('company.create', 'simple', true),
  ('company.rename', 'simple', true),
  ('company.delete', 'simple', true),
  ('character.create', 'simple', false),
  ('character.edit', 'simple', false),
  ('character.review', 'simple', true),
  ('character.resubmit', 'simple', false),
  ('character.archive', 'simple', false),
  ('character.restore', 'simple', true),
  ('character.delete', 'simple', false),
  ('character.assignCompany', 'simple', true),
  ('character.setPortrait', 'simple', false),
  ('character.clearPortrait', 'simple', false),
  ('character.setHp', 'verbose', false),
  ('field.create', 'simple', true),
  ('field.update', 'simple', true),
  ('field.reorder', 'verbose', true),
  ('field.delete', 'simple', true),
  ('field.useLayout', 'simple', true),
  ('note.add', 'simple', false),
  ('note.edit', 'verbose', false),
  ('event.undo', 'simple', false),
  ('rules.attach', 'simple', true),
  ('rules.setOptions', 'simple', true),
  ('rules.detach', 'simple', true),
  ('rules.reorder', 'simple', true),
  ('rules.prefer', 'simple', true),
  ('rules.homebrew', 'simple', true),
  ('homebrew.save', 'simple', true),
  ('homebrew.delete', 'simple', true),
  ('library.delete', 'simple', false);

create function private.player_facing(kind text) returns boolean
language sql immutable set search_path = '' as $$
  select kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option');
$$;
grant execute on function private.player_facing(text) to authenticated, service_role;

-- The log: as in 20261022200000_m3_cleanup.sql, reading the command list from public.logged_commands.
create or replace function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  this_row jsonb := coalesce(new_row, old_row);
  campaign uuid;
  before_values jsonb := old_row;
  after_values jsonb := new_row;
  key text;
  tag jsonb;
  event_type text;
  event_level text;
  command_gm_only boolean;
  is_fiat boolean := false;
  why text;
  request uuid;
  who_sees text := 'all';
  owner uuid;
  reverting uuid := nullif(current_setting('grimoire.reverting', true), '')::uuid;
begin
  -- Which campaign it belongs to.
  if tg_table_name = 'campaigns' then
    campaign := (this_row ->> 'id')::uuid;
  elsif tg_table_name = 'actor_secrets' then
    select a.campaign_id into campaign from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  elsif tg_table_name in ('library_entries', 'library_entry_secrets') then
    -- Only a campaign's own homebrew is logged (in that campaign); library packs belong to no campaign.
    select p.campaign_id into campaign from public.packs p where p.id = (this_row ->> 'pack_id')::uuid;
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  -- A campaign being deleted takes its events with it; don't log the rows that go with it.
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return null;
  end if;

  -- For a change, keep only the values that changed; a change that changes nothing isn't logged.
  if tg_op = 'UPDATE' then
    before_values := '{}'::jsonb;
    after_values := '{}'::jsonb;
    for key in select jsonb_object_keys(new_row) loop
      if key <> 'updated_at' and (old_row -> key) is distinct from (new_row -> key) then
        before_values := before_values || jsonb_build_object(key, old_row -> key);
        after_values := after_values || jsonb_build_object(key, new_row -> key);
      end if;
    end loop;
    if after_values = '{}'::jsonb then
      return null;
    end if;
  end if;

  -- Who may see it: like the rows themselves.
  if tg_table_name = 'notes' then
    -- A note carries its own audience (copied from the entry it was added to).
    who_sees := this_row ->> 'audience';
    owner := (this_row ->> 'owner_user_id')::uuid;
  elsif tg_table_name in ('invites', 'actor_secrets', 'campaign_pack_secrets', 'library_entry_secrets') then
    who_sees := 'gm';
  elsif tg_table_name = 'library_entries'
    and not private.player_facing(this_row ->> 'kind') then
    -- Like reading the entries: stat blocks, tables, treasure and the rest are the GM's.
    who_sees := 'gm';
  elsif tg_table_name = 'assets' and this_row ->> 'kind' not in ('portrait', 'sigil') then
    who_sees := 'gm';
  elsif tg_table_name = 'actors'
    and coalesce(new_row ->> 'approval', '') <> 'approved'
    and coalesce(old_row ->> 'approval', '') <> 'approved' then
    if this_row ->> 'owner_type' = 'user' then
      who_sees := 'owner';
      owner := (this_row ->> 'owner_user_id')::uuid;
    else
      who_sees := 'gm';
    end if;
  end if;

  -- The command's tag, if the request has one. A broken tag just means a plain name.
  begin
    tag := convert_from(
      decode(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-grimoire-command', 'base64'),
      'UTF8'
    )::jsonb;
    request := (tag ->> 'requestId')::uuid;
  exception when others then
    tag := null;
    request := null;
  end;
  -- The database names the entry: only the commands in public.logged_commands count (GM-only ones only for
  -- the GM), at the log level listed there. Anything else gets a plain name like "actors.update".
  event_type := tag ->> 'type';
  select c.level, c.gm_only into event_level, command_gm_only from public.logged_commands c where c.name = event_type;
  if event_level is null
    or (command_gm_only and not private.is_gm(campaign))
    -- Setting rules leaving the campaign because their owner deleted them: nothing else carries that name.
    or (event_type = 'library.delete' and not (tg_table_name = 'campaign_packs' and tg_op = 'DELETE')) then
    event_type := tg_table_name || '.' || lower(tg_op);
    event_level := 'verbose';
  end if;
  -- Only the GM's changes can be fiat; a player's claim is ignored.
  if coalesce(tag ->> 'fiat', 'false') = 'true' and private.is_gm(campaign) then
    is_fiat := true;
    why := nullif(left(trim(tag ->> 'reason'), 500), '');
  end if;

  -- An undo (undo_request) links to the event it reverses, at that event's log level.
  if reverting is not null then
    select e.level into event_level from public.events e where e.id = reverting;
  end if;

  insert into public.events (
    campaign_id, type, level, actor_user_id, target_table, target_id, before, after,
    fiat, reason, audience, owner_user_id, request_id, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, request, reverting
  );
  return null;
end;
$$;
