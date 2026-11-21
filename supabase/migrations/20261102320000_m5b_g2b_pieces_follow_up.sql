-- M5b step g2b: pieces after they're added (docs/plans/m5b-g2b-pieces-follow-up.md; ruled 2026-11-02,
-- design/rulings/m5b-g2b-pieces-follow-up-2026-11-02.md, gp-1 … gp-6; docs/04 Place, docs/05 "The room's GM layer").
--   1. Edit piece (place.editPiece): the GM changes a piece's kind and text in place (public.edit_place_piece); the
--      row gets a version for a save from an old copy. Remove this piece (place.removePiece) retires it by its
--      undone flag (public.remove_place_piece): it leaves the card and every visit's shown list (scene_pieces and the
--      card already skip undone pieces); Undo clears the flag and its shows stand again. Nothing is deleted (gp-3).
--      private.place_piece_rules is replaced (newest copy: 20261102100000_m5b_g2_place_pieces.sql): kind and text
--      may change, and undo may clear the flag. private.tick_piece is replaced (same file): a kind change ticks too.
--   2. Coming back (gp-5, place.backAt): public.back_at_place(visit) copies into a new visit the pieces shown at the
--      end of the place's most recent earlier visit (any group, any expedition), in their order; pieces hidden by
--      then, removed, or added since are not shown. The app calls it as its own request right after Where now?
--      (set_group_place), so its log line is its own and its Undo hides exactly those (undoable_makings).
--      A visit that already has shows (the same request sent again) gets its count back and nothing is written.
--   3. place.show and place.hide are retired (gp-6). This migration DELETES exactly two rows of
--      public.logged_commands: the ones named 'place.show' and 'place.hide' (the app's own command list, not
--      anyone's data; Francis OK'd it in plain words, 2026-11-02; precedent 20261102202000_m5b_0c_no_ask_allow.sql).
--      Their earlier events stay in public.events and the app still renders their words.
-- Adds one column, three functions and three logged-command rows; replaces two trigger functions. Deletes the two
-- logged_commands rows named above and nothing else; drops and renames nothing.

-- 1. A piece can change --------------------------------------------------------------------------------------------

alter table public.place_pieces add column version integer not null default 1 check (version >= 1);

-- As in 20261102100000_m5b_g2_place_pieces.sql, plus: kind and body may change (trimmed, checked; the version
-- moves on), and undo may clear the undone flag (grimoire.reverting). Everything else stays as made.
create or replace function private.place_piece_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.places p where p.id = new.place_id and p.campaign_id = new.campaign_id) then
      raise exception 'That place isn''t in this campaign.';
    end if;
    new.body := trim(new.body);
    new.undone := false;
    new.version := 1;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone and not reverting then
    raise exception 'That piece was removed.';
  end if;
  if (to_jsonb(new) - 'kind' - 'body' - 'version' - 'undone' - 'updated_at')
    is distinct from (to_jsonb(old) - 'kind' - 'body' - 'version' - 'undone' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.body := trim(new.body);
  if new.kind is distinct from old.kind or new.body is distinct from old.body then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- As in 20261102100000_m5b_g2_place_pieces.sql, plus: a shown piece whose kind changes ticks its groups too.
create or replace function private.tick_piece() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  group_no integer;
begin
  if old.undone is distinct from new.undone or old.body is distinct from new.body or old.kind is distinct from new.kind then
    for group_no in
      select distinct s.group_number from public.piece_shows s where s.piece_id = new.id and s.shown and not s.undone
    loop
      perform private.tick_group(new.campaign_id, group_no);
    end loop;
  end if;
  return null;
end;
$$;

-- Edit piece (place.editPiece): the GM changes a piece's kind and text; its position and its shows stay. `seen` is
-- the version the sheet opened with (null: no check). Security invoker: the GM's rules.
create function public.edit_place_piece(piece uuid, kind text, body text, seen integer default null) returns public.place_pieces
language plpgsql security invoker set search_path = '' as $$
declare
  this_piece public.place_pieces;
begin
  select * into this_piece from public.place_pieces pc where pc.id = piece for update;
  if this_piece.id is null or not private.is_gm(this_piece.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if this_piece.undone then
    raise exception 'That piece was removed.';
  end if;
  if kind is null or kind not in ('description', 'exit', 'person', 'clue', 'treasure', 'hazard', 'other') then
    raise exception 'Pick what kind of piece it is.';
  end if;
  if body is null or length(trim(body)) = 0 then
    raise exception 'Write what players will see.';
  end if;
  if length(trim(body)) > 4000 then
    raise exception 'A piece is at most 4000 characters.';
  end if;
  if seen is not null and seen <> this_piece.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  update public.place_pieces pc set kind = edit_place_piece.kind, body = trim(edit_place_piece.body)
  where pc.id = piece
  returning * into this_piece;
  return this_piece;
end;
$$;
revoke execute on function public.edit_place_piece(uuid, text, text, integer) from public, anon;
grant execute on function public.edit_place_piece(uuid, text, text, integer) to authenticated, service_role;

-- Remove this piece (place.removePiece): retired by its flag, never deleted (gp-3). Its shows follow (every reader
-- skips an undone piece); Undo clears the flag and they stand again. A repeat changes nothing.
create function public.remove_place_piece(piece uuid) returns public.place_pieces
language plpgsql security invoker set search_path = '' as $$
declare
  this_piece public.place_pieces;
begin
  select * into this_piece from public.place_pieces pc where pc.id = piece for update;
  if this_piece.id is null or not private.is_gm(this_piece.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if this_piece.undone then
    return this_piece;
  end if;
  update public.place_pieces pc set undone = true where pc.id = piece returning * into this_piece;
  return this_piece;
end;
$$;
revoke execute on function public.remove_place_piece(uuid) from public, anon;
grant execute on function public.remove_place_piece(uuid) to authenticated, service_role;

-- 2. Coming back ---------------------------------------------------------------------------------------------------

-- Back at a place (place.backAt): the new visit starts with what was shown at the end of the place's most recent
-- earlier visit, by any group in any expedition (gp-5), in the order shown; a piece hidden by then, removed, or
-- added since isn't shown. Returns how many it showed (0: nothing written, no log line). The GM; the group's
-- current visit only. A visit that already has shows (the same request again) gets its shown count back.
create function public.back_at_place(visit uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  here public.group_places;
  last_visit public.group_places;
  shown integer;
begin
  select * into here from public.group_places gp where gp.id = visit;
  if here.id is null or not private.is_gm(here.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if here.place_id is null then
    return 0;
  end if;
  if here.undone or here.moved_on or (private.current_group_place(here.campaign_id, here.group_number)).id is distinct from here.id then
    raise exception 'That group has moved on from there.';
  end if;
  if exists (select 1 from public.piece_shows s where s.group_place_id = visit and not s.undone) then
    select count(*) into shown from public.piece_shows s where s.group_place_id = visit and s.shown and not s.undone;
    return shown;
  end if;
  select gp.* into last_visit from public.group_places gp
  where gp.campaign_id = here.campaign_id and gp.place_id = here.place_id and gp.id <> here.id and not gp.undone
    and (gp.created_at, gp.id) < (here.created_at, here.id)
  order by gp.created_at desc, gp.id desc
  limit 1;
  if last_visit.id is null then
    return 0;
  end if;
  insert into public.piece_shows (campaign_id, group_place_id, piece_id, group_number, shown, shown_at)
  select here.campaign_id, here.id, s.piece_id, here.group_number, true, s.shown_at
  from public.piece_shows s
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where s.group_place_id = last_visit.id and s.shown and not s.undone
  order by s.shown_at, s.id;
  get diagnostics shown = row_count;
  return shown;
end;
$$;
revoke execute on function public.back_at_place(uuid) from public, anon;
grant execute on function public.back_at_place(uuid) to authenticated, service_role;

-- 3. The logged commands and undo ----------------------------------------------------------------------------------

-- Retired (gp-6): the two rows named here, and nothing else. Their earlier events stay.
delete from public.logged_commands where name in ('place.show', 'place.hide');

insert into public.logged_commands (name, level, gm_only) values
  ('place.editPiece', 'verbose', true),
  ('place.removePiece', 'verbose', true),
  ('place.backAt', 'verbose', true);
-- The shows a return visit makes are marked undone by Undo (the pieces are hidden again; the GM shows them one by one).
insert into public.undoable_makings (name) values ('place.backAt');
