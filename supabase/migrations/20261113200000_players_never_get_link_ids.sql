-- Players never get a link mark's id (review of #726, Important 1; rp-5; hard rule 5; the lead, 2026-11-13). Two jobs in
-- one migration:
--   A. A place's rules. 20261113120000_dec_7_3_place_check_and_rules.sql ran its patterns over a rule's text as JSON text
--      (`body::text`), where a label's quote reads `\"` and a backslash `\\`, and its patterns left any mark holding
--      either as it was: `[[npc:old-tom|"Old" Tom]]` went out whole, id and all (in a rule's text, name and button).
--   B. A place's pieces. A mark the GM types by hand into + Piece or Edit piece is stored as typed (only a pack's pieces
--      are stripped when the place is made), and public.scene_pieces, public.known_places_campaign and the older
--      public.known_places sent it to players with its id.
-- What changes:
--   1. private.plain_link_text(text): the strip on one plain string, the same rule as the app's plainLinks
--      (src/modules/library/linkMarks.ts), with no JSON escaping in the way: `[[kind:id|label]]` becomes its label,
--      trimmed, whatever it holds (quotes, backslashes, a pipe, an opening bracket, a newline, any letter or emoji; a
--      label ends at its first `]`, as in the app); `[[kind:id]]`, `[[kind:pack:id]]` or an empty label become the id's
--      words (the pack dropped at the first colon, dashes and underscores as one space). A last pass drops anything
--      still starting `[[<kind>:` (a mark the patterns can't read, or past the 200th), up to its `]]` or the next space,
--      so no id is left behind. This is the plain-text form both the JSON walk (2) and the piece reads (3) use.
--   2. private.plain_link_marks(jsonb): walks the value and runs (1) on each JSON string, in every block, list item,
--      table title, column and cell; numbers, true, false and null stay as they are. A mark split across two strings
--      stays text in each, its id dropped by the last pass.
--   3. public.scene_pieces, public.known_places_campaign (newest in 20261111170000_dec_2c_piece_lead.sql) and
--      public.known_places (only in 20261103140000_m5b_3_secret_requests.sql; nothing in src/ calls it now): as they
--      were, with a shown piece's body and lead through (1). Their return shapes are unchanged. The GM's own reads
--      (the place_pieces table) keep the text as typed.
-- Replaces five functions; their names, arguments and return types are unchanged, so nothing that calls them changes.
-- Adds nothing else. Drops, renames and deletes no data; no row is written. It doesn't change who may read what.

-- 1. The strip on plain text --------------------------------------------------------------------------------------------

create or replace function private.plain_link_text(body text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  found text[];
  target text;
  label text;
  words text;
  done text := body;
  n integer := 0;
begin
  if done is null then
    return null;
  end if;
  loop
    -- As linkMarks.ts: `[[`, the kind's letters, `:`, a target with no `]` or `|`, then an optional `|label` with no `]`.
    found := regexp_match(done, '\[\[([A-Za-z]+):([^]|]+)(\|([^]]*))?\]\]');
    exit when found is null or n >= 200;
    target := found[2];
    label := btrim(coalesce(found[4], ''), E' \t\r\n');
    if label <> '' then
      words := label;
    else
      if position(':' in target) > 0 then
        target := substr(target, position(':' in target) + 1);
      end if;
      words := btrim(regexp_replace(btrim(target), '[-_]+', ' ', 'g'));
    end if;
    done := replace(done, '[[' || found[1] || ':' || found[2] || coalesce(found[3], '') || ']]', words);
    n := n + 1;
  end loop;
  -- Anything still shaped like the start of a mark goes, with whatever follows it up to `]]` or the next space.
  return regexp_replace(done, '\[\[[A-Za-z]+:[^][:space:]]*(\]\])?', '', 'g');
end;
$$;
revoke execute on function private.plain_link_text(text) from public, anon, authenticated;

-- 2. The walk over a rule's JSON ----------------------------------------------------------------------------------------

create or replace function private.plain_link_marks(body jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  walked jsonb;
begin
  if body is null then
    return null;
  end if;
  if jsonb_typeof(body) = 'string' then
    return to_jsonb(private.plain_link_text(body #>> '{}'));
  elsif jsonb_typeof(body) = 'array' then
    select coalesce(jsonb_agg(private.plain_link_marks(e.value) order by e.at), '[]'::jsonb) into walked
    from jsonb_array_elements(body) with ordinality e(value, at);
    return walked;
  elsif jsonb_typeof(body) = 'object' then
    select coalesce(jsonb_object_agg(e.key, private.plain_link_marks(e.value)), '{}'::jsonb) into walked
    from jsonb_each(body) e;
    return walked;
  end if;
  return body;
end;
$$;
revoke execute on function private.plain_link_marks(jsonb) from public, anon, authenticated;

-- 3. The piece reads ----------------------------------------------------------------------------------------------------

-- As in 20261111170000_dec_2c_piece_lead.sql, with the body and lead through private.plain_link_text.
create or replace function public.scene_pieces(campaign uuid) returns table (group_number integer, place_name text, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select gp.group_number, coalesce(nullif(p.players_name, ''), p.name), pc.id, pc.kind, private.plain_link_text(pc.body), private.plain_link_text(pc.lead)
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
  order by gp.group_number, s.shown_at, s.id;
$$;

-- As in 20261111170000_dec_2c_piece_lead.sql, with the body and lead through private.plain_link_text.
create or replace function public.known_places_campaign(campaign uuid)
returns table (expedition_id uuid, current boolean, expedition_started bigint, visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select x.id, x.ended_at is null, x.started_at, gp.id, gp.group_number, p.id, coalesce(nullif(p.players_name, ''), p.name), gp.created_at, pc.id, pc.kind, private.plain_link_text(pc.body), private.plain_link_text(pc.lead)
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.in_my_group(campaign, gp.group_number)
  order by (x.ended_at is null) desc, x.created_at desc, gp.created_at, gp.id, s.shown_at, s.id;
$$;

-- As in 20261103140000_m5b_3_secret_requests.sql, with the body through private.plain_link_text.
create or replace function public.known_places(campaign uuid)
returns table (visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text)
language sql stable security definer set search_path = '' as $$
  select gp.id, gp.group_number, p.id, p.name, gp.created_at, pc.id, pc.kind, private.plain_link_text(pc.body)
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and x.ended_at is null and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.in_my_group(campaign, gp.group_number)
  order by gp.created_at, gp.id, s.shown_at, s.id;
$$;
