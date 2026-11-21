-- M5b step 0, fix forward on 20261101150000_m5b_creation_to_finish.sql. Replaces one function; drops and changes no
-- data. The To finish list's step names are each at most 40 letters: the check there used jsonpath's size(), which
-- measures lists, not text, so a long name got through. Starts from that newest definition; only the check changes.
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
          and not exists (
            select 1 from jsonb_array_elements(new.creation -> 'toFinish') as step
            where jsonb_typeof(step) <> 'string' or length(step #>> '{}') > 40
          )
        )
      )
    ) then
    raise exception 'Only the GM can change how an approved character was made.' using errcode = '42501';
  end if;
  return new;
end;
$$;
