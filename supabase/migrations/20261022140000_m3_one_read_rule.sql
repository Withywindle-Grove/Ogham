-- M3 step 3b: one reading rule per table for packs and library entries (the security advisor's "multiple
-- permissive policies" note: two rules are each checked on every read). Who can see what doesn't change:
-- * packs: the owner, or members of a campaign using it; only the owner adds, changes or deletes;
-- * entries: the pack's owner; the GM of a campaign using it; members of such a campaign for player-facing kinds.

drop policy "packs: owner only" on public.packs;
drop policy "packs: members of campaigns using it read" on public.packs;
create policy "packs: owner or campaigns using it read" on public.packs
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or private.pack_in_my_campaign(id));
create policy "packs: owner adds" on public.packs
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "packs: owner changes" on public.packs
  for update to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "packs: owner deletes" on public.packs
  for delete to authenticated using (owner_user_id = (select auth.uid()));

drop policy "library entries: the pack's owner" on public.library_entries;
drop policy "library entries: campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (
      private.pack_in_my_campaign(pack_id)
      and kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option')
    )
  );
create policy "library entries: owner adds" on public.library_entries
  for insert to authenticated
  with check (exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid())));
create policy "library entries: owner changes" on public.library_entries
  for update to authenticated
  using (exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid())));
create policy "library entries: owner deletes" on public.library_entries
  for delete to authenticated
  using (exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid())));
