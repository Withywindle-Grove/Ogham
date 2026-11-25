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
-- A name revealed is revealed to everyone (Francis, 2026-11-21: "Once it's revealed it's revealed to everyone. Players
-- don't keep this kind of thing secret from one another"; it replaces b15f-6). Once the GM has shown the piece to any
-- group (a show not undone), every player who may read a named line reads its real name, wherever the item is and
-- whoever holds it, the party split or not. Which group sees the piece itself on the place card is unchanged
-- (public.scene_pieces, per group).
--
-- Add-only. Drops, renames and deletes nothing; no policy changes.
--   1. public.show_item_truth (place.showItemTruth, the GM's): in ONE request, the piece shown to the group's visit (by
--      public.show_place_piece, unchanged) and the pointer written onto the given lines of this campaign. Undo is the
--      generic Undo of that request (public.undo_request), which takes back both.
--   1b. public.name_item_truth (inside a send, find.give, the GM's): the pointer written onto the given lines of this
--      campaign, and nothing shown, once the piece is revealed: shown to some group by a show not undone (hidden since
--      or not). So a thing sent after the reveal arrives named from whichever group's card it is sent (the local review
--      of #10, settled by the driver under sw-8), while which group sees the piece itself stays as it is. Refused for a
--      piece not revealed, so a send never names an item before the eye. The send's own Undo takes the line back whole.
--   2. public.item_truths: for the lines the caller may read (the same rule as the lines' own policy), the truth their
--      pointer names: the piece's lead (the item's real name) and its body (what it does, as written). Nothing else:
--      no source, and never anything from the piece's gm_value (b15f-4, docs/design/rulings/b15-build-flags-2026-11-20.md;
--      the pack's magicItem.source is not stored on the piece at all). Only a pointer the GM wrote counts: a log line,
--      by a GM of the campaign and not undone, of the GM's eye (place.showItemTruth) or of a send that named the item
--      (find.give), on that line, writing that pointer; or a part split off a line where it counts, however many splits
--      down (public.split_inventory_line copies item_data onto the new line in the same request as the source's smaller
--      count), so a named stack split or partly given keeps its name (pg30-4). A player who makes up such a "split" by
--      hand can only copy a pointer that already counts on a line of their own, so it reads nothing they don't already
--      read. Players never write log lines (only the database's triggers do), and a player may type a one-off's
--      item_data when making it (only the GM may change an existing line's item_data, 20261023180000_m4_reveal.sql), so
--      a pointer a player writes reads nothing, whatever piece it points at (the reviews of #1101). And only a piece
--      shaped as a magic item's truth (kind 'other', with a lead), still there, and shown to some group by a show not
--      undone (hidden since or not); show_item_truth refuses any other piece.
--   3. The command's row in public.logged_commands, and in public.undoable_makings (as place.showPiece: its Undo marks
--      the show it made undone, never removed).

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
  -- Then the item, wherever it is held now, whoever holds it: only this campaign's lines, and each once.
  update public.inventory_lines l
  set item_data = (case when jsonb_typeof(l.item_data) = 'object' then l.item_data else '{}'::jsonb end)
    || jsonb_build_object('truthPiece', piece::text)
  where l.id = any (coalesce(lines, '{}'))
    and l.campaign_id = here.campaign_id
    and (l.item_data ->> 'truthPiece') is distinct from piece::text;
  get diagnostics named = row_count;
  return named;
end;
$$;
revoke execute on function public.show_item_truth(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.show_item_truth(uuid, uuid, uuid[]) to authenticated, service_role;

-- 1b. A thing sent after the reveal -------------------------------------------------------------------------------------

create function public.name_item_truth(piece uuid, lines uuid[]) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  truth public.place_pieces;
  named integer := 0;
begin
  select * into truth from public.place_pieces pc where pc.id = piece and not pc.undone;
  if truth.id is null or not private.is_gm(truth.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- Only a magic item's piece (kind 'other', led by the real name), revealed: shown to some group, not undone.
  if truth.kind <> 'other' or coalesce(trim(truth.lead), '') = '' then
    raise exception 'Only a magic item''s piece can name an item.';
  end if;
  if not exists (select 1 from public.piece_shows s where s.piece_id = piece and not s.undone) then
    raise exception 'That magic item hasn''t been shown yet.';
  end if;
  update public.inventory_lines l
  set item_data = (case when jsonb_typeof(l.item_data) = 'object' then l.item_data else '{}'::jsonb end)
    || jsonb_build_object('truthPiece', piece::text)
  where l.id = any (coalesce(lines, '{}'))
    and l.campaign_id = truth.campaign_id
    and (l.item_data ->> 'truthPiece') is distinct from piece::text;
  get diagnostics named = row_count;
  return named;
end;
$$;
revoke execute on function public.name_item_truth(uuid, uuid[]) from public, anon;
grant execute on function public.name_item_truth(uuid, uuid[]) to authenticated, service_role;

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
    -- Shown to some group, by a show not undone (hidden since or not): a name revealed is revealed to everyone
    -- (Francis, 2026-11-21), whichever group the reader's characters are in.
    and exists (select 1 from public.piece_shows s where s.piece_id = pc.id and not s.undone)
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
