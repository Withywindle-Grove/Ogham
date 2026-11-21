-- M5b step 0c, slice 1: creation data (docs/plans/m5b-0c-creation-rebuild.md, build order 1; design/rulings/
-- m5b-0c-creation-rebuild-2026-11-01.md cr-7, cr-12, cr-13, cr-22; docs/04 PC extras; docs/07 "Creation rules as data").
--   1. actors.spell_book: the character's known spells as a list of spell ids (cr-13, cr-25: a list only; prepare,
--      cast and Lost when hit stay in M7). Set by creation.spellBook.set: the owner while the character isn't approved
--      yet, or while "spells" is still on its To finish list (Decide later); the GM always. Logged like any edit.
--   2. Alignment visibility (cr-12, cr-22; 03): a character's alignment lives in its own table,
--      character_alignments, which players read only as the setting allows. The rules set's `alignmentVisibility`
--      is "owner" (its owner and the GM) or "all" (the default). The app still writes it as the field "alignment"
--      on actors.fields: a trigger moves it into the table before the row is saved, so actors.fields never carries
--      it and the row-level rule, not the screen, decides who sees it (hard rule 5). Its log lines are the owner's
--      and the GM's. Existing values move too (nothing is lost: the same value, in the new table).
--   3. Request kind allowChoice (cr-7): "Ask the GM to allow it" for a race or class the character's scores (or
--      race) don't allow; the GM answers Yes / No from Waiting for you like any request (creation.askAllow sends it).
--   4. Rows in logged_commands (creation.spellBook.set, creation.askAllow) and undoable_tables (character_alignments).
-- Adds one column, one table, four functions, three triggers, one policy; replaces one check constraint on requests
-- (the list of kinds, one longer). Drops, renames and deletes nothing.

-- 1. The spell book ----------------------------------------------------------------------------------------------------

alter table public.actors
  add column spell_book jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(spell_book) = 'array'
      and jsonb_array_length(spell_book) <= 200
      and pg_column_size(spell_book) <= 8000
      and not jsonb_path_exists(spell_book, '$[*] ? (@.type() != "string")')
    );

-- Each spell once, with a short id. Who sets it: the GM always; the owner while the character isn't approved, or
-- while its creation record still lists "spells" to finish (Decide later on First spells). An undo may always put
-- it back.
create function private.guard_spell_book() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.spell_book is not distinct from old.spell_book then
    return new;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(new.spell_book) as spell
    where length(spell) not between 1 and 80
  ) or (
    select count(*) from jsonb_array_elements_text(new.spell_book)
  ) <> (
    select count(distinct spell) from jsonb_array_elements_text(new.spell_book) as spell
  ) then
    raise exception 'Each spell goes in the book once.' using errcode = '23514';
  end if;
  if (select auth.uid()) is null
    or nullif(current_setting('grimoire.reverting', true), '') is not null
    or private.is_gm(old.campaign_id)
    or old.approval <> 'approved'
    or (jsonb_typeof(old.creation -> 'toFinish') = 'array' and old.creation -> 'toFinish' ? 'spells') then
    return new;
  end if;
  raise exception 'Only the GM can change the spell book once the character is approved.' using errcode = '42501';
end;
$$;

create trigger guard_spell_book before update of spell_book on public.actors
  for each row execute function private.guard_spell_book();

-- 2. Alignment visibility ---------------------------------------------------------------------------------------------

create table public.character_alignments (
  -- Deferred so the trigger below can write the row while the character itself is still being inserted.
  actor_id uuid primary key references public.actors (id) on delete cascade deferrable initially deferred,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The character's owner (null for the GM's own), kept here so the log line's audience never needs the actor row.
  owner_user_id uuid references public.profiles (id) on delete set null,
  alignment text not null check (length(alignment) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index character_alignments_campaign on public.character_alignments (campaign_id);

alter table public.character_alignments enable row level security;
grant select on public.character_alignments to authenticated;
grant select, insert, update, delete on public.character_alignments to service_role;

-- Whether the campaign's setting lets everyone see alignments: the top rules set attached (homebrew first, then by
-- priority) that says `alignmentVisibility`; "all" when none says.
create function private.alignment_visible_to_all(campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e.data ->> 'alignmentVisibility'
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    where cp.campaign_id = campaign and e.data ? 'alignmentVisibility'
    order by (p.kind = 'homebrew') desc, cp.priority desc, cp.created_at desc
    limit 1
  ), 'all') <> 'owner';
$$;
revoke execute on function private.alignment_visible_to_all(uuid) from public, anon;
grant execute on function private.alignment_visible_to_all(uuid) to authenticated, service_role;

-- Who reads a character's alignment: its owner; the GM (not another's draft, like the character itself); any
-- member, when the setting says all and the character is approved (the only ones other players see at all).
create function private.may_read_alignment(actor uuid, campaign uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (owner is not null and owner = (select auth.uid()))
    or (private.is_gm(campaign) and not private.is_others_draft(actor))
    or (
      private.is_member(campaign)
      and private.alignment_visible_to_all(campaign)
      and exists (select 1 from public.actors a where a.id = actor and a.approval = 'approved')
    );
$$;
revoke execute on function private.may_read_alignment(uuid, uuid, uuid) from public, anon;
grant execute on function private.may_read_alignment(uuid, uuid, uuid) to authenticated, service_role;

create policy "character alignments: read as the setting allows" on public.character_alignments
  for select to authenticated using (private.may_read_alignment(actor_id, campaign_id, owner_user_id));

-- Its log lines: the owner's and the GM's (the GM reads every line), whatever the setting says.
create function private.log_audience_character_alignments(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  owner := (this_row ->> 'owner_user_id')::uuid;
  who_sees := case when owner is null then 'gm' else 'owner' end;
end;
$$;
revoke execute on function private.log_audience_character_alignments(jsonb, jsonb) from public, anon, authenticated;

create trigger log_change after insert or update or delete on public.character_alignments
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.character_alignments
  for each row execute function private.refuse_when_retired();

insert into public.undoable_tables (name) values ('character_alignments');

-- The split: the field "alignment" never stays on actors.fields. A value goes to character_alignments (made or
-- changed); an empty one takes the row away; a save that doesn't mention the field leaves the row as it is.
create function private.split_alignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  value text;
begin
  if new.fields is null or jsonb_typeof(new.fields) <> 'object' or not (new.fields ? 'alignment') then
    return new;
  end if;
  value := left(nullif(trim(new.fields ->> 'alignment'), ''), 80);
  new.fields := new.fields - 'alignment';
  if value is null then
    delete from public.character_alignments c where c.actor_id = new.id;
  else
    insert into public.character_alignments as c (actor_id, campaign_id, owner_user_id, alignment)
      values (new.id, new.campaign_id, case when new.owner_type = 'user' then new.owner_user_id end, value)
      on conflict (actor_id) do update
        set alignment = excluded.alignment, owner_user_id = excluded.owner_user_id, updated_at = now()
        where c.alignment is distinct from excluded.alignment or c.owner_user_id is distinct from excluded.owner_user_id;
  end if;
  return new;
end;
$$;
revoke execute on function private.split_alignment() from public, anon, authenticated;

create trigger split_alignment before insert or update of fields on public.actors
  for each row execute function private.split_alignment();

-- Existing characters: the same value moves into the new table. Not a change anyone made, so it isn't logged; a
-- retired campaign's characters move too.
alter table public.actors disable trigger log_change;
alter table public.actors disable trigger refuse_when_retired;
alter table public.character_alignments disable trigger log_change;
alter table public.character_alignments disable trigger refuse_when_retired;
update public.actors a set fields = a.fields where a.fields ? 'alignment';
-- The new rows' link to their character is checked at commit (deferred); run those checks now, or turning the
-- triggers back on is refused ("pending trigger events"; added 2026-11-02, as in the g5 fix, Francis's OK).
set constraints all immediate;
alter table public.character_alignments enable trigger refuse_when_retired;
alter table public.character_alignments enable trigger log_change;
alter table public.actors enable trigger refuse_when_retired;
alter table public.actors enable trigger log_change;

-- 3. Ask the GM to allow a race or class ----------------------------------------------------------------------------------

alter table public.requests drop constraint requests_kind_check;
alter table public.requests add constraint requests_kind_check
  check (kind in ('describe', 'escapeRoll', 'secretActivity', 'buy', 'sell', 'lodging', 'askGm', 'allowChoice'));

-- 4. Logged commands -------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('creation.spellBook.set', 'simple', false),
  ('creation.askAllow', 'simple', false);
