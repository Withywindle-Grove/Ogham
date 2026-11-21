-- M3 step 3d: each campaign's link to setting rules keeps the pack's name, so the campaign's log can name it
-- even once the pack is gone (deleted from its owner's library) or out of a player's sight (detached).
-- Set from the pack when attached, never from the request, and never changed afterwards. Adds a column; removes nothing.

alter table public.campaign_packs add column pack_name text not null default '';

-- Existing links take their pack's current name (not logged: this only fills in what was always true).
alter table public.campaign_packs disable trigger log_change;
update public.campaign_packs cp set pack_name = p.name from public.packs p where p.id = cp.pack_id;
alter table public.campaign_packs enable trigger log_change;

create function private.keep_pack_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select p.name into new.pack_name from public.packs p where p.id = new.pack_id;
    new.pack_name := coalesce(new.pack_name, '');
  else
    new.pack_name := old.pack_name;
  end if;
  return new;
end;
$$;
revoke execute on function private.keep_pack_name() from public, anon, authenticated;

create trigger keep_pack_name before insert or update on public.campaign_packs
  for each row execute function private.keep_pack_name();
