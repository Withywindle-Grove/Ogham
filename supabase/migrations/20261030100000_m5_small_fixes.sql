-- M5 small fixes (ruled 2026-10-29; docs/05, 07 and the late rulings): what the database needs for them.
--   1. A split of an approved one-off stays approved. The guard on players' item lines made every new one-off line
--      wait for the GM, splits included, so part of an approved stack moved by a player went back to the GM.
--      Replaces private.guard_lines_from_players (the newest copy is in 20261025100000_m4b_one_off_approval.sql):
--      the same, plus a split's new part keeps the approval of the stack it came from.
--   2. Changing the encumbrance mode, or an optional rule (or anything else about the attached setting rules), writes
--      the "<name> is now <tier>" lines at once, for every character carrying something, instead of waiting for
--      their next item change. Two new triggers call the M5 step 4 function private.record_load_tier.
--   3. Magic armour whose base is picked when it's found (07, armour.baseArmour: { choose: [item ids] }): the choice
--      is kept on the item's line (inventory_lines.base_armour_id). It must be one of the item's own choices; a
--      player may pick it once (when it's still unpicked), and only the GM changes it after that.
--   4. "Check again" (05, Once per period): a check run again in the same period is its own command, logged Verbose,
--      and undone like a recorded check.
-- Adds one column, three triggers, three functions and three logged commands; replaces one function. Drops nothing; no rows are removed.

-- 1. A split keeps its approval ------------------------------------------------------------------------------------

create or replace function private.guard_lines_from_players() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  splitting text := nullif(current_setting('grimoire.splitting', true), '');
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.how_got = 'given' then
      raise exception 'Only the GM gives items.' using errcode = '42501';
    end if;
    if new.library_entry_id is null and new.source_pack_id is not null and splitting is null then
      raise exception 'That item isn''t in this campaign''s setting rules.' using errcode = '42501';
    end if;
    -- Part of a stack split off (public.split_inventory_line): it is what the stack was, approved or waiting.
    if splitting is not null then
      new.approval := coalesce((select l.approval from public.inventory_lines l where l.id::text = splitting), 'pending');
      return new;
    end if;
    -- A one-off (from no setting rules) waits for the GM, unless the campaign says one-offs don't need approval.
    if new.library_entry_id is null and new.source_pack_id is null then
      new.approval := case
        when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
        else 'pending'
      end;
    end if;
    return new;
  end if;
  if new.approval is distinct from old.approval or new.how_got is distinct from old.how_got then
    raise exception 'Only the GM approves items.' using errcode = '42501';
  end if;
  if new.name is distinct from old.name or new.category is distinct from old.category
    or new.weight_coin is distinct from old.weight_coin or new.slots is distinct from old.slots
    or new.stack is distinct from old.stack or new.per_units is distinct from old.per_units
    or new.library_entry_id is distinct from old.library_entry_id
    or new.source_pack_id is distinct from old.source_pack_id or new.source_entry_id is distinct from old.source_entry_id then
    raise exception 'Only the GM changes what an item is.' using errcode = '42501';
  end if;
  -- Magic armour's base is picked once; after that only the GM changes it.
  if new.base_armour_id is distinct from old.base_armour_id and old.base_armour_id is not null then
    raise exception 'Only the GM changes the base armour once it''s chosen.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 2. Tier lines when the rules change ------------------------------------------------------------------------------

-- Every character in the campaign that carries something (or has had a tier) gets its tier worked out again; a
-- changed one writes its line once (private.record_load_tier).
create function private.settle_campaign_tiers(campaign uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
begin
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return;
  end if;
  for actor in
    select a.id from public.actors a
    where a.campaign_id = campaign
      and (exists (select 1 from public.inventory_lines l where l.actor_id = a.id)
        or exists (select 1 from public.carrier_loads c where c.actor_id = a.id))
    order by a.id
  loop
    perform private.record_load_tier(actor);
  end loop;
end;
$$;
revoke execute on function private.settle_campaign_tiers(uuid) from public, anon, authenticated;

-- At the end of a change to the campaign's encumbrance settings, or to its attached setting rules (an optional rule,
-- the order, a pack attached or taken off). A fault here never stops the change: it stands, without its tier lines.
create function private.settle_tiers_on_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    if tg_table_name = 'campaigns' then
      perform private.settle_campaign_tiers(new.id);
    elsif tg_op = 'DELETE' then
      perform private.settle_campaign_tiers(old.campaign_id);
    elsif tg_op = 'INSERT' or new.option_choices is distinct from old.option_choices
      or new.priority is distinct from old.priority or to_jsonb(new) -> 'overrides' is distinct from to_jsonb(old) -> 'overrides' then
      perform private.settle_campaign_tiers(new.campaign_id);
    end if;
  exception when others then
    raise warning 'The tier lines were skipped: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function private.settle_tiers_on_rules() from public, anon, authenticated;

create constraint trigger settle_tiers_on_rules after update on public.campaigns
  deferrable initially deferred
  for each row when (new.settings -> 'encumbrance' is distinct from old.settings -> 'encumbrance')
  execute function private.settle_tiers_on_rules();
create constraint trigger settle_tiers_on_rules after insert or update or delete on public.campaign_packs
  deferrable initially deferred
  for each row execute function private.settle_tiers_on_rules();

-- 3. Magic armour's chosen base --------------------------------------------------------------------------------------

alter table public.inventory_lines add column base_armour_id text check (char_length(base_armour_id) between 1 and 200);

-- The base must be one of the item's own choices (its armour.baseArmour.choose). Named to run after the item's
-- details are copied in (copy_item_details), since before-triggers run in name order.
create function private.verify_base_armour() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.base_armour_id is not null
    and (tg_op = 'INSERT' or new.base_armour_id is distinct from old.base_armour_id)
    and not coalesce(
      jsonb_typeof(new.item_data #> '{armour,baseArmour,choose}') = 'array'
        and (new.item_data #> '{armour,baseArmour,choose}') ? new.base_armour_id,
      false) then
    raise exception 'That isn''t one of this armour''s bases.';
  end if;
  return new;
end;
$$;
revoke execute on function private.verify_base_armour() from public, anon, authenticated;
create trigger verify_base_armour before insert or update on public.inventory_lines
  for each row execute function private.verify_base_armour();

-- Choosing it later (the item's sheet, or "Choose base armour" on AC) is its own logged command.
insert into public.logged_commands (name, level, gm_only) values ('inventory.setBaseArmour', 'simple', false);

-- 4. Check again ----------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('check.again', 'verbose', true);
insert into public.undoable_makings (name) values ('check.again');
