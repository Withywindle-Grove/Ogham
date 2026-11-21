-- December step 8, piece A: a character's magic as state (docs/plans/dec-8-magic-first-cut.md; rulings mp-1, mp-2,
-- mp-4, mp-6 and mm-1 in docs/design/rulings/m5c-magic-in-play-2026-11-05.md and m5c-magic-mockups-2026-11-10.md).
--   What is ready today stays in character_play.prepared (the Player screen reads it, unchanged). Two columns join it:
--   * chosen: what is chosen for the next rest (mp-2: "chosen is not yet ready"), the same shape as prepared
--     ([{ "spell": "<pack spell id>", "level": 1 }], a spell chosen twice listed twice). Null means nothing new was
--     chosen: the next rest brings back today's ready spells (mm-5: "yesterday's spells will be selected by default").
--   * spells_cast: the castings spent today, by "<level>:<spell id>" ({ "1:mire-lamp": 1 }), never more than the times
--     that spell is ready at that level (mm-1: a dot per casting, hollowed as cast).
--   cast_spell marks one casting spent, or gives one back, inside the database with the row locked, so two devices
--   casting the last one at once can't both succeed. set_spells is the GM's "fill or change anyone's spells at any
--   time" (mp-4); it refuses anyone but the GM, so the app's GM-only rule has a database twin.
-- Who reads and writes character_play is unchanged: read like the character (prepared spells stay visible to anyone
-- who can read the character, ruled 2026-11-05), changed by the owner or the GM. No access rule changes.
-- Add-only: two columns with checks, three functions, five logged commands. Drops, renames and deletes nothing.

-- A count of casts is a whole number from 0 to 999 (the column's check and set_spells both use it), so a bad value
-- can never stop a cast.
create function private.whole_counts(counts jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(counts) = 'object' and not exists (
    select 1 from jsonb_each(counts) e
    where jsonb_typeof(e.value) <> 'number' or e.value::numeric < 0 or e.value::numeric > 999 or e.value::numeric <> floor(e.value::numeric)
  );
$$;
revoke execute on function private.whole_counts(jsonb) from public, anon;
grant execute on function private.whole_counts(jsonb) to authenticated, service_role;

alter table public.character_play
  add column chosen jsonb check (chosen is null or (jsonb_typeof(chosen) = 'array' and pg_column_size(chosen) <= 4000)),
  add column spells_cast jsonb not null default '{}'::jsonb check (private.whole_counts(spells_cast) and pg_column_size(spells_cast) <= 4000);
comment on column public.character_play.chosen is 'The spells chosen for the next rest (mp-2), shaped like prepared; null = nothing new chosen, the next rest brings back today''s ready spells.';
comment on column public.character_play.spells_cast is 'Castings spent today by "<level>:<spell id>"; never more than the times the spell is ready at that level.';

-- Mark one casting of a ready spell spent (change 1), or give one back (change -1, the Undo). Runs as the caller, so
-- the character_play rules apply (the owner or the GM, an approved character, not in a retired campaign) and the
-- change is logged under the caller's command. The row is locked while it is read and changed: of two casts of the
-- last casting at once, the second waits, then is refused with a reason.
create function public.cast_spell(actor uuid, spell text, spell_level integer, change integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  campaign uuid;
  ready jsonb;
  spent jsonb;
  cast_key text;
  times integer;
  was integer;
  now_cast integer;
begin
  if spell is null or char_length(spell) not between 1 and 200 then
    raise exception 'Which spell?';
  end if;
  if spell_level is null or spell_level not between 0 and 99 then
    raise exception 'Which spell level?';
  end if;
  if change is null or change not in (-1, 1) then
    raise exception 'A spell is cast, or given back, one at a time.';
  end if;
  select a.campaign_id into campaign from public.actors a where a.id = actor;
  if campaign is null or not private.may_play(campaign, actor) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select p.prepared, p.spells_cast into ready, spent from public.character_play p where p.actor_id = actor for update;
  cast_key := spell_level::text || ':' || spell;
  select count(*) into times from jsonb_array_elements(coalesce(ready, '[]'::jsonb)) r
    where r ->> 'spell' = spell and r -> 'level' = to_jsonb(spell_level);
  if times = 0 then
    raise exception 'That spell isn''t ready.';
  end if;
  -- A count left over from a ready list that has since shrunk counts as all of them spent.
  was := least(coalesce((spent ->> cast_key)::integer, 0), times);
  now_cast := was + change;
  if now_cast > times then
    raise exception 'Every casting of that spell is spent.';
  end if;
  if now_cast < 0 then
    raise exception 'That spell hasn''t been cast.';
  end if;
  update public.character_play p
    set spells_cast = case when now_cast = 0 then p.spells_cast - cast_key else jsonb_set(p.spells_cast, array[cast_key], to_jsonb(now_cast)) end
    where p.actor_id = actor
    returning p.spells_cast into spent;
  return spent;
end;
$$;
revoke execute on function public.cast_spell(uuid, text, integer, integer) from public, anon;
grant execute on function public.cast_spell(uuid, text, integer, integer) to authenticated, service_role;

-- The GM fills or changes anyone's spells at any time (mp-4): what is ready, what is chosen and what is cast. Ready
-- and chosen are given (the app reads the row first and passes back what it doesn't change). Casts: given, or null to
-- keep today's; either way trimmed here, against the row locked, to the spells still ready (never more than the times
-- each is ready), so a cast made on another device between the app's read and this write isn't lost. Runs as the
-- caller, so the character_play rules apply too (an approved character, not in a retired campaign) and the change is
-- logged under the caller's command; only the GM may call it.
create function public.set_spells(actor uuid, new_ready jsonb, new_chosen jsonb, new_cast jsonb) returns void
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
  insert into public.character_play as p (actor_id, campaign_id, prepared, chosen, spells_cast)
  values (actor, campaign, new_ready, new_chosen, kept)
  on conflict (actor_id) do update
    set prepared = excluded.prepared, chosen = excluded.chosen, spells_cast = excluded.spells_cast;
end;
$$;
revoke execute on function public.set_spells(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.set_spells(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;

insert into public.logged_commands (name, level, gm_only) values
  ('character.chooseSpells', 'simple', false),
  ('character.sameAsYesterday', 'simple', false),
  ('character.castSpell', 'simple', false),
  ('character.uncastSpell', 'simple', false),
  ('character.setSpells', 'simple', true);
