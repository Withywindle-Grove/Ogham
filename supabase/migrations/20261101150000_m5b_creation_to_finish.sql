-- M5b step 0, character creation revisited (docs/05 "Guided creation revisited", 04 PC extras: toFinish). Replaces
-- one function; drops and changes no data.
--   The steps a player left with Decide later are kept on the character's creation record as toFinish (a list of
--   step names, e.g. ["languages"]). The owner finishes them after approval too, so the guard on the creation record
--   now lets the owner change toFinish alone (a list of at most 12 short step names) once the character is
--   approved. Everything else on an approved character's creation record stays the GM's, as before.
-- Starts from the newest definition, in 20261028090000_m4b_review_fixes.sql (the one-time starting-gear spend).
create or replace function private.guard_creation_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(old.campaign_id) then
    return new;
  end if;
  if old.approval = 'approved' and new.creation is distinct from old.creation
    -- The one-time starting-gear spend (20261028090000).
    and not (
      not (old.creation ? 'spentBase')
      and (new.creation - 'spentBase' - 'moneyCoin') = (old.creation - 'moneyCoin')
      and jsonb_typeof(new.creation -> 'spentBase') = 'number'
      and (new.creation ->> 'spentBase')::numeric >= 0
      and (new.creation ->> 'spentBase')::numeric = trunc((new.creation ->> 'spentBase')::numeric)
      and (not (old.creation ? 'moneyCoin') or new.creation -> 'moneyCoin' is not distinct from old.creation -> 'moneyCoin')
    )
    -- The To finish list alone (M5b step 0): removed, or a short list of short step names.
    and not (
      (new.creation - 'toFinish') = (old.creation - 'toFinish')
      and (
        not (new.creation ? 'toFinish')
        or (
          jsonb_typeof(new.creation -> 'toFinish') = 'array'
          and jsonb_array_length(new.creation -> 'toFinish') <= 12
          and not jsonb_path_exists(new.creation -> 'toFinish', '$[*] ? (@.type() != "string" || @.size() > 40)')
        )
      )
    ) then
    raise exception 'Only the GM can change how an approved character was made.' using errcode = '42501';
  end if;
  return new;
end;
$$;
