-- M4b gate (B18, ruled 2026-10-25): when the GM sends a character back, they can tick the sections that need
-- work; the player sees them marked on the review screen. Adds a column and a trigger; replaces the character
-- guard (only the GM writes them). Drops nothing.

alter table public.actors add column review_sections text[] not null default '{}';

-- As in 20261025130000_m4b_companies.sql, plus: only the GM writes the ticked sections.
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
    and not (old.approval = 'rejected' and new.approval = 'pending') then
    raise exception 'Only the GM can approve or reject characters.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
    and not (new.status = 'archived' and old.status <> 'archived' and old.approval = 'approved') then
    raise exception 'Players can only remove (archive) an approved character; the GM restores it.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- A player's new character starts with no ticked sections.
create function private.no_review_on_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_gm(new.campaign_id) then
    new.review_sections := '{}';
  end if;
  return new;
end;
$$;
create trigger no_review_on_insert before insert on public.actors
  for each row execute function private.no_review_on_insert();
