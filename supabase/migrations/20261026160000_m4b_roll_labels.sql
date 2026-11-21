-- M4b re-test ruling 9 (2026-10-26): a draft's rolls (its HP and starting money) stay visible to the GM, labelled
-- "draft · {Name}". The draft hides the unfinished character, not the dice; the GM can't read the draft itself, so
-- the roll carries its own label. Adds one column. Drops nothing.

alter table public.rolls add column label text not null default '' check (char_length(label) <= 120);
