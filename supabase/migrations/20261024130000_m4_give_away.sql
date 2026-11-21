-- M4 gate run: giving an item to someone or something outside the party ("Other…": an NPC, a shrine, anything).
-- The line records who or what it went to just before it goes, so the log can say so. Adds a column and a logged
-- command; drops nothing.

alter table public.inventory_lines add column given_to text check (char_length(given_to) <= 100);

insert into public.logged_commands (name, level, gm_only) values ('inventory.giveAway', 'simple', false);
