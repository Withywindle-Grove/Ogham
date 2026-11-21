-- M4b, character creation step 4a: a campaign field can show a filled value (ruled 2026-10-25; docs/07 sheet
-- layouts, `fill`). The link lives on the campaign's own field, which players already read (sheet layouts stay
-- the GM's): field_definitions.fill, e.g. "saves.D". "Use this sheet layout" copies it from the layout's field.
-- Fields already made from a layout get theirs now, from the attached packs' layouts, matched by key (re-filed,
-- not a change anyone made: not logged, and allowed in a retired campaign). Drops nothing.

alter table public.field_definitions
  add column fill text check (fill is null or (char_length(fill) between 1 and 60));

alter table public.field_definitions disable trigger user;
update public.field_definitions fd
set fill = found.fill
from (
  select distinct on (cp.campaign_id, f ->> 'key') cp.campaign_id, f ->> 'key' as key, f ->> 'fill' as fill
  from public.campaign_packs cp
  join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'fieldTemplate'
  cross join lateral jsonb_array_elements(case when jsonb_typeof(e.data -> 'fields') = 'array' then e.data -> 'fields' else '[]'::jsonb end) f
  where jsonb_typeof(f -> 'fill') = 'string' and char_length(f ->> 'fill') between 1 and 60
  order by cp.campaign_id, f ->> 'key', cp.priority desc
) found
where fd.campaign_id = found.campaign_id and fd.key = found.key and fd.fill is null;
alter table public.field_definitions enable trigger user;
