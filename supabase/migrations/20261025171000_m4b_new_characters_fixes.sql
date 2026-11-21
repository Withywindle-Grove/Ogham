-- M4b, character creation step 2, fixed forward from 20261025170000_m4b_new_characters.sql. Replaces two
-- functions. Drops nothing.
--   A player who asks for an approved character when it wouldn't join at once is refused (as before step 2),
--   not quietly sent to the GM.
--   A character approved on creation becomes active only when its own player made it (not when the GM or the
--   service makes one for them).

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
    and (coalesce(setting ->> 'startLevel', 'gm') <> 'gm' or new.level <= private.party_lowest(new.campaign_id));
  if at_once then
    new.approval := 'approved';
  elsif new.approval = 'approved' then
    raise exception 'Only the GM can approve characters.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.activate_first_approved() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.approval = 'approved' and new.kind = 'pc' and new.owner_type = 'user'
    and (
      (tg_op = 'UPDATE' and old.approval is distinct from 'approved')
      or (tg_op = 'INSERT' and new.owner_user_id = (select auth.uid()))
    ) then
    update public.members
    set active_actor_id = new.id
    where campaign_id = new.campaign_id and user_id = new.owner_user_id and active_actor_id is null;
  end if;
  return new;
end;
$$;
