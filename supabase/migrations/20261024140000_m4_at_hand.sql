-- M4 gate-run rulings (design Project, 2026-10-23; docs/05, 09):
--   At hand fills itself (items in hand, and worn or held items with charges); the player can hide one of those
--   until they choose "Show in At hand". inventory_lines.at_hand_hidden holds that choice; like a pin, it goes
--   away by itself when the item leaves the character. Logged in the detailed log only.
--   "Show all items" per player is dropped ("For sale in shops" in the item editor decides what players can
--   buy): its row in the logged commands goes. Earlier log lines about it stay and still read as before; the
--   campaigns' old settings value stays too, unread.

alter table public.inventory_lines add column at_hand_hidden boolean not null default false;
alter table public.inventory_lines add constraint inventory_lines_at_hand_on_characters check (not at_hand_hidden or actor_id is not null);

create or replace function private.unpin_when_handed_on() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.location_id is distinct from old.location_id then
    new.pinned := false;
    new.at_hand_hidden := false;
  end if;
  if new.pinned and new.actor_id is null then
    raise exception 'Only a character''s items can be pinned.' using errcode = '42501';
  end if;
  return new;
end;
$$;

insert into public.logged_commands (name, level, gm_only) values ('inventory.atHand', 'verbose', false);
delete from public.logged_commands where name = 'inventory.showAll';
