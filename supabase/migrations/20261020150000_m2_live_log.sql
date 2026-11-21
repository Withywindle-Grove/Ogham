-- M2 E2: live log. Supabase Realtime announces new events to open screens, checking the same access rules
-- as reading ("events: read what you may see"), so nobody hears about an event they couldn't read.
alter publication supabase_realtime add table public.events;
