-- M5 step 6, fix forward: 20261029190000_m5_note_reveal.sql rebuilt private.prepare_note from the M2 original and so
-- dropped the 20261021150000_m2_review_fixes.sql rule (3): a note about a character that isn't approved takes that
-- character's visibility (its owner and the GM, or the GM only). Notes about waiting or GM-only characters reached
-- every player (hidden means hidden; caught by review-fixes.test.ts).
--
-- What it changes, plainly. Replaces private.prepare_note with the M2 review-fix version plus reveal_at (a note on a
-- log entry also takes when that entry reaches players). Drops nothing; no rows are changed or removed.

create or replace function private.prepare_note() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.events;
  about public.actors;
begin
  new.audience := 'all';
  new.owner_user_id := null;
  new.reveal_at := 'now';
  if new.about_actor_id is not null then
    select * into about from public.actors a where a.id = new.about_actor_id and a.campaign_id = new.campaign_id;
    if about.id is null then
      raise exception 'That character isn''t in this campaign.' using errcode = '42501';
    end if;
    -- Like who may see the character itself (and its log entries).
    if about.approval <> 'approved' then
      if about.owner_type = 'user' then
        new.audience := 'owner';
        new.owner_user_id := about.owner_user_id;
      else
        new.audience := 'gm';
      end if;
    end if;
  end if;
  if new.annotates_event_id is not null then
    select * into entry from public.events e where e.id = new.annotates_event_id;
    if entry.id is null or entry.campaign_id <> new.campaign_id then
      raise exception 'That log entry isn''t in this campaign.' using errcode = '42501';
    end if;
    -- The character and the entry: the stricter wins.
    if entry.audience = 'gm' or new.audience = 'gm'
      or (entry.audience = 'owner' and new.audience = 'owner' and entry.owner_user_id is distinct from new.owner_user_id) then
      new.audience := 'gm';
      new.owner_user_id := null;
    elsif entry.audience = 'owner' then
      new.audience := 'owner';
      new.owner_user_id := entry.owner_user_id;
    end if;
    new.reveal_at := entry.reveal_at;
  end if;
  return new;
end;
$$;
