-- G-208 batch A, row E2: expertise points (design/rulings/g208-expertise-points-2026-11-20.md ex-1, ex-2;
-- docs/04 PC extras: expertise; docs/plans/g208-expertise-points.md). Adds one column, two functions and one trigger;
-- drops and changes no data, and changes no read rule.
--   actors.expertise: the points spent under the class's skills.points, { "<class skill code>": <points ≥ 1> } (a skill
--   with no points has no key), empty for everyone today. Changes go through character.edit, so they're logged like any
--   other edit (and undone from the log), as weapon skills are.
--   Who changes them (the weapon skills rule, m5b-0 §2): before approval the owner, freely; the GM always. After
--   approval the owner may only ADD points (raise a skill's points or give a skill its first): lowering a skill or
--   taking it off is the GM's (Move points). How many points a character has and each skill's best depend on the
--   setting's numbers and the level, so the app works them out and says so; the database keeps the shape and holds the
--   add-only rule.
-- The guard is built from the newest (and only) definition of private.guard_weapon_skills,
-- 20261101160000_m5b_weapon_skills.sql, with one addition: after approval, the Undo (grimoire.reverting) of a line
-- logged after the approval goes through (private.expertise_undo_after_approval); the Undo of a line from before it is
-- held to the add-only rule, so the owner can't take back pre-approval spending once the GM has approved.
alter table public.actors
  add column expertise jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(expertise) = 'object'
      and pg_column_size(expertise) <= 2000
      -- strict: lax mode would unwrap an array ({"SB": [5]} or {"SB": []}) and let it pass.
      and not jsonb_path_exists(expertise, 'strict $.* ? (@.type() != "number" || @ < 1 || @ > 99 || @ != @.floor())', '{}', true)
    );

-- Whether the line an Undo is putting back (grimoire.reverting) was logged on this character after the newest logged
-- change of its approval (an insert counts: a character made approved). Reads the log the undo machinery reads
-- (public.events, private.undo_put_back), past its read rules (a line's audience isn't the owner's to narrow here);
-- returns only yes or no.
create function private.expertise_undo_after_approval(actor uuid, reverting uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events undone
    where undone.id = reverting
      and undone.target_table = 'actors'
      and undone.target_id = actor
      and undone.seq > coalesce((
        select max(e.seq) from public.events e
        where e.campaign_id = undone.campaign_id
          and e.target_table = 'actors'
          and e.target_id = actor
          and e.after ? 'approval'
      ), 0)
  );
$$;
revoke execute on function private.expertise_undo_after_approval(uuid, uuid) from public, anon;
grant execute on function private.expertise_undo_after_approval(uuid, uuid) to authenticated, service_role;

create function private.guard_expertise() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.expertise is not distinct from old.expertise then
    return new;
  end if;
  -- A short code for each skill, and not too many skills.
  if exists (
    select 1 from jsonb_object_keys(new.expertise) as code
    where length(code) not between 1 and 40
  ) or (
    select count(*) from jsonb_object_keys(new.expertise)
  ) > 40 then
    raise exception 'Each skill''s points are kept under a short skill code.' using errcode = '23514';
  end if;
  if (select auth.uid()) is null
    or private.is_gm(old.campaign_id)
    or old.approval <> 'approved' then
    return new;
  end if;
  -- The Undo of a logged change puts back what it replaced (undo_request checks the person made it or is the GM, and
  -- that nothing changed since), so a player's Undo of the points they added after approval goes through (ex-5: Done
  -- saves the visit with Undo). undo_check_change compares only the columns the line changed, and approval changes
  -- approval, not expertise: so the Undo of a line from before the approval is held to the add-only rule below
  -- (ex-2: lowering a skill once approved is the GM's).
  if nullif(current_setting('grimoire.reverting', true), '') is not null
    and private.expertise_undo_after_approval(old.id, nullif(current_setting('grimoire.reverting', true), '')::uuid) then
    return new;
  end if;
  -- After approval the owner only adds: every skill keeps at least the points it had, as a number.
  if exists (
    select 1 from jsonb_each(old.expertise) as was
    where not (new.expertise ? was.key)
      or jsonb_typeof(new.expertise -> was.key) <> 'number'
      or (new.expertise -> was.key) < was.value
  ) then
    raise exception 'Only the GM can move expertise points once the character is approved.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_expertise before update of expertise on public.actors
  for each row execute function private.guard_expertise();
