-- Creating a campaign: the only way in. Anyone signed in may create one and becomes its GM.
-- The campaign and the GM's membership are created together, so a campaign never exists without a GM.
-- There is deliberately no insert rule on campaigns: this function is the single door.
-- Tests: supabase/tests/campaigns.test.ts.

create function public.create_campaign(campaign_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  new_campaign uuid;
begin
  if me is null then
    raise exception 'Sign in before creating a campaign.' using errcode = '42501';
  end if;

  -- Later, if the app is sold with GM and player licences: check for a GM licence here.

  if campaign_name is null or length(trim(campaign_name)) = 0 then
    raise exception 'Give the campaign a name.' using errcode = '22023';
  end if;

  insert into public.campaigns (name) values (trim(campaign_name)) returning id into new_campaign;
  insert into public.members (campaign_id, user_id, base_role) values (new_campaign, me, 'gm');
  return new_campaign;
end;
$$;

revoke execute on function public.create_campaign(text) from public, anon;
grant execute on function public.create_campaign(text) to authenticated;
