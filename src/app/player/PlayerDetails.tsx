import { useId, type ReactNode } from "react";
import { Icon } from "../../ui/icons.tsx";
import { TapValue } from "../../ui/parts.tsx";
import type { DetailEntry, DetailRow, SheetDetails } from "../CharacterSheet.tsx";
import { DetailsLedger } from "../SheetParts.tsx";
import { useDetailsOpen } from "./detailsOpen.ts";
import "./PlayerDetails.css";

/** One line of Details: its label, its words, and its entry when its value has one in the pack (pib-3). */
export type DetailsItem = {
  key: string;
  label: string;
  value: ReactNode;
  entry: DetailEntry | null;
};

const written = (value: ReactNode) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  value !== "—" &&
  !(typeof value === "string" && value.trim() === "");

const itemOf = (r: DetailRow): DetailsItem => ({
  key: r.key,
  label: r.label,
  value: r.value,
  entry: r.entry ?? null,
});

/**
 * What Details holds, in frame P3's order (pib-3): the layout's own fields in the player's words (Motto); then who
 * they are (Kindred, Class, Alignment) and the layout's other values from a pack list (Background), each with its
 * entry where the pack has one; then the results of the kindred's tables (Looks, Manner, Trinket); then the backstory
 * under its "Backstory" label. Each line only where something is written ("—" is nothing written). Empty when there's
 * nothing.
 */
export function detailsItems(
  details: SheetDetails | null | undefined,
): DetailsItem[] {
  if (!details) return [];
  const shown = (rows: DetailRow[] | undefined) =>
    (rows ?? []).filter((r) => written(r.value)).map(itemOf);
  const fields = shown(details.rows);
  const story = (details.story ?? "").trim();
  return [
    ...fields.filter((i) => !i.entry),
    ...shown(details.who),
    ...fields.filter((i) => i.entry),
    ...shown(details.tables),
    ...(story
      ? [{ key: "backstory", label: "Backstory", value: story, entry: null }]
      : []),
  ];
}

/** "Hornkin. Hill-folk who…": the entry's name as its tap, then its own short line (P3). */
function EntryWords({ entry }: { entry: DetailEntry }) {
  const line = entry.line.trim();
  const stop = /[.!?]$/.test(entry.name.trim()) ? " " : ". ";
  return (
    <>
      <TapValue label={`${entry.name}: open its entry`} onTap={entry.open}>
        {entry.name}
      </TapValue>
      {entry.rolled ? `, ${entry.rolled}` : ""}
      {line ? `${stop}${line}` : ""}
    </>
  );
}

/**
 * Details, last in the Player screen's left column (dec-13 C4; ps-3; page M1, approved 2026-11-19): the sheet's details
 * and backstory in the pack's and the player's own words, as the book's labelled lines (the label in the book's label
 * colour, then the words). Folded, the heading "Details" and its chevron alone, no lines (tfr-1); the whole heading row
 * is the tap, and it opens all of it in place, pushing what follows down; a tap on the heading folds it again. The tab
 * remembers on this device, for each character, whether it was left open (euf-1); folded by default. Frame P3 (pss-1,
 * pib-3): each entry's name is a tap to its entry, the backstory has its "Backstory" label, and with nothing written
 * or chosen there is no Details part at all. The sheet hands the lines over as data (`SheetParts.details`); the full
 * sheet's own "Details and backstory" is as it was ("Nothing written yet.", psb-8).
 */
export function PlayerDetails({
  part,
  characterId,
}: {
  part: SheetDetails | null | undefined;
  /** Whose Details: its fold is remembered per character on this device (euf-1). None: not remembered. */
  characterId?: string | null | undefined;
}) {
  const [open, setOpen] = useDetailsOpen(characterId);
  const id = useId();
  const items = detailsItems(part);
  // The GM's hidden fields: their own group under their heading, as the sheet drew them before C4, never folded away
  // (tfr-1's note for the builder) and never among the player's lines (the review of #910). A player's sheet hands
  // none over.
  const hasHidden = !!part?.hidden && part.hidden.rows.length > 0;
  const hidden = hasHidden && part?.hidden && (
    <>
      <h3 className="sheet__group-title">{part.hidden.label}</h3>
      <DetailsLedger rows={part.hidden.rows} story="" />
    </>
  );
  // Nothing written or chosen: no part at all (P3). While the sheet opens (no part yet) the heading stays.
  if (part !== undefined && items.length === 0 && !hasHidden) return null;
  return (
    <section
      className="sheet__section sheet__block player-details-section"
      aria-label="Details"
    >
      <h2 className="sheet__label player-details__heading">
        <button
          type="button"
          className={`player-details__fold${open ? " player-details__fold--open" : ""}`}
          aria-expanded={open}
          {...(open && part !== undefined ? { "aria-controls": id } : {})}
          onClick={() => setOpen(!open)}
        >
          <span>Details</span>
          <span className="player-details__mark" aria-hidden="true">
            <Icon name="chevron" size={20} />
          </span>
        </button>
      </h2>
      {/* While the sheet opens (no part yet) a Details left open shows nothing under its heading, rather than saying
          "Nothing written yet." for a moment (the local review of #1068); the sentence is for a sheet with no lines. */}
      {open && part !== undefined && (
        <div id={id} className="player-details">
          {items.length === 0 ? (
            <p className="auth__meta">Nothing written yet.</p>
          ) : (
            items.map((item) => (
              <p
                key={item.key}
                className={
                  item.key === "backstory"
                    ? "book-line player-details__story"
                    : "book-line"
                }
              >
                <span className="book-label">{item.label}</span>{" "}
                {item.entry ? <EntryWords entry={item.entry} /> : item.value}
              </p>
            ))
          )}
        </div>
      )}
      {hidden}
    </section>
  );
}
