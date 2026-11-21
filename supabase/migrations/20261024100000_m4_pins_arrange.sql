-- M4 step 6: At hand pins and Arrange this screen (ruled 2026-10-23; docs/04, 05). Adds a column, a table, two
-- triggers and logged commands. Drops nothing.
--   inventory_lines.pinned: an item pinned to At hand on its character's Player screen (items only in M4). A pin
--   goes away by itself when its item leaves the character: handed on (cleared here) or dropped (the line goes).
--   character_layouts: each character's Player screen sections, shown or hidden and in order, the same on every
--   device; the owner or the GM; logged in the detailed log only.

alter table public.inventory_lines add column pinned boolean not null default false;

create function private.unpin_when_handed_on() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.location_id is distinct from old.location_id then
    new.pinned := false;
  end if;
  if new.actor_id is null then
    new.pinned := false;
  end if;
  return new;
end;
$$;
create trigger unpin_when_handed_on before update on public.inventory_lines
  for each row execute function private.unpin_when_handed_on();

-- Nothing in the Party stash is pinned (pins belong to a character).
alter table public.inventory_lines add constraint inventory_lines_pins_on_characters check (not pinned or actor_id is not null);

create table public.character_layouts (
  actor_id uuid primary key references public.actors (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.character_layouts enable row level security;
grant select, insert, update on public.character_layouts to authenticated;
grant select, insert, update, delete on public.character_layouts to service_role;

-- The owner (their own character in this campaign) or the GM.
create function private.may_arrange(campaign uuid, actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_gm(campaign)
    or exists (
      select 1 from public.actors a
      where a.id = actor and a.campaign_id = campaign and a.owner_type = 'user' and a.owner_user_id = (select auth.uid())
        and private.is_member(campaign)
    );
$$;
grant execute on function private.may_arrange(uuid, uuid) to authenticated, service_role;

create policy "character layouts: read like the character" on public.character_layouts
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and exists (
        select 1 from public.actors a
        where a.id = actor_id and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid())))
      )
    )
  );
create policy "character layouts: the owner or the GM" on public.character_layouts
  for insert to authenticated with check (private.may_arrange(campaign_id, actor_id));
create policy "character layouts: the owner or the GM, again" on public.character_layouts
  for update to authenticated using (private.may_arrange(campaign_id, actor_id)) with check (private.may_arrange(campaign_id, actor_id));
create trigger log_change after insert or update or delete on public.character_layouts
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.character_layouts
  for each row execute function private.refuse_when_retired();

insert into public.logged_commands (name, level, gm_only) values
  ('inventory.pin', 'simple', false),
  ('character.arrange', 'verbose', false);
insert into public.undoable_tables (name) values ('character_layouts');
