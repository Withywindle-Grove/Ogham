-- M4b re-test ruling 6 (2026-10-26): a "not sent yet" draft. A guided character is saved as a draft before its
-- starting gear, so nothing is lost if the app closes; Send to the GM comes last, on the review screen. The GM
-- doesn't see someone else's draft: not the character, its gear, or their log entries. Sending turns a draft into
-- a waiting character (or one that joins at once, under the campaign's usual rules).
-- Add-only in effect: the approval check is replaced by a wider one that also allows 'draft' (no row changes);
-- the actors read and create policies, the inventory and events read policies, the character guard and the
-- new-character rules are replaced; two helpers, a trigger and the 'character.send' logged command are added.
-- Drops no data.

alter table public.actors drop constraint actors_approval_check;
alter table public.actors add constraint actors_approval_check check (approval in ('draft', 'pending', 'approved', 'rejected'));

-- Someone else's draft, which the signed-in person (the GM included) doesn't see.
create function private.is_others_draft(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.actors a
    where a.id = actor and a.approval = 'draft' and a.owner_user_id is distinct from (select auth.uid())
  );
$$;
revoke execute on function private.is_others_draft(uuid) from public, anon;
grant execute on function private.is_others_draft(uuid) to authenticated, service_role;

-- A log entry about someone else's draft or its gear.
create function private.is_others_draft_event(target_table text, target uuid, row_values jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select case target_table
    when 'actors' then private.is_others_draft(target)
    when 'inventory_lines' then private.is_others_draft(coalesce(
      (row_values ->> 'actor_id')::uuid,
      (select l.actor_id from public.inventory_lines l where l.id = target)))
    else false
  end;
$$;
revoke execute on function private.is_others_draft_event(text, uuid, jsonb) from public, anon;
grant execute on function private.is_others_draft_event(text, uuid, jsonb) to authenticated, service_role;

-- As in 20261019120000_m1_core_tables.sql, but the GM doesn't see another's draft.
drop policy "actors: read approved or own" on public.actors;
create policy "actors: read approved or own" on public.actors
  for select to authenticated
  using (
    (private.is_gm(campaign_id) and (approval <> 'draft' or owner_type <> 'user' or owner_user_id = (select auth.uid())))
    or (
      private.is_member(campaign_id)
      and (approval = 'approved' or (owner_type = 'user' and owner_user_id = (select auth.uid())))
    )
  );

-- As in 20261025170000_m4b_new_characters.sql, and a player may also start a draft.
drop policy "actors: GM or player creates" on public.actors;
create policy "actors: GM or player creates" on public.actors
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and owner_type = 'user' and owner_user_id = (select auth.uid())
      and (approval in ('draft', 'pending')
        or (approval = 'approved' and kind = 'pc'
          and (select c.settings -> 'characterApproval' from public.campaigns c where c.id = campaign_id) = 'false'::jsonb))
      and review_note = ''
      and kind in ('pc', 'hireling', 'animal', 'vehicle')
      and company_id is null
    )
  );

-- As in 20261023120000_m4_inventory.sql, but the GM doesn't see the gear of another's draft.
drop policy "inventory lines: read like the carrier" on public.inventory_lines;
create policy "inventory lines: read like the carrier" on public.inventory_lines
  for select to authenticated
  using (
    (private.is_gm(campaign_id) and (actor_id is null or not private.is_others_draft(actor_id)))
    or (
      private.is_member(campaign_id)
      and (
        location_id is not null
        or exists (
          select 1 from public.actors a
          where a.id = actor_id
            and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid())))
        )
      )
    )
  );

-- As in 20261020140000_m2_events.sql, but the GM doesn't see the log entries of another's draft until it's sent.
drop policy "events: read what you may see" on public.events;
create policy "events: read what you may see" on public.events
  for select to authenticated
  using (
    (private.is_gm(campaign_id) and not private.is_others_draft_event(target_table, target_id, coalesce(after, before)))
    or (
      private.is_member(campaign_id)
      and reveal_at = 'now'
      and (audience = 'all' or (audience = 'owner' and owner_user_id = (select auth.uid())))
    )
  );

-- As in 20261026100000_m4b_start_level.sql, but a draft never joins at once: sending it does (below).
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
  if new.approval = 'draft' then
    return new;
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

-- As in 20261026110000_m4b_review_sections.sql, plus: the owner sends their draft (draft → waiting).
create or replace function private.guard_actor_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'A character can''t move to another campaign.' using errcode = '42501';
  end if;
  if private.is_gm(old.campaign_id) then
    return new;
  end if;
  if new.owner_type is distinct from old.owner_type
    or new.owner_user_id is distinct from old.owner_user_id
    or new.kind is distinct from old.kind
    or (new.company_id is distinct from old.company_id
        and nullif(current_setting('grimoire.joining', true), '') is distinct from old.id::text) then
    raise exception 'Only the GM can change a character''s owner, kind or company.' using errcode = '42501';
  end if;
  if new.review_note is distinct from old.review_note or new.review_sections is distinct from old.review_sections then
    raise exception 'Only the GM can write a review note.' using errcode = '42501';
  end if;
  if new.level is distinct from old.level and old.approval = 'approved' then
    raise exception 'Only the GM can change an approved character''s level.' using errcode = '42501';
  end if;
  if new.approval is distinct from old.approval
    and not (old.approval in ('rejected', 'draft') and new.approval = 'pending') then
    raise exception 'Only the GM can approve or reject characters.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
    and not (new.status = 'archived' and old.status <> 'archived' and old.approval = 'approved') then
    raise exception 'Players can only remove (archive) an approved character; the GM restores it.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Sending a draft: it waits for the GM, or joins at once under the same rules as a character made without a
-- draft. Runs after the guard (triggers run in name order), which has allowed draft → pending.
create function private.send_draft() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  setting jsonb;
begin
  if old.approval <> 'draft' or new.approval <> 'pending' or new.owner_type <> 'user' or new.kind <> 'pc' then
    return new;
  end if;
  select c.settings into setting from public.campaigns c where c.id = new.campaign_id;
  if setting -> 'characterApproval' = 'false'::jsonb
    and (coalesce(setting ->> 'startLevel', 'propose') not in ('propose', 'gm') or new.level <= private.party_lowest(new.campaign_id)) then
    new.approval := 'approved';
  end if;
  return new;
end;
$$;
create trigger send_draft before update on public.actors
  for each row execute function private.send_draft();

insert into public.logged_commands (name, level, gm_only) values ('character.send', 'simple', false);
