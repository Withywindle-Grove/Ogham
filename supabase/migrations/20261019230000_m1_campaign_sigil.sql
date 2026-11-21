-- M1 C4a: the campaign's sigil.
-- A campaign's sigil must be a sigil picture from that same campaign (only the GM edits campaigns already).

create function private.check_campaign_sigil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sigil_asset_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.sigil_asset_id is not distinct from old.sigil_asset_id then
    return new;
  end if;
  if (select auth.uid()) is null then
    return new;
  end if;
  if not exists (
    select 1 from public.assets a
    where a.id = new.sigil_asset_id
      and a.kind = 'sigil'
      and a.campaign_id = new.id
  ) then
    raise exception 'That picture can''t be this campaign''s sigil.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_campaign_sigil() from public, anon, authenticated;

create trigger check_sigil before insert or update on public.campaigns
  for each row execute function private.check_campaign_sigil();
