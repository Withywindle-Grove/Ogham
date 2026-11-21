-- "Use safe paths" is logged (ruled 2026-11-04, sq-2, docs/design/rulings/m5b-small-questions-2026-11-04.md; of-5 said
-- so and nothing was written). Leave the dungeon's Use safe paths (the pack's dungeonExit.safePaths procedure) now
-- marks the expedition under way as left by safe paths: one Simple log line, the GM's, with Undo (the generic undo puts
-- the mark back).
--   1. expeditions.safe_paths (off by default). Who reads and writes it: the expedition's own rules, unchanged
--      ("expeditions: members read", "expeditions: the GM changes one").
--   2. public.use_safe_paths(expedition): the GM's; refused on an undone or ended expedition. A second use on the same
--      expedition changes nothing and writes no line (the expedition comes back as it is).
--   3. The command's logged_commands row: expedition.safePaths, Simple, the GM's.
-- Adds one column (with a default), one function and one logged_commands row. Replaces no function. Drops no data; no
-- rows are removed, renamed or changed (every expedition starts unmarked).

-- 1. The mark ---------------------------------------------------------------------------------------------------------

alter table public.expeditions add column safe_paths boolean not null default false;

comment on column public.expeditions.safe_paths is 'Left by safe paths (sq-2): the GM used the pack''s safe paths in Leave the dungeon; logged as expedition.safePaths.';

-- 2. Use safe paths ----------------------------------------------------------------------------------------------------

create function public.use_safe_paths(expedition uuid) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  found public.expeditions;
begin
  select * into found from public.expeditions x where x.id = expedition;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That expedition was undone.';
  end if;
  if found.ended_at is not null then
    raise exception 'That expedition has ended.';
  end if;
  -- Already marked (or the same request sent again): nothing changes, no second line.
  if found.safe_paths then
    return found;
  end if;
  update public.expeditions x set safe_paths = true where x.id = expedition returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;
revoke execute on function public.use_safe_paths(uuid) from public, anon;
grant execute on function public.use_safe_paths(uuid) to authenticated, service_role;

-- 3. The command -------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('expedition.safePaths', 'simple', true);
