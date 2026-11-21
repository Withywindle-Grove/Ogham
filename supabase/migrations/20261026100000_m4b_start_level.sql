-- M4b gate (B21, ruled 2026-10-25): "New characters start at" gains a fixed level the GM sets
-- (settings.startLevelFixed), and "GM's choice" becomes "Player proposes, GM approves" (settings value 'propose';
-- the old 'gm' still reads the same). Replaces two functions. Drops nothing.

-- The level a player's new character may start at: 1, the party's lowest, the fixed level, or no limit when the
-- player proposes one (the GM approves).
create or replace function private.start_level_limit(campaign uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case coalesce((select c.settings ->> 'startLevel' from public.campaigns c where c.id = campaign), 'propose')
    when 'one' then 1
    when 'lowest' then private.party_lowest(campaign)
    when 'fixed' then greatest(1, coalesce((select (c.settings ->> 'startLevelFixed')::integer from public.campaigns c
      where c.id = campaign and jsonb_typeof(c.settings -> 'startLevelFixed') = 'number'), 1))
    else null
  end;
$$;
revoke execute on function private.start_level_limit(uuid) from public, anon;
grant execute on function private.start_level_limit(uuid) to authenticated, service_role;

-- As in 20261025171000_m4b_new_characters_fixes.sql, with 'propose' (and the old 'gm') as the only start that
-- waits for the GM above the party's lowest.
create or replace function private.new_character_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  setting jsonb;
  limit_level integer;
  at_once boolean;
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id) or new.owner_type <> 'user' or new.kind <> 'pc' then
    return new;
  end if;
  limit_level := private.start_level_limit(new.campaign_id);
  if limit_level is not null and new.level > limit_level then
    raise exception 'New characters here start at level % or lower.', limit_level using errcode = '42501';
  end if;
  select c.settings into setting from public.campaigns c where c.id = new.campaign_id;
  at_once := setting -> 'characterApproval' = 'false'::jsonb
    and (coalesce(setting ->> 'startLevel', 'propose') not in ('propose', 'gm') or new.level <= private.party_lowest(new.campaign_id));
  if at_once then
    new.approval := 'approved';
  elsif new.approval = 'approved' then
    raise exception 'Only the GM can approve characters.' using errcode = '42501';
  end if;
  return new;
end;
$$;
