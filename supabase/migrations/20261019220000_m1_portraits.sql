-- M1 C3b: character portraits.
-- A character's portrait must be a portrait from its own campaign, uploaded by the person linking it (or linked by the GM).
-- Portrait files and their asset rows can be removed by whoever uploaded them, or by the GM (same rule as uploading).

create function private.check_actor_portrait() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.portrait_asset_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.portrait_asset_id is not distinct from old.portrait_asset_id then
    return new;
  end if;
  if (select auth.uid()) is null then
    return new;
  end if;
  if not exists (
    select 1 from public.assets a
    where a.id = new.portrait_asset_id
      and a.kind = 'portrait'
      and a.campaign_id = new.campaign_id
      and (private.is_gm(new.campaign_id) or a.uploaded_by = (select auth.uid()))
  ) then
    raise exception 'That picture can''t be this character''s portrait.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_actor_portrait() from public, anon, authenticated;

create trigger check_portrait before insert or update on public.actors
  for each row execute function private.check_actor_portrait();

create policy "assets: GM or own portrait deletes" on public.assets
  for delete to authenticated
  using (private.is_gm(campaign_id) or (kind = 'portrait' and uploaded_by = (select auth.uid())));

create policy "campaign-files: GM or own portrait deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'campaign-files' and private.can_write_file(name));
