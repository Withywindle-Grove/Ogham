-- M5 step 8 (part 3, fix): a group member's row has its character's id as its own id, so the log can name the
-- character in "Sam put Ash in Group 2" (a log event keeps the row's id and only the values that changed).
--   1. Every party_group_members row takes its character's id (the table is new in 20261030230000_m5_party_groups.sql
--      and nothing refers to these ids yet). Its triggers are paused for this one update, so it isn't logged.
--   2. private.make_group_member and public.choose_party_group (newest copies in 20261030230000_m5_party_groups.sql)
--      make new rows that way; choose_party_group also moves the character before its hirelings, so the log line
--      leads with the character.
-- Changes ids only; no rows are removed.

alter table public.party_group_members disable trigger user;
update public.party_group_members m set id = m.actor_id where m.id <> m.actor_id;
alter table public.party_group_members enable trigger user;
alter table public.party_group_members alter column id drop default;
alter table public.party_group_members add constraint party_group_members_id_is_actor check (id = actor_id);

-- As in 20261030230000_m5_party_groups.sql, plus: the row's id is the character's.
create or replace function private.make_group_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('pc', 'hireling') then
    insert into public.party_groups (campaign_id, number) values (new.campaign_id, 1) on conflict do nothing;
    insert into public.party_group_members (id, actor_id, campaign_id, group_number)
    values (new.id, new.id, new.campaign_id, private.starting_group(new.campaign_id, case when new.owner_type = 'user' then new.owner_user_id end, new.kind))
    on conflict (actor_id) do nothing;
  end if;
  return null;
end;
$$;

-- As in 20261030230000_m5_party_groups.sql, plus: a row made here has the character's id; the character moves first,
-- then its hirelings.
create or replace function public.choose_party_group(actor uuid, to_group integer default null) returns public.party_group_members
language plpgsql security definer set search_path = '' as $$
declare
  who public.actors;
  found public.party_group_members;
  from_group integer;
  target integer := to_group;
  alone boolean;
begin
  select * into who from public.actors a where a.id = actor;
  if who.id is null or who.kind not in ('pc', 'hireling') or not private.may_play(who.campaign_id, who.id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select * into found from public.party_group_members m where m.actor_id = actor;
  if found.id is null then
    insert into public.party_groups (campaign_id, number) values (who.campaign_id, 1) on conflict do nothing;
    insert into public.party_group_members (id, actor_id, campaign_id) values (who.id, who.id, who.campaign_id) returning * into found;
  end if;
  if private.repeated_request('party_group_members', found.id) then
    return found;
  end if;
  from_group := found.group_number;
  if target is null then
    select not exists (
      select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
      where m.campaign_id = who.campaign_id and m.group_number = from_group and m.actor_id <> who.id
        and a.approval = 'approved' and a.status = 'active'
    ) into alone;
    if alone and from_group <> 1 then
      raise exception 'They''re in a group of their own already.';
    end if;
    select min(g.number) into target from public.party_groups g
    where g.campaign_id = who.campaign_id and g.number > 1
      and not exists (select 1 from public.party_group_members m where m.campaign_id = g.campaign_id and m.group_number = g.number);
    if target is null then
      select max(g.number) + 1 into target from public.party_groups g where g.campaign_id = who.campaign_id;
      if target > 50 then
        raise exception 'That''s as many groups as there can be.';
      end if;
      insert into public.party_groups (campaign_id, number) values (who.campaign_id, target);
    end if;
  elsif not exists (select 1 from public.party_groups g where g.campaign_id = who.campaign_id and g.number = target) then
    raise exception 'That group isn''t there any more.';
  end if;
  if target = from_group then
    return found;
  end if;
  perform set_config('grimoire.regrouping', 'on', true);
  update public.party_group_members m set group_number = target where m.id = found.id;
  if who.kind = 'pc' and who.owner_type = 'user' and who.owner_user_id is not null then
    update public.party_group_members m set group_number = target
    from public.actors h
    where h.id = m.actor_id and m.campaign_id = who.campaign_id and m.group_number = from_group
      and h.kind = 'hireling' and h.owner_type = 'user' and h.owner_user_id = who.owner_user_id;
  end if;
  perform private.tidy_party_groups(who.campaign_id);
  perform set_config('grimoire.regrouping', '', true);
  select * into found from public.party_group_members m where m.id = found.id;
  return found;
end;
$$;
