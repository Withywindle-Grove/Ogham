-- perf-pack-cache (performance report fix 2(b), ruled 2026-11-07, ⚑ 1 A): stamps for the on-device pack cache.
-- Each device keeps a copy of the setting rules it was sent; on start it asks only "which stamps are current?" and
-- downloads just the packs whose stamp moved. Two stamps, written only by the database:
-- * packs.content_rev: a whole number bumped once per statement that changes the pack's entries or hidden fields
--   (an import or update, an edited entry, homebrew saved or deleted, a hidden field changed);
-- * campaign_rules_revs.seen_rev: a side table (not a column on campaigns, whose log_change trigger would write a
--   log line per bump), bumped when what a player may read changes without any pack changing: known_items (an item
--   revealed), campaign_packs (attached, detached, moved, options) and campaign_pack_secrets (the GM's exceptions).
-- Adds only: drops, renames and deletes nothing. Readable by whoever can read the pack or is a member of the campaign.

-- 1. The content stamp -------------------------------------------------------------------------------------------

alter table public.packs add column content_rev bigint not null default 0;

-- One bump per pack per statement (a 1,700-row import bumps once), from the rows the statement touched. Postgres
-- allows a transition table on a single-event trigger only, so each table gets one trigger per event; the function
-- reads `changed` whichever event it was. Security definer: a player's inventory change can't update packs itself.
create function private.bump_pack_content_rev() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.packs p set content_rev = p.content_rev + 1
  where p.id in (select distinct c.pack_id from changed c);
  return null;
end;
$$;
revoke execute on function private.bump_pack_content_rev() from public, anon, authenticated;

create trigger bump_content_rev_insert after insert on public.library_entries
  referencing new table as changed for each statement execute function private.bump_pack_content_rev();
create trigger bump_content_rev_update after update on public.library_entries
  referencing new table as changed for each statement execute function private.bump_pack_content_rev();
create trigger bump_content_rev_delete after delete on public.library_entries
  referencing old table as changed for each statement execute function private.bump_pack_content_rev();

create trigger bump_content_rev_insert after insert on public.library_entry_secrets
  referencing new table as changed for each statement execute function private.bump_pack_content_rev();
create trigger bump_content_rev_update after update on public.library_entry_secrets
  referencing new table as changed for each statement execute function private.bump_pack_content_rev();
create trigger bump_content_rev_delete after delete on public.library_entry_secrets
  referencing old table as changed for each statement execute function private.bump_pack_content_rev();

-- 2. The seen stamp ----------------------------------------------------------------------------------------------

create table public.campaign_rules_revs (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  seen_rev bigint not null default 0
);
alter table public.campaign_rules_revs enable row level security;
grant select on public.campaign_rules_revs to authenticated;
grant select, insert, update, delete on public.campaign_rules_revs to service_role;
-- The GM and the players read it (it carries no content: a number); nobody writes it but the triggers below.
create policy "campaign rules revs: members read" on public.campaign_rules_revs
  for select to authenticated using (private.is_member(campaign_id));

-- A row is made on the first bump; a campaign without one is at 0. A campaign being deleted (its links and known
-- items go in the cascade) gets no row back: its own row went with it.
create function private.bump_seen_rev() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.campaign_rules_revs (campaign_id, seen_rev)
  select distinct c.campaign_id, 1 from changed c
  where exists (select 1 from public.campaigns k where k.id = c.campaign_id)
  on conflict (campaign_id) do update set seen_rev = public.campaign_rules_revs.seen_rev + 1;
  return null;
end;
$$;
revoke execute on function private.bump_seen_rev() from public, anon, authenticated;

create trigger bump_seen_rev_insert after insert on public.known_items
  referencing new table as changed for each statement execute function private.bump_seen_rev();
create trigger bump_seen_rev_update after update on public.known_items
  referencing new table as changed for each statement execute function private.bump_seen_rev();
create trigger bump_seen_rev_delete after delete on public.known_items
  referencing old table as changed for each statement execute function private.bump_seen_rev();

create trigger bump_seen_rev_insert after insert on public.campaign_packs
  referencing new table as changed for each statement execute function private.bump_seen_rev();
create trigger bump_seen_rev_update after update on public.campaign_packs
  referencing new table as changed for each statement execute function private.bump_seen_rev();
create trigger bump_seen_rev_delete after delete on public.campaign_packs
  referencing old table as changed for each statement execute function private.bump_seen_rev();

create trigger bump_seen_rev_insert after insert on public.campaign_pack_secrets
  referencing new table as changed for each statement execute function private.bump_seen_rev();
create trigger bump_seen_rev_update after update on public.campaign_pack_secrets
  referencing new table as changed for each statement execute function private.bump_seen_rev();
create trigger bump_seen_rev_delete after delete on public.campaign_pack_secrets
  referencing old table as changed for each statement execute function private.bump_seen_rev();
