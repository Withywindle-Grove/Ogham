// @vitest-environment jsdom
// Details on the Player screen (dec-13 C4; ps-3; page M1, approved 2026-11-19: tfr-1, euf-1). Invented names and words.
// Purposes:
//   1. Each line is the book's labelled line: the label in the book's label colour, then the pack's or player's words.
//   2. Folded, Details shows its heading and chevron alone, no line; a tap on the heading row (named "Details") shows
//      every line in place, and folds it again (tfr-1, C5).
//   3. A tap on a figure inside an open line keeps its own tap and does not fold Details.
//   4. Folded is the default, however few lines there are: one line folds as five do.
//   5. A line with nothing written ("—" or empty) is left out; with nothing at all there is no Details part (P3).
//   6. The backstory is the player's own words, after the lines, under its "Backstory" label (P3, pss-1).
//   7. A long value shows whole; 0 and 999 show as written.
//   8. Literacy's line under Languages, where the pack has no literacy rule, is the pack's word as a sentence: a
//      character who can't read says so there ("Cannot read."); nothing written gives no line; a checkbox or a
//      number gives none either.
//   9. The GM's hidden fields are their own group under "Hidden fields", never among the player's lines, and shown
//      while Details is folded.
//  10. Details left open is open when the tab is opened again; left folded, it is folded (euf-1, P1).
//  11. Each character's Details is remembered on its own: opening one leaves another folded.
//  12. Storage that is empty, holds something else, or fails gives folded, and a tap still opens and folds.
//  13. Left open, while the sheet opens it shows nothing under the heading, then the lines.
//  14. The lines come in frame P3's order (pib-3): the player's own words (Motto), then who they are (Kindred, Class,
//      Alignment) and the other lines from a pack list (Background), then the kindred's tables (Looks, Manner,
//      Trinket), then the backstory under its "Backstory" label; each line says whether it has an entry, and its
//      entry's short line.
//  15. A line with an entry draws its name as a tap named "<name>: open its entry", then the entry's own short line;
//      the tap opens the entry and does not fold Details. A name with no entry is plain words.
//  16. With nothing written and nothing chosen, the Player tab draws no Details part at all; the Kindred line alone
//      keeps it.
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { literacySentence, type SheetDetails } from "../CharacterSheet.tsx";
import { getDetailsOpen, setDetailsOpen } from "./detailsOpen.ts";
import { PlayerDetails, detailsItems } from "./PlayerDetails.tsx";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const row = (label: string, value: SheetDetails["rows"][number]["value"]) => ({
  key: label.toLowerCase(),
  label,
  value,
});
const brannoch: SheetDetails = {
  rows: [
    row("Motto", "“Head down, and forward.”"),
    row("Looks", "A notched left horn."),
    row("Background", "Drover."),
    row("Manner", "Speaks slowly, and means it."),
    row("Trinket", "A cow-bell with no clapper."),
  ],
  story: "He drove the Seven Cairns herd for nine summers.",
};
const lines = () =>
  [...document.querySelectorAll(".player-details .book-line")].map(
    (p) => p.textContent,
  );
const heading = () => screen.getByRole("button", { name: "Details" });
const openIt = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(heading());

describe("Details on the Player screen (C4, C5)", () => {
  it("draws each line as the book’s labelled line, label then words", async () => {
    const user = userEvent.setup();
    render(
      <PlayerDetails part={{ rows: brannoch.rows.slice(0, 2), story: "" }} />,
    );
    await openIt(user);
    const region = screen.getByRole("region", { name: "Details" });
    const labels = [...region.querySelectorAll(".book-line > .book-label")].map(
      (l) => l.textContent,
    );
    expect(labels).toEqual(["Motto", "Looks"]);
    expect(lines()).toEqual([
      "Motto “Head down, and forward.”",
      "Looks A notched left horn.",
    ]);
  });

  it("folded, shows its heading and chevron alone; a tap shows every line in place, and folds it again", async () => {
    const user = userEvent.setup();
    render(<PlayerDetails part={brannoch} />);
    const region = screen.getByRole("region", { name: "Details" });
    // Folded: the heading row (its words and the chevron) and nothing else.
    expect(within(region).getByRole("heading", { name: "Details" })).toBeTruthy();
    expect(heading().querySelector(".icon")).not.toBeNull();
    expect(heading().getAttribute("aria-expanded")).toBe("false");
    expect(lines()).toEqual([]);
    expect(screen.queryByText(brannoch.story)).toBeNull();
    expect(region.querySelector(".player-details")).toBeNull();
    await openIt(user);
    expect(heading().getAttribute("aria-expanded")).toBe("true");
    expect(lines()).toHaveLength(6);
    expect(screen.getByText(brannoch.story)).toBeTruthy();
    // The heading row stays where it was: the lines come under it.
    expect(
      heading().compareDocumentPosition(screen.getByText(brannoch.story)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await openIt(user);
    expect(heading().getAttribute("aria-expanded")).toBe("false");
    expect(lines()).toEqual([]);
  });

  it("keeps a figure’s own tap inside an open line, and does not fold", async () => {
    const user = userEvent.setup();
    const figure = vi.fn();
    const withFigure: SheetDetails = {
      rows: [
        row(
          "Height",
          <button type="button" onClick={figure}>
            Tall
          </button>,
        ),
        ...brannoch.rows,
      ],
      story: "",
    };
    render(<PlayerDetails part={withFigure} />);
    await openIt(user);
    await user.click(screen.getByRole("button", { name: "Tall" }));
    expect(figure).toHaveBeenCalledOnce();
    expect(heading().getAttribute("aria-expanded")).toBe("true");
  });

  it("folds one line as it folds five", async () => {
    const user = userEvent.setup();
    render(
      <PlayerDetails part={{ rows: brannoch.rows.slice(0, 1), story: "" }} />,
    );
    expect(lines()).toEqual([]);
    await openIt(user);
    expect(lines()).toEqual(["Motto “Head down, and forward.”"]);
  });

  it("leaves out a line with nothing written, and draws no part when there is nothing at all", () => {
    expect(
      detailsItems({
        rows: [row("Motto", "—"), row("Looks", ""), row("Manner", "  ")],
        story: " ",
      }),
    ).toEqual([]);
    expect(detailsItems(null)).toEqual([]);
    setDetailsOpen("char-brannoch", true);
    render(
      <PlayerDetails
        part={{ rows: [row("Motto", "—")], story: "" }}
        characterId="char-brannoch"
      />,
    );
    expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
    expect(screen.queryByText("Nothing written yet.")).toBeNull();
  });

  it("puts the backstory after the lines, in the player’s words under its “Backstory” label", async () => {
    const user = userEvent.setup();
    render(
      <PlayerDetails
        part={{
          rows: [row("Motto", "Ask the water first.")],
          story: "  The reeds remember.  ",
        }}
      />,
    );
    await openIt(user);
    const story = screen.getByText(/The reeds remember\./);
    expect(story.classList.contains("player-details__story")).toBe(true);
    expect(lines()).toEqual([
      "Motto Ask the water first.",
      "Backstory The reeds remember.",
    ]);
  });

  it("shows a long value whole, and 0 and 999 as written", async () => {
    const user = userEvent.setup();
    const long =
      "A drover’s coat two sizes too small, patched at both elbows with sailcloth from a boat that sank in the Reed Marches the year the river ran backwards. "
        .repeat(3)
        .trim();
    render(
      <PlayerDetails
        part={{
          rows: [row("Looks", long), row("Scars", 0), row("Coins hidden", 999)],
          story: "",
        }}
      />,
    );
    await openIt(user);
    expect(lines()).toEqual([`Looks ${long}`, "Scars 0", "Coins hidden 999"]);
  });

  it("says the literacy under Languages in the pack’s word, as a sentence", () => {
    expect(literacySentence("Reads and writes")).toBe("Reads and writes.");
    expect(literacySentence("cannot read")).toBe("Cannot read.");
    expect(literacySentence("Reads slowly.")).toBe("Reads slowly.");
    expect(literacySentence("—")).toBe("");
    expect(literacySentence("  ")).toBe("");
  });

  it("makes no sentence from a checkbox’s value or a number", () => {
    expect(literacySentence(true)).toBe("");
    expect(literacySentence(false)).toBe("");
    expect(literacySentence(2)).toBe("");
    expect(literacySentence("2")).toBe("");
  });

  it("draws the GM’s hidden fields under their own heading, never folded away and never among the lines", async () => {
    const user = userEvent.setup();
    render(
      <PlayerDetails
        part={{
          ...brannoch,
          hidden: {
            label: "Hidden fields",
            rows: [row("Old oath", "Sworn to the drowned bell.")],
          },
        }}
      />,
    );
    const region = screen.getByRole("region", { name: "Details" });
    // Shown while the player's lines are folded.
    expect(heading().getAttribute("aria-expanded")).toBe("false");
    expect(
      within(region).getByRole("heading", { name: "Hidden fields" }),
    ).toBeTruthy();
    expect(within(region).getByText("Sworn to the drowned bell.")).toBeTruthy();
    // Opened: still not one of the player's lines.
    await openIt(user);
    expect(lines().some((l) => l?.includes("Old oath"))).toBe(false);
    expect(within(region).getByText("Sworn to the drowned bell.")).toBeTruthy();
  });

  it("draws the hidden fields under their heading when nothing else is written", async () => {
    const user = userEvent.setup();
    render(
      <PlayerDetails
        part={{
          rows: [],
          story: "",
          hidden: { label: "Hidden fields", rows: [row("Old oath", "Sworn.")] },
        }}
      />,
    );
    const region = screen.getByRole("region", { name: "Details" });
    expect(
      within(region).getByRole("heading", { name: "Hidden fields" }),
    ).toBeTruthy();
    expect(within(region).getByText("Sworn.")).toBeTruthy();
    await openIt(user);
    expect(within(region).getByText("Nothing written yet.")).toBeTruthy();
  });
});

describe("Details as frame P3 draws it (pib-3)", () => {
  const entry = (name: string, line: string, open = vi.fn()) => ({
    name,
    line,
    open,
  });
  const p3: SheetDetails = {
    rows: [
      row("Motto", "“Head down, and forward.”"),
      {
        key: "background",
        label: "Background",
        value: "Drover",
        entry: entry("Drover", "Knows beasts, weather and the price of both."),
      },
    ],
    who: [
      {
        key: "kindred",
        label: "Kindred",
        value: "Hornkin",
        entry: entry("Hornkin", "Hill-folk who settle a quarrel head first."),
      },
      {
        key: "class",
        label: "Class",
        value: "Fighter",
        entry: entry("Fighter", "Stands where the blows fall."),
      },
      { key: "alignment", label: "Alignment", value: "Lawful" },
    ],
    tables: [
      row("Looks", "A notched left horn."),
      row("Manner", "Speaks slowly, and means it."),
      row("Trinket", "A cow-bell with no clapper."),
    ],
    story: "Brannoch drove the Seven Cairns herd.",
  };

  it("puts the lines in P3’s order, says which have an entry and its short line, and labels the backstory", () => {
    const items = detailsItems(p3);
    expect(items.map((i) => i.label)).toEqual([
      "Motto",
      "Kindred",
      "Class",
      "Alignment",
      "Background",
      "Looks",
      "Manner",
      "Trinket",
      "Backstory",
    ]);
    expect(
      items.map((i) => (i.entry ? `${i.entry.name}. ${i.entry.line}` : null)),
    ).toEqual([
      null,
      "Hornkin. Hill-folk who settle a quarrel head first.",
      "Fighter. Stands where the blows fall.",
      null,
      "Drover. Knows beasts, weather and the price of both.",
      null,
      null,
      null,
      null,
    ]);
    expect(items.at(-1)?.value).toBe("Brannoch drove the Seven Cairns herd.");
  });

  it("draws an entry’s name as its tap, then the entry’s short line; a name with no entry is plain words", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    render(
      <PlayerDetails
        part={{
          ...p3,
          who: [
            {
              key: "kindred",
              label: "Kindred",
              value: "Hornkin",
              entry: entry("Hornkin", "Hill-folk who settle a quarrel head first.", open),
            },
            { key: "alignment", label: "Alignment", value: "Lawful" },
          ],
        }}
      />,
    );
    await openIt(user);
    expect(lines()).toContain(
      "Kindred Hornkin. Hill-folk who settle a quarrel head first.",
    );
    expect(lines()).toContain("Alignment Lawful");
    expect(lines()).toContain(
      "Backstory Brannoch drove the Seven Cairns herd.",
    );
    expect(screen.queryByRole("button", { name: "Lawful: open its entry" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Hornkin: open its entry" }),
    );
    expect(open).toHaveBeenCalledOnce();
    expect(heading().getAttribute("aria-expanded")).toBe("true");
  });

  it("draws no Details part with nothing at all; the Kindred line alone keeps it", async () => {
    const user = userEvent.setup();
    const view = render(
      <PlayerDetails part={{ rows: [row("Motto", "—")], story: " " }} />,
    );
    expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
    view.rerender(
      <PlayerDetails
        part={{
          rows: [],
          who: [
            {
              key: "kindred",
              label: "Kindred",
              value: "Hornkin",
              entry: entry("Hornkin", "Hill-folk who settle a quarrel head first."),
            },
          ],
          story: "",
        }}
      />,
    );
    await openIt(user);
    expect(lines()).toEqual([
      "Kindred Hornkin. Hill-folk who settle a quarrel head first.",
    ]);
  });
});

describe("Details remembers, on this device, for each character (euf-1, P1)", () => {
  it("is open when the tab is opened again after it was left open, and folded after it was left folded", async () => {
    const user = userEvent.setup();
    const first = render(
      <PlayerDetails part={brannoch} characterId="char-brannoch" />,
    );
    await openIt(user);
    expect(getDetailsOpen("char-brannoch")).toBe(true);
    first.unmount();
    // The tab opened again.
    const second = render(
      <PlayerDetails part={brannoch} characterId="char-brannoch" />,
    );
    expect(heading().getAttribute("aria-expanded")).toBe("true");
    expect(lines()).toHaveLength(6);
    await openIt(user);
    second.unmount();
    render(<PlayerDetails part={brannoch} characterId="char-brannoch" />);
    expect(heading().getAttribute("aria-expanded")).toBe("false");
    expect(lines()).toEqual([]);
  });

  it("keeps each character’s on its own", async () => {
    const user = userEvent.setup();
    const view = render(
      <PlayerDetails part={brannoch} characterId="char-brannoch" />,
    );
    await openIt(user);
    // Another character in the same place reads its own, folded.
    view.rerender(<PlayerDetails part={brannoch} characterId="char-wren" />);
    expect(heading().getAttribute("aria-expanded")).toBe("false");
    view.rerender(
      <PlayerDetails part={brannoch} characterId="char-brannoch" />,
    );
    expect(heading().getAttribute("aria-expanded")).toBe("true");
    expect(getDetailsOpen("char-wren")).toBe(false);
  });

  it("starts folded with nothing kept, with something else kept, or with no character", () => {
    expect(getDetailsOpen("char-brannoch")).toBe(false);
    localStorage.setItem("grimoire.detailsOpen", "not a list");
    expect(getDetailsOpen("char-brannoch")).toBe(false);
    localStorage.setItem("grimoire.detailsOpen", JSON.stringify({ a: 1 }));
    expect(getDetailsOpen("char-brannoch")).toBe(false);
    setDetailsOpen(null, true);
    expect(getDetailsOpen(null)).toBe(false);
    render(<PlayerDetails part={brannoch} characterId="char-brannoch" />);
    expect(heading().getAttribute("aria-expanded")).toBe("false");
  });

  it("left open, shows nothing under the heading while the sheet opens, then the lines", () => {
    // Purpose (the local review of #1068): no "Nothing written yet." for a moment before the lines arrive; a sheet with
    // nothing written then draws no part (P3).
    setDetailsOpen("char-brannoch", true);
    const view = render(
      <PlayerDetails part={undefined} characterId="char-brannoch" />,
    );
    expect(heading().getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByText("Nothing written yet.")).toBeNull();
    expect(document.querySelector(".player-details")).toBeNull();
    view.rerender(
      <PlayerDetails part={brannoch} characterId="char-brannoch" />,
    );
    expect(lines()).toHaveLength(6);
    view.rerender(
      <PlayerDetails part={null} characterId="char-brannoch" />,
    );
    expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
  });

  it("starts folded when storage fails, and a tap still opens and folds it", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<PlayerDetails part={brannoch} characterId="char-brannoch" />);
    expect(heading().getAttribute("aria-expanded")).toBe("false");
    await openIt(user);
    expect(heading().getAttribute("aria-expanded")).toBe("true");
    expect(lines()).toHaveLength(6);
    await openIt(user);
    expect(heading().getAttribute("aria-expanded")).toBe("false");
  });
});
