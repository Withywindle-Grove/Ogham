-- Profiles remember whether the person has chosen their name ("What should we call you?", asked once).
-- Tests: supabase/tests/profiles.test.ts.

alter table public.profiles add column named_at timestamptz;

-- New profiles fall back to "Adventurer" if the email gives no name, so a name is never blank.
create or replace function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, created_by)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Adventurer'
    ),
    new.id
  );
  return new;
end;
$$;

update public.profiles set display_name = 'Adventurer' where length(trim(display_name)) = 0;
alter table public.profiles add constraint profiles_display_name_not_blank check (length(trim(display_name)) > 0);

-- When a person saves their own profile, their name counts as chosen, and stays chosen.
create function private.mark_profile_named() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) = new.id then
    new.named_at := coalesce(old.named_at, now());
  else
    new.named_at := old.named_at;
  end if;
  return new;
end;
$$;

revoke execute on function private.mark_profile_named() from public, anon;

create trigger mark_named before update on public.profiles for each row execute function private.mark_profile_named();
