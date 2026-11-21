-- B15 of docs/plans/scene-point-to-point.md: a magic item's truth as a piece (p2p-29; page 30, pg30-4, approved
-- 2026-11-20, docs/design/rulings/page-30-b15-hoard-and-magic-item-2026-11-20.md). The GM taps the eye of a magic
-- item's piece: the piece is shown to the group, and the item, wherever it is held, carries its real name and powers.
-- Hidden means hidden (hard rule 5): nothing of the piece, and not the item's real name, reaches a player before the
-- eye; after the show's Undo neither is readable, not even from the log.
--
-- How, plainly. The truth stays where it already is, on the place's piece (place_pieces: the GM's alone; players read
-- a piece only while it is shown, through public.scene_pieces). The show writes one thing onto each item's line: a
-- pointer to that piece (`item_data.truthPiece`, the piece's id). The pointer is not a secret: its log line carries an
-- id and nothing else, so after Undo (the pointer taken off again) nothing of the truth is left in what a player reads.
-- A later hide changes the piece's show only; the pointer stays, so the item stays as the players now know it (05: a
-- fact revealed once stays revealed).
--
-- A split party (b15f-6, Francis 2026-11-20: "No, group A only"; hidden stays hidden). While the party is split, the
-- eye names the item only on lines held by a character (or hireling) of the group being shown the piece, or by one shown
-- it by an earlier show during a split; and a player reads a line's truth only through a show that counts for them. A
-- line held in another group stays plain (no pointer) until the GM shows the piece to that group too; a send follows
-- the same rule (named only if the receiver's group has been shown the piece); the party stash, which no group holds,
-- stays plain while the party is split. Undo and a later hide work per show, so per group.
--
-- Which shows count for whom (the local review of the third fix, findings 1 and 3). Each show records, when it is made,
-- whom it was shown to (piece_shows.shown_to, below): nobody named (null) if the party was one group then, otherwise the
-- characters and hirelings in the shown group at that moment. Then:
--   - a show made while the party was one group counts for everyone, for good, through any later split (05: a fact
--     revealed once stays revealed);
--   - a show made during a split counts, while the party is split, only for the players of the characters it was shown
--     to (whatever group they are in now): a group's number is never compared, so a number used again by a later split
--     picks up nothing;
--   - while the party is one group, every show counts for everyone (as public.scene_pieces shows a group that joins
--     another what that group was shown): every line that carries a pointer is named for every player; a line that was
--     held in the other group keeps its plain name until the GM's eye names it;
--   - a show made during a split and shown again while the party is one group (the eye on it, or a hide and a show:
--     the same row, while it is still the group's visit) counts for everyone from then on, for good: its shown_to
--     becomes null (finding 1 of the fourth fix's local review; 05: a fact revealed once stays revealed). One way only.
--
-- Add-only. Drops, renames and deletes nothing; no policy changes; one column and one trigger are added to
-- public.piece_shows, and private.piece_show_rules gains the one change it allows to that column.
--   0. private.party_split: whether the party is split now (more than one group among the approved, active
--      characters and hirelings, as private.tidy_party_groups counts them). piece_shows.shown_to, filled once by a
--      trigger when a show is made (null while the party is one group; a value sent in is replaced). Afterwards
--      private.piece_show_rules allows it one change only: to null, when the row is shown again while the party is one
--      group (an Undo of that puts back what its log line had). Any other change is refused, so neither the GM nor an
--      Undo can rewrite whom a show reached. While the party is one group the GM can also clear it on a shown row with a
--      plain update of piece_shows, without showing it again: that is the GM's own reveal to everyone, logged and
--      undoable like any change, so nothing leaks (intended; the eye on a shown piece does the same).
--   1. public.show_item_truth (place.showItemTruth, the GM's): in ONE request, the piece shown to the group's visit (by
--      public.show_place_piece, unchanged) and the pointer written onto the given lines of this campaign (while split,
--      only those held by a character or hireling in the visit's group or named by a show of this piece not undone).
--      Undo is the generic Undo of that request (public.undo_request), which takes back both.
--   2. public.item_truths: for the lines the caller may read (the same rule as the lines' own policy), the truth their
--      pointer names: the piece's lead (the item's real name) and its body (what it does, as written). Nothing else:
--      no source, and never anything from the piece's gm_value (b15f-4, docs/design/rulings/b15-build-flags-2026-11-20.md;
--      the pack's magicItem.source is not stored on the piece at all). Only a pointer the GM wrote counts: a log line,
--      by a GM of the campaign and not undone, of the GM's eye (place.showItemTruth) or of a send that named the item
--      (find.give), on that line, writing that pointer; or a part split off a line where it counts, however many splits
--      down (public.split_inventory_line copies item_data onto the new line in the same request as the source's smaller
--      count), so a named stack split or partly given keeps its name (pg30-4). A player who makes up such a "split" by
--      hand can only copy a pointer that already counts on a line of their own, so it reads nothing they don't already
--      read; and the per-reader show check below still applies. Players never write log lines (only the database's triggers
--      do), and a player may type a one-off's item_data when making it (only the GM may change an existing line's
--      item_data, 20261023180000_m4_reveal.sql), so a pointer a player writes reads nothing, whatever piece it points at
--      (the reviews of #1101). And only a piece shaped as a magic item's truth (kind 'other', with a lead), still there,
--      shown and not undone; show_item_truth refuses any other piece. Which show counts for whom: above; the GM always.
--   3. The command's row in public.logged_commands, and in public.undoable_makings (as place.showPiece: its Undo marks
--      the show it made undone, never removed).

-- 0. Is the party split? ------------------------------------------------------------------------------------------------

-- Security invoker: the reader's own reads (members read the groups and the characters in play), so someone outside
-- the campaign learns nothing (false).
create function private.party_split(campaign uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select count(distinct m.group_number) > 1
  from public.party_group_members m join public.actors a on a.id = m.actor_id
  where m.campaign_id = campaign and a.approval = 'approved' and a.status = 'active';
$$;
revoke execute on function private.party_split(uuid) from public, anon;
grant execute on function private.party_split(uuid) to authenticated, service_role;

-- Whom a show reached: null when it was made while the party was one group (it counts for everyone, for good);
-- otherwise the approved, active characters and hirelings in the shown group at that moment. Set once, when the show is
-- made, whoever makes it (the GM's eye, a plain show, the copy a return visit or a split makes): a value sent in is
-- replaced. Afterwards private.piece_show_rules (below) allows one change only: to null, on a show again while the
-- party is one group.
alter table public.piece_shows add column shown_to uuid[];
comment on column public.piece_shows.shown_to is
  'B15 (findings 1 and 3 of the third fix''s review): whom this show reached. Null: made while the party was one group, so it counts for everyone. Otherwise the characters and hirelings in the shown group when it was made. Set by the trigger piece_show_who_saw when the show is made (a value sent in is replaced). Afterwards it changes one way only, to null, on a row shown and not undone while the party is one group (private.piece_show_rules: a show again does it by itself); an Undo may put back what its own log line had on this row. Any other change is refused.';

-- Security definer: it reads the whole campaign's groups whoever shows the piece. Runs after piece_show_rules (triggers
-- of one kind fire in name order: "piece_show_rules" < "piece_show_who_saw"), which sets the show's group_number.
create function private.piece_show_who_saw() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.shown_to := case when private.party_split(new.campaign_id) then coalesce((
    select array_agg(m.actor_id order by m.actor_id)
    from public.party_group_members m join public.actors a on a.id = m.actor_id
    where m.campaign_id = new.campaign_id and m.group_number = new.group_number
      and a.approval = 'approved' and a.status = 'active'
  ), '{}'::uuid[]) end;
  return new;
end;
$$;
revoke execute on function private.piece_show_who_saw() from public, anon, authenticated;
create trigger piece_show_who_saw before insert on public.piece_shows
  for each row execute function private.piece_show_who_saw();

-- builds on: private.piece_show_rules from 20261102100000_m5b_g2_place_pieces.sql
-- As there (a show: a piece of the visit's place, in the visit's campaign, for the visit's group; a change: shown and
-- when, or undo's mark), plus whom it reached (shown_to), which changes one way only: to null, when the row is shown
-- again (or, by the GM's eye, while still shown) while the party is one group. A plain show again does it by itself
-- (shown from false to true while the party is one group, not in an Undo); the eye asks for it. An Undo may put back
-- exactly what its own log line had on this row. Anything else sent for shown_to is refused: another list, an empty
-- one, or null while the party is split or on a row not shown.
create or replace function private.piece_show_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  visit public.group_places;
  reverting text := nullif(current_setting('grimoire.reverting', true), '');
begin
  if tg_op = 'INSERT' then
    select * into visit from public.group_places gp where gp.id = new.group_place_id;
    if visit.id is null or visit.campaign_id is distinct from new.campaign_id then
      raise exception 'That place isn''t in this campaign.';
    end if;
    if not exists (select 1 from public.place_pieces pc where pc.id = new.piece_id and pc.place_id is not distinct from visit.place_id) then
      raise exception 'That piece isn''t in this place.';
    end if;
    new.group_number := visit.group_number;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That was undone.';
  end if;
  if (to_jsonb(new) - 'shown' - 'shown_at' - 'undone' - 'updated_at' - 'shown_to') is distinct from (to_jsonb(old) - 'shown' - 'shown_at' - 'undone' - 'updated_at' - 'shown_to') then
    raise exception 'That can''t be changed.';
  end if;
  if new.shown_to is distinct from old.shown_to then
    if not (
      -- The one way: to null, on a row shown and not undone, while the party is one group.
      (new.shown_to is null and new.shown and not new.undone and not private.party_split(new.campaign_id))
      -- An Undo putting back what its own log line on this row had.
      or exists (
        select 1 from public.events e
        where reverting is not null and e.id::text = reverting
          and e.target_table = 'piece_shows' and e.target_id = old.id
          and e.before ? 'shown_to' and e.before -> 'shown_to' = coalesce(to_jsonb(new.shown_to), 'null'::jsonb)
      )
    ) then
      raise exception 'That can''t be changed.';
    end if;
  elsif new.shown and not old.shown and not new.undone and old.shown_to is not null and reverting is null
    and not private.party_split(new.campaign_id) then
    -- Shown again while the party is one group: it counts for everyone from now on.
    new.shown_to := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.piece_show_rules() from public, anon, authenticated;

-- 1. The show -----------------------------------------------------------------------------------------------------------

create function public.show_item_truth(visit uuid, piece uuid, lines uuid[]) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  here public.group_places;
  named integer := 0;
begin
  select * into here from public.group_places gp where gp.id = visit;
  if here.id is null or not private.is_gm(here.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- Only a piece shaped as a magic item's truth (07 magicItem: kind 'other', led by the real name).
  if not exists (
    select 1 from public.place_pieces pc
    where pc.id = piece and pc.campaign_id = here.campaign_id and pc.kind = 'other' and coalesce(trim(pc.lead), '') <> ''
  ) then
    raise exception 'Only a magic item''s piece can name an item.';
  end if;
  -- The piece first: show_place_piece checks the visit is the group's current one and the piece is at its place.
  perform public.show_place_piece(visit, piece, true);
  -- Shown again while the party is one group: a show this visit made during a split now counts for everyone, for good
  -- (a show from hidden has had it done by private.piece_show_rules already; this is the eye on one still shown).
  if not private.party_split(here.campaign_id) then
    update public.piece_shows s set shown_to = null
    where s.group_place_id = visit and s.piece_id = piece and not s.undone and s.shown and s.shown_to is not null;
  end if;
  -- Then the item, wherever it is held now: only this campaign's lines, and each once. While the party is split, only
  -- a line held by a character or hireling of this visit's group, or by one a show of this piece made during a split
  -- (not undone) was shown to: hidden stays hidden (b15f-6). A show's group number is never compared, so an old show
  -- to a number a later split uses again reaches no one new (finding 3). A show made while the party was one group
  -- (shown_to null) names no line in another group: the eye during a split names its own group's.
  update public.inventory_lines l
  set item_data = (case when jsonb_typeof(l.item_data) = 'object' then l.item_data else '{}'::jsonb end)
    || jsonb_build_object('truthPiece', piece::text)
  where l.id = any (coalesce(lines, '{}'))
    and l.campaign_id = here.campaign_id
    and (l.item_data ->> 'truthPiece') is distinct from piece::text
    and (
      not private.party_split(here.campaign_id)
      or exists (
        select 1 from public.party_group_members m
        where m.actor_id = l.actor_id and m.campaign_id = here.campaign_id and m.group_number = here.group_number
      )
      or exists (
        select 1 from public.piece_shows s
        where s.piece_id = piece and s.campaign_id = here.campaign_id and not s.undone and l.actor_id = any (s.shown_to)
      )
    );
  get diagnostics named = row_count;
  return named;
end;
$$;
revoke execute on function public.show_item_truth(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.show_item_truth(uuid, uuid, uuid[]) to authenticated, service_role;

-- 2. What a reader learns of an item ------------------------------------------------------------------------------------

-- Security definer: it reads the GM's pieces, and returns only the lead and the body (never gm_value), only for lines
-- the caller may read (the lines' own rule, "inventory lines: read like the carrier", 20261026130000_m4b_draft.sql).
create function public.item_truths(campaign uuid) returns table (line_id uuid, name text, body text)
language sql stable security definer set search_path = '' as $$
  -- The lines whose pointer counts, with the piece it points at: a line a GM wrote the pointer on, in a log line that
  -- wasn't undone (the eye's line, or the line of a send that named the item); and a part split off such a line, however
  -- many splits down (a stack split or partly given: public.split_inventory_line copies item_data, pointer and all, onto
  -- the new line, in the same request as the source's smaller count), while neither the split nor its new line was
  -- undone (pg30-4: a name revealed once stays revealed; the local review of the carried #1101). A split's two log
  -- lines are tied by their request (its id and part) and their author, as an Undo ties them.
  with recursive counting (line_id, piece) as (
    select e.target_id, e.after -> 'item_data' ->> 'truthPiece'
    from public.events e
    join public.members m on m.campaign_id = e.campaign_id and m.user_id = e.actor_user_id and m.base_role = 'gm'
    where e.campaign_id = campaign
      and e.type in ('place.showItemTruth', 'find.give')
      and e.target_table = 'inventory_lines' and e.target_id is not null
      and e.reverts_event_id is null
      and not exists (select 1 from public.events r where r.reverts_event_id = e.id)
      and e.after -> 'item_data' ->> 'truthPiece' is not null
    union
    select made.target_id, c.piece
    from counting c
    join public.events cut
      on cut.campaign_id = campaign and cut.target_table = 'inventory_lines' and cut.target_id = c.line_id
      and cut.request_id is not null
      and (cut.before ->> 'qty')::integer > (cut.after ->> 'qty')::integer
      and cut.reverts_event_id is null
      and not exists (select 1 from public.events r where r.reverts_event_id = cut.id)
    join public.events made
      on made.campaign_id = campaign and made.target_table = 'inventory_lines' and made.target_id is not null
      and made.request_id = cut.request_id
      and made.request_part is not distinct from cut.request_part
      and made.actor_user_id is not distinct from cut.actor_user_id
      and made.before is null and made.after is not null
      and made.after -> 'item_data' ->> 'truthPiece' = c.piece
      and made.reverts_event_id is null
      and not exists (select 1 from public.events r where r.reverts_event_id = made.id)
  )
  select l.id, private.plain_link_text(coalesce(pc.lead, '')), private.plain_link_text(pc.body)
  from public.inventory_lines l
  join public.place_pieces pc
    on pc.id = case when (l.item_data ->> 'truthPiece') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                    then (l.item_data ->> 'truthPiece')::uuid end
    and pc.campaign_id = l.campaign_id
    and not pc.undone
    and pc.kind = 'other'
    and coalesce(trim(pc.lead), '') <> ''
  where l.campaign_id = campaign
    -- Shown, and not undone, by a show that counts for the reader: one made while the party was one group (for good,
    -- finding 1), any show while the party is one group now, or, while it is split, a show made during a split to a
    -- character or hireling of the reader's (b15f-6; never by group number, finding 3). The GM reads every one.
    and exists (
      select 1 from public.piece_shows s
      where s.piece_id = pc.id and not s.undone
        and (
          private.is_gm(l.campaign_id)
          or s.shown_to is null
          or not private.party_split(l.campaign_id)
          or exists (
            select 1 from public.actors a
            where a.id = any (s.shown_to) and a.campaign_id = l.campaign_id
              and a.owner_type = 'user' and a.owner_user_id = (select auth.uid())
          )
        )
    )
    -- The pointer counts on this line: the GM wrote it here, or the line was split off one where it counts (above).
    and exists (select 1 from counting c where c.line_id = l.id and c.piece = pc.id::text)
    and (
      (private.is_gm(l.campaign_id) and (l.actor_id is null or not private.is_others_draft(l.actor_id)))
      or (
        private.is_member(l.campaign_id)
        and (
          l.location_id is not null
          or exists (
            select 1 from public.actors a
            where a.id = l.actor_id
              and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid())))
          )
        )
      )
    );
$$;
revoke execute on function public.item_truths(uuid) from public, anon;
grant execute on function public.item_truths(uuid) to authenticated, service_role;

-- 3. The command's rows -------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('place.showItemTruth', 'simple', true);
insert into public.undoable_makings (name) values ('place.showItemTruth');
