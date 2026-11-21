-- M4b step 4b (Francis's OK, 2026-10-25): a campaign field keyed "hp", made by "Use this sheet layout" before HP
-- became the character's own, is hidden. Hiding keeps every value, and the GM can show it again (docs/05,
-- GM-defined fields). Re-filed, not a change anyone made: not logged. Drops nothing.

alter table public.field_definitions disable trigger user;
update public.field_definitions set hidden = true where key = 'hp' and not hidden;
alter table public.field_definitions enable trigger user;
