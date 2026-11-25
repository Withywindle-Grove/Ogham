-- B14 (plan scene-point-to-point; p2p-27, ruled 2026-11-18; storage ruled by Francis 2026-11-22, "A"): a pack's
-- pictures arrive with it in one bundled file and are kept with the pack, in a new private bucket `pack-files`, each
-- at <pack id>/<map id>.
--   Write (upload, replace): the pack's owner only.
--   Read: the pack's owner, and the GM of a campaign that uses the pack. Never a player (hard rule 5): a map reaches a
--   place as the campaign's own copy in `campaign-files` (place.addMap: the GM's alone until its eye), so opening the
--   eye shares that copy, never this file.
--   Nothing is removed here: no delete rule (a deleted pack's files stay until a ruling says otherwise).
-- Storage only: no table, no data changed.

insert into storage.buckets (id, name, public, file_size_limit)
values ('pack-files', 'pack-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- The file at <pack id>/<map id>: the signed-in person owns the pack, and the path has exactly those two parts.
create function private.can_write_pack_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(path, '/', 2) <> '' and split_part(path, '/', 3) = '' and exists (
    select 1 from public.packs p
    where p.id::text = split_part(path, '/', 1) and p.owner_user_id = (select auth.uid())
  );
$$;

-- Read by the owner, and by the GM of a campaign the pack is attached to.
create function private.can_read_pack_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_write_pack_file(path) or exists (
    select 1 from public.campaign_packs cp
    where cp.pack_id::text = split_part(path, '/', 1) and private.is_gm(cp.campaign_id)
  );
$$;
revoke execute on function private.can_read_pack_file(text), private.can_write_pack_file(text) from public, anon;
grant execute on function private.can_read_pack_file(text), private.can_write_pack_file(text) to authenticated;

create policy "pack-files: the owner and a GM using the pack read" on storage.objects
  for select to authenticated
  using (bucket_id = 'pack-files' and private.can_read_pack_file(name));
create policy "pack-files: the pack's owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pack-files' and private.can_write_pack_file(name));
create policy "pack-files: the pack's owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'pack-files' and private.can_write_pack_file(name))
  with check (bucket_id = 'pack-files' and private.can_write_pack_file(name));
