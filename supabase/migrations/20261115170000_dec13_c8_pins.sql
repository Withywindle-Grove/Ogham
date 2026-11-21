-- December step 13, piece C8, data only: pins for spells and traits (docs/plans/dec-13-the-player-screen.md, row C8;
-- ruling pin-1 in docs/design/rulings/dec-player-screen-2026-11-14.md; docs/05-features.md, At hand).
-- Francis's yes (pin-2, 2026-11-15). He was asked: "A player may pin a spell or a trait of their own character to At
-- hand; it adds a record and removes nothing." He answered: "Yes".
--   character_play gets one column, `pins`: a list of what the player pinned, [{ "kind": "spell" | "trait", "key": "<pack
--   spell id, or the trait's key>" }], at most 24, a key 1 to 80 characters. Pinning adds an entry and unpinning takes
--   one out of the list (an update of this one row, never a delete of a row), like `prepared`.
-- Who reads and writes it is unchanged and not touched here: it is part of the character_play row, so it is read like
-- the character (every member of the campaign sees an approved character's row, as they already see `prepared` and the
-- spent uses) and written by the owner of an approved character or the GM. No policy, no read rule, no definer function
-- changes. A pin whose spell or trait the character no longer has is left in the list and ignored by the app's readers.
-- Add-only: one column with a check, one plain check helper, one logged command. Drops, renames and deletes nothing.

-- Is this a list of pins: at most 24, each an object of only kind ('spell' or 'trait') and key (1 to 80 characters; 24 of them in multi-byte text still fit the size check)?
-- (A check can't hold a subquery, so the column's check calls this.)
create function private.valid_pins(pins jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(pins) <> 'array' then false
    when jsonb_array_length(pins) > 24 then false
    else not exists (
      select 1 from jsonb_array_elements(pins) e
      where jsonb_typeof(e.value) <> 'object'
        or e.value ->> 'kind' is null
        or e.value ->> 'kind' not in ('spell', 'trait')
        or jsonb_typeof(e.value -> 'key') <> 'string'
        or char_length(e.value ->> 'key') not between 1 and 80
        or (case when jsonb_typeof(e.value) = 'object' then (e.value - 'kind' - 'key') <> '{}'::jsonb else true end)
    )
  end;
$$;
revoke execute on function private.valid_pins(jsonb) from public, anon;
grant execute on function private.valid_pins(jsonb) to authenticated, service_role;

alter table public.character_play
  add column pins jsonb not null default '[]'::jsonb check (private.valid_pins(pins) and pg_column_size(pins) <= 10000);
comment on column public.character_play.pins is 'What the player pinned to At hand (pin-2): [{ kind: spell | trait, key }], at most 24; read like the rest of the row; an entry whose spell or trait is gone is ignored by readers.';

insert into public.logged_commands (name, level, gm_only) values
  ('character.pin', 'simple', false);
