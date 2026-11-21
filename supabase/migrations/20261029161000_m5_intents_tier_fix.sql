-- M5 step 4, a fix to 20261029160000_m5_intents.sql (already on the test project, so fixed forward): the tier line
-- named its new tier in a way Postgres can't read inside the change ("missing FROM-clause entry"), so no tier line
-- was written. Replaces private.record_load_tier (same signature, same behaviour as described there). Drops nothing.

create or replace function private.record_load_tier(actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  campaign uuid;
  was text;
  new_tier text;
  who_sees text;
  owner uuid;
  line_level text;
begin
  select a.campaign_id into campaign from public.actors a where a.id = actor;
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return;
  end if;
  -- A character's first tier is what an empty pack would say; the row is locked before the tier is worked out,
  -- so a change made at the same moment on another device waits and then sees this one.
  insert into public.carrier_loads (actor_id, campaign_id, tier)
  values (actor, campaign, left(private.load_tier_words(campaign, null), 60))
  on conflict (actor_id) do nothing;
  select c.tier into was from public.carrier_loads c where c.actor_id = actor for update;
  new_tier := left(private.load_tier_words(campaign, actor), 60);
  if new_tier = '' or new_tier = was then
    return;
  end if;
  update public.carrier_loads c set tier = new_tier where c.actor_id = actor;
  select a.who_sees, a.owner into who_sees, owner
  from private.log_audience('carrier_loads', null, jsonb_build_object('actor_id', actor)) a;
  select c.level into line_level from public.logged_commands c where c.name = 'load.tier';
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, before, after, audience, owner_user_id)
  values (campaign, 'load.tier', coalesce(line_level, 'simple'), (select auth.uid()), 'carrier_loads', actor,
    jsonb_build_object('tier', was), jsonb_build_object('tier', new_tier), who_sees, owner);
end;
$$;
revoke execute on function private.record_load_tier(uuid) from public, anon, authenticated;
