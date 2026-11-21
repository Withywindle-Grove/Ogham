-- M1 C4b: companies.
-- A company can be deleted only while no character is in it (archived ones included); it becomes
-- archive-only once charters and treasuries exist (M7).
-- An archived character keeps its company: not even the GM moves it.

create function private.company_in_use(company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.actors a where a.company_id = company);
$$;
revoke execute on function private.company_in_use(uuid) from public, anon;
grant execute on function private.company_in_use(uuid) to authenticated, service_role;

drop policy "companies: GM deletes" on public.companies;
create policy "companies: GM deletes empty" on public.companies
  for delete to authenticated
  using (private.is_gm(campaign_id) and not private.company_in_use(id));

create function private.guard_archived_company() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if old.status = 'archived' and new.company_id is distinct from old.company_id then
    raise exception 'An archived character keeps its company.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_archived_company before update on public.actors
  for each row execute function private.guard_archived_company();
