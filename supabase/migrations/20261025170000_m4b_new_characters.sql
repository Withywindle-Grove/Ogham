-- M4b, character creation step 2: the campaign's new-character settings (docs/04 Campaign settings, docs/05
-- "Joining"; ruled 2026-10-24 and 2026-10-25). Drops nothing.
--   settings.characterApproval: true (default) | false. Off: a player's new character joins at once, except under
--     "GM's choice" when it asks for a level above the party's lowest (the GM decides that one).
--   settings.startLevel: 'gm' (default: today's behaviour) | 'one' | 'lowest'. 'one': level 1 only. 'lowest': up
--     to the party's lowest level. 'gm': any level, which the GM approves or asks to change.
--   "Party's lowest" = the lowest level among the campaign's approved, active player characters (status active);
--     retainers and hirelings don't count; 1 when there are none.
-- A player's level is checked when the character is made and whenever it changes while waiting or sent back.
-- A character approved on creation becomes its player's active one when they have none (as on approval).

create function private.party_lowest(campaign uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(min(a.level), 1) from public.actors a
  where a.campaign_id = campaign and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active';
$$;
revoke execute on function private.party_lowest(uuid) from public, anon;
grant execute on function private.party_lowest(uuid) to authenticated, service_role;

-- The highest level a player's new character may start at, or null for any (GM's choice).
create function private.start_level_limit(campaign uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case coalesce((select c.settings ->> 'startLevel' from public.campaigns c where c.id = campaign), 'gm')
    when 'one' then 1
    when 'lowest' then private.party_lowest(campaign)
    else null
  end;
$$;
revoke execute on function private.start_level_limit(uuid) from public, anon;
grant execute on function private.start_level_limit(uuid) to authenticated, service_role;

-- A player's new character: within the level limit, and approved at once when the campaign says so.
create function private.new_character_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  setting jsonb;
  limit_level integer;
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id) or new.owner_type <> 'user' or new.kind <> 'pc' then
    return new;
  end if;
  limit_level := private.start_level_limit(new.campaign_id);
  if limit_level is not null and new.level > limit_level then
    raise exception 'New characters here start at level % or lower.', limit_level using errcode = '42501';
  end if;
  select c.settings into setting from public.campaigns c where c.id = new.campaign_id;
  new.approval := case
    when setting -> 'characterApproval' = 'false'::jsonb
      and (coalesce(setting ->> 'startLevel', 'gm') <> 'gm' or new.level <= private.party_lowest(new.campaign_id))
      then 'approved'
    else 'pending'
  end;
  return new;
end;
$$;
create trigger new_character_rules before insert on public.actors
  for each row execute function private.new_character_rules();

create function private.check_new_character_level() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  limit_level integer;
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id) or new.kind <> 'pc'
    or new.level is not distinct from old.level or old.approval = 'approved' then
    return new;
  end if;
  limit_level := private.start_level_limit(new.campaign_id);
  if limit_level is not null and new.level > limit_level then
    raise exception 'New characters here start at level % or lower.', limit_level using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_new_character_level before update on public.actors
  for each row execute function private.check_new_character_level();

-- A player may make a character that's approved at once, but only through the rules above.
drop policy "actors: GM or player creates" on public.actors;
create policy "actors: GM or player creates" on public.actors
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and owner_type = 'user' and owner_user_id = (select auth.uid())
      and (approval = 'pending'
        or (approval = 'approved' and kind = 'pc'
          and (select c.settings -> 'characterApproval' from public.campaigns c where c.id = campaign_id) = 'false'::jsonb))
      and review_note = ''
      and kind in ('pc', 'hireling', 'animal', 'vehicle')
      and company_id is null
    )
  );

-- As in 20261019170000_m1_character_approval.sql, on creation too.
create or replace function private.activate_first_approved() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.approval = 'approved' and (tg_op = 'INSERT' or old.approval is distinct from 'approved')
    and new.kind = 'pc' and new.owner_type = 'user' then
    update public.members
    set active_actor_id = new.id
    where campaign_id = new.campaign_id and user_id = new.owner_user_id and active_actor_id is null;
  end if;
  return new;
end;
$$;
create trigger activate_first_approved_on_insert after insert on public.actors
  for each row execute function private.activate_first_approved();
