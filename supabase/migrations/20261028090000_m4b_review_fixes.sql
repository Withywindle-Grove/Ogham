-- M4b post-gate review fixes. Replaces seven functions, adds two size checks and one function (use_ability).
-- Drops no data: the size checks only refuse new writes that are too big (every row today is far below them).
--   1. Sending a draft checks the start-level limit, as making a character does (a draft made before the limit
--      changed, or before the party's lowest went down, could otherwise join above it).
--   2. After approval, the one-time starting-gear spend must be a whole number, 0 or more, and the coin it's
--      counted in can't change once it's recorded.
--   3. What a character has prepared and the uses it has spent are capped in size, like actors.creation.
--   4. use_ability changes one ability's count in the database, so two taps at once don't overwrite each other.
--   5. Companies invite (and found with) only approved player characters still in play.
--   6. The log entries of a draft its owner deleted before sending stay hidden from the GM (decided from the
--      deletion's own log entry, which records that it was a draft).
--   7. An undo refusal doesn't name someone else's draft: it says "someone".

-- 1. As in 20261026130000_m4b_draft.sql, plus the start-level limit (as private.new_character_rules).
create or replace function private.send_draft() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  setting jsonb;
  limit_level integer;
begin
  if old.approval <> 'draft' or new.approval <> 'pending' or new.owner_type <> 'user' or new.kind <> 'pc' then
    return new;
  end if;
  if (select auth.uid()) is not null and not private.is_gm(new.campaign_id) then
    limit_level := private.start_level_limit(new.campaign_id);
    if limit_level is not null and new.level > limit_level then
      raise exception 'New characters here start at level % or lower.', limit_level using errcode = '42501';
    end if;
  end if;
  select c.settings into setting from public.campaigns c where c.id = new.campaign_id;
  if setting -> 'characterApproval' = 'false'::jsonb
    and (coalesce(setting ->> 'startLevel', 'propose') not in ('propose', 'gm') or new.level <= private.party_lowest(new.campaign_id)) then
    new.approval := 'approved';
  end if;
  return new;
end;
$$;

-- 2. As in 20261025210000_m4b_starting_gear.sql, but the spend is a whole number, 0 or more, and a coin already
-- recorded stays as it is.
create or replace function private.guard_creation_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(old.campaign_id) then
    return new;
  end if;
  if old.approval = 'approved' and new.creation is distinct from old.creation
    and not (
      not (old.creation ? 'spentBase')
      and (new.creation - 'spentBase' - 'moneyCoin') = (old.creation - 'moneyCoin')
      and jsonb_typeof(new.creation -> 'spentBase') = 'number'
      and (new.creation ->> 'spentBase')::numeric >= 0
      and (new.creation ->> 'spentBase')::numeric = trunc((new.creation ->> 'spentBase')::numeric)
      and (not (old.creation ? 'moneyCoin') or new.creation -> 'moneyCoin' is not distinct from old.creation -> 'moneyCoin')
    ) then
    raise exception 'Only the GM can change how an approved character was made.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3. Like actors.creation (20261025180000_m4b_creation_record.sql).
alter table public.character_play add constraint character_play_prepared_size check (pg_column_size(prepared) <= 4000);
alter table public.character_play add constraint character_play_uses_spent_size check (pg_column_size(uses_spent) <= 4000);

-- 4. Mark a use spent or give one back: only this ability's count changes (0 removes it). Runs as the caller, so
-- the character_play rules apply (the owner or the GM, an approved character, not in a retired campaign) and the
-- change is logged under the caller's command.
create function public.use_ability(actor uuid, ability text, spent integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  campaign uuid;
  now_spent jsonb;
begin
  if ability is null or char_length(ability) not between 1 and 200 then
    raise exception 'Which ability?';
  end if;
  if spent is null or spent < 0 then
    raise exception 'Uses spent must be a whole number, 0 or more.';
  end if;
  select a.campaign_id into campaign from public.actors a where a.id = actor;
  if campaign is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  insert into public.character_play as p (actor_id, campaign_id, uses_spent)
  values (actor, campaign, case when spent = 0 then '{}'::jsonb else jsonb_build_object(ability, spent) end)
  on conflict (actor_id) do update
    set uses_spent = case when spent = 0 then p.uses_spent - ability else jsonb_set(p.uses_spent, array[ability], to_jsonb(spent)) end
  returning p.uses_spent into now_spent;
  return now_spent;
end;
$$;
revoke execute on function public.use_ability(uuid, text, integer) from public, anon;
grant execute on function public.use_ability(uuid, text, integer) to authenticated, service_role;

-- 5. As in 20261025130000_m4b_companies.sql, but co-founders are approved player characters still in play.
create or replace function public.found_company(actor uuid, company_name text, cofounders uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  founder public.actors;
  made uuid;
  other uuid;
begin
  select * into founder from public.actors a where a.id = actor;
  if founder.id is null or not private.may_act_for(actor) then
    raise exception 'You can''t found a company for that character.' using errcode = '42501';
  end if;
  if not private.companies_on(founder.campaign_id) then
    raise exception 'Companies are switched off in this campaign.';
  end if;
  if founder.company_id is not null then
    raise exception 'That character is already in a company.';
  end if;
  if length(trim(coalesce(company_name, ''))) = 0 then
    raise exception 'Give the company a name.';
  end if;
  insert into public.companies (campaign_id, name, created_by, founder_ids)
  values (founder.campaign_id, trim(company_name), (select auth.uid()), array[actor])
  returning id into made;
  perform private.join_company(actor, made);
  foreach other in array coalesce(cofounders, '{}') loop
    if other <> actor and exists (
      select 1 from public.actors a
      where a.id = other and a.campaign_id = founder.campaign_id and a.company_id is null
        and a.kind = 'pc' and a.approval = 'approved' and a.status <> 'archived'
    ) then
      insert into public.company_invitations (campaign_id, company_id, actor_id, kind) values (founder.campaign_id, made, other, 'cofounder');
    end if;
  end loop;
  return made;
end;
$$;

-- As in 20261025130000_m4b_companies.sql, but an invitation goes only to an approved player character still in play.
create or replace function public.ask_or_invite(company uuid, actor uuid, ask boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target public.actors;
  co public.companies;
  made uuid;
begin
  select * into co from public.companies c where c.id = company;
  select * into target from public.actors a where a.id = actor;
  if co.id is null or target.id is null or co.campaign_id <> target.campaign_id then
    raise exception 'That company or character isn''t here.';
  end if;
  if not private.companies_on(co.campaign_id) then
    raise exception 'Companies are switched off in this campaign.';
  end if;
  if target.company_id is not null then
    raise exception 'That character is already in a company.';
  end if;
  if ask then
    if not private.may_act_for(actor) then
      raise exception 'You can''t ask for that character.' using errcode = '42501';
    end if;
  else
    if not (private.is_gm(co.campaign_id) or exists (
      select 1 from public.actors m where m.company_id = company and m.owner_type = 'user' and m.owner_user_id = (select auth.uid()) and m.status <> 'archived'
    )) then
      raise exception 'Only the company''s members invite.' using errcode = '42501';
    end if;
    if not (target.kind = 'pc' and target.approval = 'approved' and target.status <> 'archived') then
      raise exception 'Only approved characters still in play can be invited.';
    end if;
  end if;
  insert into public.company_invitations (campaign_id, company_id, actor_id, kind)
  values (co.campaign_id, company, actor, case when ask then 'ask' else 'invite' end)
  returning id into made;
  return made;
end;
$$;

-- 6. Someone else's draft, now, or when it was deleted (its deletion's log entry keeps the whole row, so it
-- records that it was a draft and whose). A draft that was sent isn't a draft any more, so its history shows.
create function private.was_others_draft(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when actor is null then false
    when exists (select 1 from public.actors a where a.id = actor) then private.is_others_draft(actor)
    else exists (
      select 1 from public.events d
      where d.target_table = 'actors' and d.target_id = actor and d.after is null
        and d.before ->> 'approval' = 'draft'
        and (d.before ->> 'owner_user_id')::uuid is distinct from (select auth.uid())
    )
  end;
$$;
revoke execute on function private.was_others_draft(uuid) from public, anon;
grant execute on function private.was_others_draft(uuid) to authenticated, service_role;

-- As in 20261026130000_m4b_draft.sql, but a line or character that's gone is looked up in the log, not live.
create or replace function private.is_others_draft_event(target_table text, target uuid, row_values jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.was_others_draft(case target_table
    when 'actors' then target
    when 'inventory_lines' then coalesce(
      (row_values ->> 'actor_id')::uuid,
      (select l.actor_id from public.inventory_lines l where l.id = target),
      (select coalesce(e.after ->> 'actor_id', e.before ->> 'actor_id')::uuid from public.events e
       where e.target_table = 'inventory_lines' and e.target_id = target
         and coalesce(e.after ->> 'actor_id', e.before ->> 'actor_id') is not null
       order by e.seq desc limit 1))
    else null
  end);
$$;

-- 7. As in 20261026171000_m4b_undo_whats_left_rules.sql, but someone else's draft is "someone".
create or replace function private.holder_name(actor uuid, place uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select a.name from public.actors a where a.id = actor and not private.is_others_draft(a.id)),
                  (select c.name from public.locations c where c.id = place), 'someone');
$$;
