import { useId, type ReactNode } from "react";
import { Icon } from "../../ui/icons.tsx";
import type { SheetDetails } from "../CharacterSheet.tsx";
import { DetailsLedger } from "../SheetParts.tsx";
import { useDetailsOpen } from "./detailsOpen.ts";
import "./PlayerDetails.css";

/** One line of Details: a labelled line in the book's entry form, or the backstory (no label: the player's own words). */
export type DetailsItem = {
  key: string;
  label: string | null;
  value: ReactNode;
};

const written = (value: ReactNode) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  value !== "—" &&
  !(typeof value === "string" && value.trim() === "");

/**
 * What Details holds, in the sheet's order: the details from the kindred's tables and the layout's own fields (each
 * line only where something is written; "—" is nothing written), then the backstory. Empty when there's nothing.
 */
export function detailsItems(
  details: SheetDetails | null | undefined,
): DetailsItem[] {
  if (!details) return [];
  const rows: DetailsItem[] = details.rows
    .filter((r) => written(r.value))
    .map((r) => ({ key: r.key, label: r.label, value: r.value }));
  const story = (details.story ?? "").trim();
  return story
    ? [...rows, { key: "backstory", label: null, value: story }]
    : rows;
}

/**
 * Details, last in the Player screen's left column (dec-13 C4; ps-3; page M1, approved 2026-11-19): the sheet's details
 * and backstory in the pack's and the player's own words, as the book's labelled lines (the label in the book's label
 * colour, then the words). Folded, the heading "Details" and its chevron alone, no lines (tfr-1); the whole heading row
 * is the tap, and it opens all of it in place, pushing what follows down; a tap on the heading folds it again. The tab
 * remembers on this device, for each character, whether it was left open (euf-1); folded by default. With nothing
 * written it opens on "Nothing written yet.", as the sheet says it. The sheet hands the lines over as data
 * (`SheetParts.details`); the full sheet's own "Details and backstory" is as it was.
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
  const hidden = part?.hidden && part.hidden.rows.length > 0 && (
    <>
      <h3 className="sheet__group-title">{part.hidden.label}</h3>
      <DetailsLedger rows={part.hidden.rows} story="" />
    </>
  );
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
            items.map((item) =>
              item.label === null ? (
                <p
                  key={item.key}
                  className="book-paragraph player-details__story"
                >
                  {item.value}
                </p>
              ) : (
                <p key={item.key} className="book-line">
                  <span className="book-label">{item.label}</span>{" "}
                  {item.value}
                </p>
              ),
            )
          )}
        </div>
      )}
      {hidden}
    </section>
  );
}
