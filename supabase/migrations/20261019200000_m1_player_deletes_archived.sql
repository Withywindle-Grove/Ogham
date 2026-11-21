-- M1 characters: players may also permanently delete their own archived characters (the GM still can for any).

drop policy "actors: delete unapproved, or archived by the GM" on public.actors;
create policy "actors: delete unapproved or archived, by owner or GM" on public.actors
  for delete to authenticated
  using (
    (approval <> 'approved' or status = 'archived')
    and (
      private.is_gm(campaign_id)
      or (owner_type = 'user' and owner_user_id = (select auth.uid()))
    )
  );
