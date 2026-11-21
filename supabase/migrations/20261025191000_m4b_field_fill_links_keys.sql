-- M4b step 4a, fixed forward from 20261025190000_m4b_field_fill_links.sql: "Use this sheet layout" makes a campaign
-- field's key from the layout's (lower case, anything but letters and digits as "_": "saveR" → "saver"), so the
-- links are matched the same way. Re-filed, not logged. Drops nothing.

alter table public.field_definitions disable trigger user;
update public.field_definitions fd
set fill = found.fill
from (
  select distinct on (cp.campaign_id, k.key) cp.campaign_id, k.key, f ->> 'fill' as fill
  from public.campaign_packs cp
  join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'fieldTemplate'
  cross join lateral jsonb_array_elements(case when jsonb_typeof(e.data -> 'fields') = 'array' then e.data -> 'fields' else '[]'::jsonb end) f
  cross join lateral (select left(trim(both '_' from regexp_replace(lower(f ->> 'key'), '[^a-z0-9]+', '_', 'g')), 36) as key) k
  where jsonb_typeof(f -> 'fill') = 'string' and char_length(f ->> 'fill') between 1 and 60
  order by cp.campaign_id, k.key, cp.priority desc
) found
where fd.campaign_id = found.campaign_id and fd.key = found.key and fd.fill is null;
alter table public.field_definitions enable trigger user;
