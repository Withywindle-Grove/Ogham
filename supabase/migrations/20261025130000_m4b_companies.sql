-- M4b step 1h: companies belong to the players (rulings 33 and 33b, 2026-10-24; docs/04, 05 "Companies").
-- Adds a column, a table and five functions; replaces the character guard; adds logged commands. Drops nothing.
--   A player whose character has no company founds one (with optional co-founders, each invited and answering)
--   or asks to join one; a company invites characters without a company; any member answers an ask until M8,
--   when the charter decides. One company per character. The GM can do any of it, and still does by fiat.
--   companies.founder_ids records the founders (for M8's charter).
--   campaigns.settings.companies = false switches companies off: nothing here works while they're off.
-- Characters change company only through these functions (or the GM): the character guard lets them through
-- with a transaction-local flag, as the stack split does (grimoire.splitting).

alter table public.companies add column founder_ids uuid[] not null default '{}';

create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid not null references public.actors (id) on delete cascade,
  kind text not null check (kind in ('cofounder', 'invite', 'ask')),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index company_invitations_campaign_idx on public.company_invitations (campaign_id);
create unique index company_invitations_one_open on public.company_invitations (company_id, actor_id) where status = 'open';
alter table public.company_invitations enable row level security;
grant select on public.company_invitations to authenticated;
grant select, insert, update, delete on public.company_invitations to service_role;
-- Everyone in the campaign sees them (they're about the party); changes go through the functions below.
create policy "company invitations: campaign members read" on public.company_invitations
  for select to authenticated using (private.is_member(campaign_id));
create trigger stamp before insert or update on public.company_invitations for each row execute function private.stamp_row();
create trigger log_change after insert or update or delete on public.company_invitations
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.company_invitations
  for each row execute function private.refuse_when_retired();

-- As in 20261019190000_m1_remove_characters.sql, plus: a company function may move a character into a company.
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
  if new.review_note is distinct from old.review_note then
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

-- Whether the campaign has companies switched on (the default).
create function private.companies_on(campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.settings -> 'companies' from public.campaigns c where c.id = campaign), 'true'::jsonb) <> 'false'::jsonb;
$$;
revoke execute on function private.companies_on(uuid) from public, anon;
grant execute on function private.companies_on(uuid) to authenticated, service_role;

-- A character the caller may act for: their own approved, active character, or any character for the GM.
create function private.may_act_for(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.actors a
    where a.id = actor and a.status <> 'archived'
      and (private.is_gm(a.campaign_id) or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid()) and a.approval = 'approved'))
  );
$$;
revoke execute on function private.may_act_for(uuid) from public, anon;
grant execute on function private.may_act_for(uuid) to authenticated, service_role;

-- Moves a character into a company (no company before), past the character guard.
create function private.join_company(actor uuid, company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('grimoire.joining', actor::text, true);
  update public.actors set company_id = company where id = actor and company_id is null;
  if not found then
    perform set_config('grimoire.joining', '', true);
    raise exception 'That character is already in a company.';
  end if;
  perform set_config('grimoire.joining', '', true);
  -- One company per character: whatever else was open for them closes.
  update public.company_invitations set status = 'cancelled' where actor_id = actor and status = 'open';
end;
$$;
revoke execute on function private.join_company(uuid, uuid) from public, anon, authenticated;

-- Found a company: its name, the founder, and co-founders invited (each answers).
create function public.found_company(actor uuid, company_name text, cofounders uuid[] default '{}') returns uuid
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
      where a.id = other and a.campaign_id = founder.campaign_id and a.company_id is null and a.approval = 'approved' and a.status <> 'archived'
    ) then
      insert into public.company_invitations (campaign_id, company_id, actor_id, kind) values (founder.campaign_id, made, other, 'cofounder');
    end if;
  end loop;
  return made;
end;
$$;
revoke execute on function public.found_company(uuid, text, uuid[]) from public, anon;
grant execute on function public.found_company(uuid, text, uuid[]) to authenticated, service_role;

-- Ask to join (a character without a company), or invite one (a member of the company, or the GM).
create function public.ask_or_invite(company uuid, actor uuid, ask boolean) returns uuid
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
  elsif not (private.is_gm(co.campaign_id) or exists (
    select 1 from public.actors m where m.company_id = company and m.owner_type = 'user' and m.owner_user_id = (select auth.uid()) and m.status <> 'archived'
  )) then
    raise exception 'Only the company''s members invite.' using errcode = '42501';
  end if;
  insert into public.company_invitations (campaign_id, company_id, actor_id, kind)
  values (co.campaign_id, company, actor, case when ask then 'ask' else 'invite' end)
  returning id into made;
  return made;
end;
$$;
revoke execute on function public.ask_or_invite(uuid, uuid, boolean) from public, anon;
grant execute on function public.ask_or_invite(uuid, uuid, boolean) to authenticated, service_role;

-- Answer: an invitation by the invited character's player; an ask by any member of the company (until M8);
-- the GM answers anything. Accepting moves the character in; a co-founder joins the founders.
create function public.answer_invitation(invitation uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  inv public.company_invitations;
begin
  select * into inv from public.company_invitations i where i.id = invitation;
  if inv.id is null or inv.status <> 'open' then
    raise exception 'That isn''t waiting any more.';
  end if;
  if not private.companies_on(inv.campaign_id) then
    raise exception 'Companies are switched off in this campaign.';
  end if;
  if not (
    private.is_gm(inv.campaign_id)
    or (inv.kind in ('invite', 'cofounder') and private.may_act_for(inv.actor_id))
    or (inv.kind = 'ask' and exists (
      select 1 from public.actors m where m.company_id = inv.company_id and m.owner_type = 'user' and m.owner_user_id = (select auth.uid()) and m.status <> 'archived'
    ))
  ) then
    raise exception 'That isn''t yours to answer.' using errcode = '42501';
  end if;
  update public.company_invitations set status = case when accept then 'accepted' else 'declined' end where id = invitation;
  if accept then
    perform private.join_company(inv.actor_id, inv.company_id);
    if inv.kind = 'cofounder' then
      update public.companies set founder_ids = array_append(founder_ids, inv.actor_id) where id = inv.company_id;
    end if;
  end if;
end;
$$;
revoke execute on function public.answer_invitation(uuid, boolean) from public, anon;
grant execute on function public.answer_invitation(uuid, boolean) to authenticated, service_role;

-- Take back an open ask or invitation: whoever made it, or the GM.
create function public.cancel_invitation(invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  inv public.company_invitations;
begin
  select * into inv from public.company_invitations i where i.id = invitation;
  if inv.id is null or inv.status <> 'open' then
    raise exception 'That isn''t waiting any more.';
  end if;
  if not (private.is_gm(inv.campaign_id) or inv.created_by = (select auth.uid())) then
    raise exception 'Only whoever sent it can take it back.' using errcode = '42501';
  end if;
  update public.company_invitations set status = 'cancelled' where id = invitation;
end;
$$;
revoke execute on function public.cancel_invitation(uuid) from public, anon;
grant execute on function public.cancel_invitation(uuid) to authenticated, service_role;

insert into public.logged_commands (name, level, gm_only) values
  ('company.found', 'simple', false),
  ('company.ask', 'simple', false),
  ('company.invite', 'simple', false),
  ('company.answer', 'simple', false),
  ('company.cancel', 'simple', false);
