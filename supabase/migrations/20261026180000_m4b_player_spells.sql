-- Player screen redesign (ruled 2026-10-26): the Spells and Abilities sections need what a character has prepared
-- and which limited uses are spent.
--   character_play: one row per character: `prepared`, the spells prepared in their slots
--   ([{ "spell": "<pack spell id>", "level": 1 }], one entry per slot used, so a spell prepared twice is listed
--   twice), and `uses_spent`, the limited uses spent since the last refill ({ "<ability name>": 2 }). The owner or
--   the GM changes it, for an approved character; it's read like the character (members see approved characters'
--   rows; the GM doesn't see someone else's draft). Preparing goes in the simple log, each use in the detailed log.
-- Add-only: a table, a helper, its policies and triggers, two logged commands and an undoable table. Drops no data.

create table public.character_play (
  actor_id uuid primary key references public.actors (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  prepared jsonb not null default '[]'::jsonb check (jsonb_typeof(prepared) = 'array'),
  uses_spent jsonb not null default '{}'::jsonb check (jsonb_typeof(uses_spent) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.character_play enable row level security;
grant select, insert, update on public.character_play to authenticated;
grant select, insert, update, delete on public.character_play to service_role;

-- The owner (their own approved character in this campaign) or the GM (any approved character).
create function private.may_play(campaign uuid, actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.actors a
    where a.id = actor and a.campaign_id = campaign and a.approval = 'approved'
      and (
        private.is_gm(campaign)
        or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid()) and private.is_member(campaign))
      )
  );
$$;
revoke execute on function private.may_play(uuid, uuid) from public, anon;
grant execute on function private.may_play(uuid, uuid) to authenticated, service_role;

create policy "character play: read like the character" on public.character_play
  for select to authenticated
  using (
    exists (
      select 1 from public.actors a
      where a.id = actor_id and a.campaign_id = character_play.campaign_id
        and (
          (private.is_gm(a.campaign_id) and not private.is_others_draft(a.id))
          or (private.is_member(a.campaign_id) and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid()))))
        )
    )
  );
create policy "character play: the owner or the GM" on public.character_play
  for insert to authenticated with check (private.may_play(campaign_id, actor_id));
create policy "character play: the owner or the GM, again" on public.character_play
  for update to authenticated using (private.may_play(campaign_id, actor_id)) with check (private.may_play(campaign_id, actor_id));
create trigger log_change after insert or update or delete on public.character_play
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.character_play
  for each row execute function private.refuse_when_retired();

insert into public.logged_commands (name, level, gm_only) values
  ('character.prepare', 'simple', false),
  ('character.useAbility', 'verbose', false);
insert into public.undoable_tables (name) values ('character_play');
