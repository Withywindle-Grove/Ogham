-- M1 campaign picker: look up an invite code before joining.
-- Shows only the campaign name and the GM's name. It never joins, never uses up the code,
-- and gives the same empty answer for unknown, expired, revoked and used codes.

create function public.peek_invite(invite_code text)
returns table (campaign_id uuid, campaign_name text, gm_name text, already_member boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in before using an invite code.' using errcode = '42501';
  end if;

  return query
  select c.id, c.name, coalesce(p.display_name, 'your GM'),
         exists (select 1 from public.members m where m.campaign_id = c.id and m.user_id = me)
  from public.invites i
  join public.campaigns c on c.id = i.campaign_id
  left join public.members gm on gm.campaign_id = c.id and gm.base_role = 'gm'
  left join public.profiles p on p.id = gm.user_id
  where i.code = upper(regexp_replace(invite_code, '[^A-Za-z0-9]', '', 'g'))
    and i.status = 'pending'
    and i.expires_at > now();
end;
$$;

revoke execute on function public.peek_invite(text) from public, anon;
grant execute on function public.peek_invite(text) to authenticated;
