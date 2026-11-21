-- M5 step 11, review follow-ups (#186): tighter reading rules for places.
--   1. private.current_group_place runs as its caller (security invoker), so it reads only what the caller may read.
--      Its callers that run with the owner's rights (place_shown_to_me, groups_together, follow_into_group) still see
--      every row; Where now? (set_group_place) runs as the GM, who reads every row.
--   2. Players read a group_places row only while it's their group's current place and shown, so a hidden move, an
--      earlier place or a place id never reaches them. Their screens still follow Show, Hide and moves on: a small
--      per-group signal (group_place_signals) ticks whenever what that group's players can see changes, and they
--      read only its tick.
--   3. private.in_my_group counts only approved, active characters and hirelings (as follow_into_group does).
-- Replaces private.current_group_place and private.in_my_group (20261031170000_m5_places_messages.sql) and the
-- group_places reading rule. Adds one table, its rule, a trigger and its rows (one per party group). Drops one access
-- rule (replaced at once); no rows are removed.

-- 1. -----------------------------------------------------------------------------------------------------------------
create or replace function private.current_group_place(campaign uuid, group_no integer) returns public.group_places
language sql stable security invoker set search_path = '' as $$
  select gp.* from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id
  where gp.campaign_id = campaign and gp.group_number = group_no and not gp.undone and not gp.moved_on
    and x.ended_at is null and not x.undone
  order by gp.created_at desc, gp.id desc
  limit 1;
$$;

-- 3. -----------------------------------------------------------------------------------------------------------------
create or replace function private.in_my_group(campaign uuid, group_no integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(campaign) and exists (
    select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
    where m.campaign_id = campaign and m.group_number = group_no
      and a.owner_type = 'user' and a.owner_user_id = (select auth.uid())
      and a.approval = 'approved' and a.status = 'active'
  );
$$;

-- 2. -----------------------------------------------------------------------------------------------------------------
-- Is this row the reader's group's current place, shown?
create function private.group_place_shown_to_me(row_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_places gp join public.expeditions x on x.id = gp.expedition_id
    where gp.id = row_id and gp.shown and not gp.undone and not gp.moved_on
      and x.ended_at is null and not x.undone
      and private.in_my_group(gp.campaign_id, gp.group_number)
  );
$$;
revoke execute on function private.group_place_shown_to_me(uuid) from public, anon;
grant execute on function private.group_place_shown_to_me(uuid) to authenticated;

drop policy "group places: the GM, and players for their own groups" on public.group_places;
create policy "group places: the GM, and players their group's shown place" on public.group_places
  for select to authenticated using (private.is_gm(campaign_id) or private.group_place_shown_to_me(id));

-- What a group's players can see of its place changed: a tick they may read, nothing more.
create table public.group_place_signals (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  group_number integer not null,
  tick bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, group_number),
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade
);
alter table public.group_place_signals enable row level security;
grant select on public.group_place_signals to authenticated;
grant select, insert, update, delete on public.group_place_signals to service_role;
create policy "group place signals: the GM, and the group's players" on public.group_place_signals
  for select to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));

insert into public.group_place_signals (campaign_id, group_number)
select g.campaign_id, g.number from public.party_groups g on conflict do nothing;

create function private.make_group_place_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_place_signals (campaign_id, group_number) values (new.campaign_id, new.number) on conflict do nothing;
  return null;
end;
$$;
revoke execute on function private.make_group_place_signal() from public, anon, authenticated;
create trigger make_group_place_signal after insert on public.party_groups
  for each row execute function private.make_group_place_signal();

-- Ticks only when what players see changes: a row shown or hidden, a shown row moved on from or undone, a new row made
-- shown (a split carrying a shown place along).
create function private.tick_group_place_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.shown)
    or (tg_op = 'UPDATE' and (
      old.shown is distinct from new.shown
      or (old.shown and (old.moved_on is distinct from new.moved_on or old.undone is distinct from new.undone)))) then
    insert into public.group_place_signals (campaign_id, group_number, tick) values (new.campaign_id, new.group_number, 1)
    on conflict (campaign_id, group_number) do update set tick = public.group_place_signals.tick + 1, updated_at = now();
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_group_place_signal() from public, anon, authenticated;
create trigger tick_group_place_signal after insert or update on public.group_places
  for each row execute function private.tick_group_place_signal();

alter publication supabase_realtime add table public.group_place_signals;
