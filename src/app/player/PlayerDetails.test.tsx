// @vitest-environment jsdom
// Details on the Player screen (dec-13 C4; ps-3; page M1, approved 2026-11-19: tfr-1, euf-1). Invented names and words.
// Purposes:
//   1. Each line is the book's labelled line: the label in the book's label colour, then the pack's or player's words.
//   2. Folded, Details shows its heading and chevron alone, no line; a tap on the heading row (named "Details") shows
//      every line in place, and folds it again (tfr-1, C5).
//   3. A tap on a figure inside an open line keeps its own tap and does not fold Details.
//   4. Folded is the default, however few lines there are: one line folds as five do.
//   5. A line with nothing written ("—" or empty) is left out; with nothing at all, opening it says "Nothing written yet.".
//   6. The backstory is the player's own words, with no label, after the lines.
//   7. A long value shows whole; 0 and 999 show as written.
//   8. Literacy's line under Languages, where the pack has no literacy rule, is the pack's word as a sentence: a
//      character who can't read says so there ("Cannot read."); nothing written gives no line; a checkbox or a
//      number gives none either.
//   9. The GM's hidden fields are their own group under "Hidden fields", never among the player's lines, and shown
//      while Details is folded.
//  10. Details left open is open when the tab is opened again; left folded, it is folded (euf-1, P1).
//  11. Each character's Details is remembered on its own: opening one leaves another folded.
//  12. Storage that is empty, holds something else, or fails gives folded, and a tap still opens and folds.
//  13. Left open, while the sheet opens it shows nothing under the heading (not "Nothing written yet."), then the lines.
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
    expect(lines()).toHaveLength(5);
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

  it("leaves out a line with nothing written, and opens on “Nothing written yet.” when there is nothing at all", async () => {
    const user = userEvent.setup();
    expect(
      detailsItems({
        rows: [row("Motto", "—"), row("Looks", ""), row("Manner", "  ")],
        story: " ",
      }),
    ).toEqual([]);
    expect(detailsItems(null)).toEqual([]);
    render(<PlayerDetails part={{ rows: [row("Motto", "—")], story: "" }} />);
    const region = screen.getByRole("region", { name: "Details" });
    expect(within(region).queryByText("Nothing written yet.")).toBeNull();
    await openIt(user);
    expect(within(region).getByText("Nothing written yet.")).toBeTruthy();
    expect(lines()).toEqual([]);
  });

  it("puts the backstory after the lines, in the player’s words with no label", async () => {
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
    const story = screen.getByText("The reeds remember.");
    expect(story.classList.contains("player-details__story")).toBe(true);
    expect(story.querySelector(".book-label")).toBeNull();
    expect(lines()).toEqual(["Motto Ask the water first."]);
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
    expect(lines()).toHaveLength(5);
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
    // Purpose (the local review of #1068): no "Nothing written yet." for a moment before the lines arrive.
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
    expect(lines()).toHaveLength(5);
    // A sheet with nothing written still says so.
    view.rerender(
      <PlayerDetails part={null} characterId="char-brannoch" />,
    );
    expect(screen.getByText("Nothing written yet.")).toBeTruthy();
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
    expect(lines()).toHaveLength(5);
    await openIt(user);
    expect(heading().getAttribute("aria-expanded")).toBe("false");
  });
});
