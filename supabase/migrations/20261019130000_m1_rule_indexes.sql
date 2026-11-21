-- Indexes for the columns the access rules look up on every request (flagged by `supabase db advisors`).
-- "Created by" links are left unindexed: rarely searched, and the group is small.

create index members_user_idx on public.members (user_id);
create index invites_campaign_idx on public.invites (campaign_id);
create index companies_campaign_idx on public.companies (campaign_id);
create index assets_campaign_idx on public.assets (campaign_id);
create index actors_owner_user_idx on public.actors (owner_user_id);
create index actors_company_idx on public.actors (company_id, campaign_id);
