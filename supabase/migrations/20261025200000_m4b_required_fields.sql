-- M4b, character creation step 4b: what a sheet layout says creation must ask (ruled 2026-10-24 and 2026-10-25;
-- docs/05, 07 sheet layouts `required`). Players don't read sheet layouts, so it's kept where they read:
--   field_definitions.required: creation asks for that field (copied by "Use this sheet layout").
--   campaigns.settings.hpRequired: a layout's field keyed "hp" is the character's own HP, never a campaign field;
--     marked required, creation asks for HP.
-- Campaigns that already used a layout get both now, from the attached packs' layouts, keys matched the way the
-- layout's fields were made ("STR" → "str"). Re-filed, not a change anyone made: not logged, and allowed in a
-- retired campaign. Drops nothing; a campaign field keyed "hp" made before this stays as the GM has it.

alter table public.field_definitions add column required boolean not null default false;

create temporary table layout_required on commit drop as
select distinct cp.campaign_id, left(trim(both '_' from regexp_replace(lower(f ->> 'key'), '[^a-z0-9]+', '_', 'g')), 36) as key
from public.campaign_packs cp
join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'fieldTemplate'
cross join lateral jsonb_array_elements(case when jsonb_typeof(e.data -> 'fields') = 'array' then e.data -> 'fields' else '[]'::jsonb end) f
where f -> 'required' = 'true'::jsonb and jsonb_typeof(f -> 'key') = 'string';

alter table public.field_definitions disable trigger user;
update public.field_definitions fd set required = true
from layout_required r where r.campaign_id = fd.campaign_id and r.key = fd.key;
alter table public.field_definitions enable trigger user;

alter table public.campaigns disable trigger user;
update public.campaigns c set settings = coalesce(c.settings, '{}'::jsonb) || '{"hpRequired": true}'::jsonb
where exists (select 1 from layout_required r where r.campaign_id = c.id and r.key = 'hp');
alter table public.campaigns enable trigger user;
