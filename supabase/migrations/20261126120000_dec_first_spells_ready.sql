-- A new caster's first spells are ready at once (row FS1; docs/plans/dec-first-spells-ready.md; ruling
-- docs/design/rulings/dec-first-spells-ready-2026-11-26.md, fsr-1 to fsr-13).
--   Until a character's first rest, what is chosen in Prepare is ready at once. "Open" is never stored: the app works
--   it out as "never rested and nothing cast today". What is stored is whether the character has rested once:
--   character_play.rested_once. A character with no play row reads as not rested, so nothing is written for them.
--   1. The column: every row already there reads "rested" with no write (a caster with spells ready counts as rested,
--      fsr-13); a row made from now on starts not rested.
--   2. The one-off update for casters already made (fsr-13; Francis, 26 November: "Yes, run it"): a row with nothing
--      ready, outside a retired campaign, is marked not rested with no casts; a choice with a spell in it that is
--      waiting for a rest is made ready. Nobody loses a spell, a choice or a cast. The log keeps each change: the rows
--      carry the log_change trigger, so each change is a line of its own, written by no one (no command runs here).
--      It lives here only: run again later it would reopen a caster who has rested and has nothing ready.
--   3. set_spells (the rest and the GM's set by hand, fsr-5) marks the character rested in both branches of its upsert.
-- Who reads and writes character_play is unchanged. Drops, renames and deletes nothing.

-- 1. The column ----------------------------------------------------------------------------------------------------

alter table public.character_play add column rested_once boolean not null default true;
alter table public.character_play alter column rested_once set default false;
comment on column public.character_play.rested_once is 'Whether the character has had its first rest (or the GM has set its spells by hand). Until then, and while nothing is cast today, what is chosen in Prepare is ready at once (fsr-1, fsr-7). A character with no row reads as not rested.';

-- 2. The one-off update for casters already made (fsr-13) ------------------------------------------------------------
-- The database cannot tell a caster (the class is in the pack), so every play row with nothing ready is marked not
-- rested; nothing shows for a character with no spells. A retired campaign is read-only and left as it is.

update public.character_play p
  set rested_once = false,
      spells_cast = '{}'::jsonb,
      prepared = case when jsonb_typeof(p.chosen) = 'array' and jsonb_array_length(p.chosen) > 0 then p.chosen else p.prepared end,
      chosen = case when jsonb_typeof(p.chosen) = 'array' and jsonb_array_length(p.chosen) > 0 then null else p.chosen end
  where jsonb_array_length(p.prepared) = 0
    and not private.campaign_is_retired(p.campaign_id);

-- 3. set_spells marks the character rested ---------------------------------------------------------------------------
-- As in 20261113140000_dec_8a_magic_state.sql (its only definition), with rested_once = true in both branches of the
-- upsert: the rest and the GM's set by hand close the first spells (fsr-5). Undo from the log restores the row's
-- values before, rested_once among them, so it opens them again.

create or replace function public.set_spells(actor uuid, new_ready jsonb, new_chosen jsonb, new_cast jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  campaign uuid;
  was_cast jsonb;
  kept jsonb;
begin
  select a.campaign_id into campaign from public.actors a where a.id = actor;
  if campaign is null or not private.is_gm(campaign) then
    raise exception 'Only the GM can change someone''s spells this way.' using errcode = '42501';
  end if;
  if new_ready is null or jsonb_typeof(new_ready) <> 'array' or (new_chosen is not null and jsonb_typeof(new_chosen) <> 'array') then
    raise exception 'Those spells aren''t in the right shape.';
  end if;
  if new_cast is not null and not private.whole_counts(new_cast) then
    raise exception 'A count of casts must be a whole number, 0 or more.';
  end if;
  select p.spells_cast into was_cast from public.character_play p where p.actor_id = actor for update;
  select coalesce(jsonb_object_agg(e.key, least(e.value::numeric::integer, ready.times)), '{}'::jsonb) into kept
  from jsonb_each(coalesce(new_cast, was_cast, '{}'::jsonb)) e
  cross join lateral (
    select count(*)::integer as times from jsonb_array_elements(new_ready) r
    where (r ->> 'level') || ':' || (r ->> 'spell') = e.key
  ) ready
  where least(e.value::numeric::integer, ready.times) > 0;
  insert into public.character_play as p (actor_id, campaign_id, prepared, chosen, spells_cast, rested_once)
  values (actor, campaign, new_ready, new_chosen, kept, true)
  on conflict (actor_id) do update
    set prepared = excluded.prepared, chosen = excluded.chosen, spells_cast = excluded.spells_cast, rested_once = true;
end;
$$;
revoke execute on function public.set_spells(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.set_spells(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
