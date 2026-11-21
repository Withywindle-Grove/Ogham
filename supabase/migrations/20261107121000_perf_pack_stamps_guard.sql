-- perf-pack-cache, fix forward on 20261107120000_perf_pack_stamps.sql (applied to the test project only): the
-- content stamp is written by the bump trigger alone. A pack's owner may change their pack through the ordinary
-- update rule, and that rule covers every column, so a hand-written content_rev went through (the database test
-- caught it). Now a change to content_rev from anywhere but the bump keeps the old value (quietly: the app never
-- sends the column, and a legitimate update of the pack's other columns must still go through), and an insert
-- starts at 0. The bump marks its own update with a transaction-local setting. Adds only; nothing dropped.

create function private.guard_pack_content_rev() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('grimoire.bump_content_rev', true) is distinct from 'on' then
    if tg_op = 'INSERT' then
      new.content_rev := 0;
    elsif new.content_rev is distinct from old.content_rev then
      new.content_rev := old.content_rev;
    end if;
  end if;
  return new;
end;
$$;
-- Named to run after `guard_pack_update` and before `stamp` (triggers of one event fire in name order).
create trigger guard_pack_update_rev before insert or update on public.packs
  for each row execute function private.guard_pack_content_rev();

create or replace function private.bump_pack_content_rev() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('grimoire.bump_content_rev', 'on', true);
  update public.packs p set content_rev = p.content_rev + 1
  where p.id in (select distinct c.pack_id from changed c);
  perform set_config('grimoire.bump_content_rev', '', true);
  return null;
end;
$$;
