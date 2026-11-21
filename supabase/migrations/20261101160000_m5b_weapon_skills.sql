-- M5b step 0b part A, weapon skills (design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md; docs/04 PC
-- extras: weaponSkills). Adds one column, one function and one trigger; drops and changes no data.
--   actors.weapon_skills: the setting's weapons the character has picked under the rules set's weaponProficiency,
--   [{ "itemId": "<the item's id>", "specialised": true? }], empty for everyone today. Changes go through
--   character.edit, so they're logged like any other edit (and undone from the log).
--   Who changes them: before approval the owner, freely; the GM always. After approval the owner may only ADD picks
--   (unspecialised; every pick already there stays exactly as it was): removing, swapping or specialising is the
--   GM's. How many may be picked depends on the setting's numbers and the level, so the app works that out and says
--   so; the database keeps the list well formed and holds the add-only rule.
alter table public.actors
  add column weapon_skills jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(weapon_skills) = 'array'
      and jsonb_array_length(weapon_skills) <= 40
      and pg_column_size(weapon_skills) <= 4000
      and not jsonb_path_exists(weapon_skills, '$[*] ? (@.type() != "object" || !exists(@.itemId) || @.itemId.type() != "string")')
      and not jsonb_path_exists(weapon_skills, '$[*] ? (exists(@.specialised) && @.specialised != true)')
    );

create function private.guard_weapon_skills() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.weapon_skills is not distinct from old.weapon_skills then
    return new;
  end if;
  -- Each item once, with a short id.
  if exists (
    select 1 from jsonb_array_elements(new.weapon_skills) as pick
    where length(pick ->> 'itemId') not between 1 and 80
  ) or (
    select count(*) from jsonb_array_elements(new.weapon_skills)
  ) <> (
    select count(distinct pick ->> 'itemId') from jsonb_array_elements(new.weapon_skills) as pick
  ) then
    raise exception 'Each weapon skill names one weapon, once.' using errcode = '23514';
  end if;
  if (select auth.uid()) is null or private.is_gm(old.campaign_id) or old.approval <> 'approved' then
    return new;
  end if;
  -- After approval the owner only adds unspecialised picks.
  if exists (
    select 1 from jsonb_array_elements(old.weapon_skills) as was
    where not (new.weapon_skills @> jsonb_build_array(was))
  ) or exists (
    select 1 from jsonb_array_elements(new.weapon_skills) as now
    where not (old.weapon_skills @> jsonb_build_array(now)) and now ? 'specialised'
  ) then
    raise exception 'Only the GM can remove or change a weapon skill once the character is approved.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_weapon_skills before update of weapon_skills on public.actors
  for each row execute function private.guard_weapon_skills();
