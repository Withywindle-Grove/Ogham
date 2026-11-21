// @vitest-environment jsdom
// The GM reference screen (docs/05 "The GM reference screen", M5 gate B4; invented words only). What it checks, on a
// phone-width screen (no matchMedia: the panel list is the first screen, a panel opens over it):
//   * the pack switcher shows only with two or more packs, and switches the panel list;
//   * the search never takes focus by itself (A4), and finds entries in any panel of any attached pack;
//   * a pack's own panel comes after the standard ones, under "The book's GM pages" (tf-10), with no tag;
//   * a table named in an entry opens, and back returns to the panel;
//   * an empty setting says so; the screen reopens on the panel last used;
//   * only the GM has a route to the screen (the top row's Reference icon); the place card no longer has one.
// The mapping itself (what fills each panel) is tested in src/modules/library/gmReference.test.ts.
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../core/supabase.ts";
import type {
  CampaignEntry,
  CampaignPack,
} from "../modules/library/campaignPacks.ts";
import type { PackKind } from "../modules/library/packFile.ts";
import type { OpenCampaign } from "./Campaigns.tsx";
import {
  GmReference,
  GmReferenceProvider,
  ReferenceBook,
} from "./GmReference.tsx";
import { TopRow } from "./TopRow.tsx";

vi.mock("./services.ts", async () => {
  const { createAppRegistry } = await import("./commandRegistry.ts");
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

const pack = (
  packId: string,
  name: string,
  kind: PackKind = "setting",
): CampaignPack => ({
  id: `link-${packId}`,
  campaignId: "c",
  packId,
  name,
  shortName: name,
  version: "1",
  kind,
  optionChoices: {},
  priority: 0,
  overrides: {},
  campaignHomebrew: false,
});

const item = (
  packId: string,
  id: string,
  name: string,
  note: string,
): CampaignEntry => ({
  kind: "item",
  packId,
  packEntryId: id,
  name,
  data: { category: "gear", description: note },
});

const rules = (packId: string, gmReference: unknown[]): CampaignEntry => ({
  kind: "rulesSet",
  packId,
  packEntryId: `${packId}-rules`,
  name: "Rules",
  data: { gmReference },
});

const fenPanel = {
  id: "fen",
  title: "Fen rules",
  entries: [{ heading: "Wading", text: "Slow going through reeds." }],
};

const book = (packs: CampaignPack[], entries: CampaignEntry[]) =>
  render(<ReferenceBook campaignId="c" packs={packs} entries={entries} />);

// Two packs, each with an equipment panel; only the second has the word "lantern oil".
const twoPacks = () => ({
  packs: [pack("b", "Bog setting"), pack("a", "Base rules")],
  entries: [
    item("a", "rope", "Rope", "Fifty feet of hemp."),
    item("b", "oil", "Flask", "Holds lantern oil."),
  ],
});

describe("the GM reference screen", () => {
  it("The pack switcher appears only with two or more packs", async () => {
    const user = userEvent.setup();
    const one = book(
      [pack("a", "Base rules")],
      [item("a", "rope", "Rope", "Hemp.")],
    );
    expect(screen.queryByRole("group", { name: "Packs" })).toBeNull();
    one.unmount();

    const { packs, entries } = twoPacks();
    book(packs, [...entries, rules("b", [fenPanel])]);
    const group = screen.getByRole("group", { name: "Packs" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    // The stack is given top first and shown base first, so the base rules are the shown pack.
    const shown = within(group).getByRole("button", { name: "Base rules" });
    const other = within(group).getByRole("button", { name: "Bog setting" });
    expect(shown.getAttribute("aria-pressed")).toBe("true");
    expect(other.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: /Fen rules/ })).toBeNull();

    await user.click(other);
    expect(other.getAttribute("aria-pressed")).toBe("true");
    expect(shown.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /Fen rules/ })).toBeTruthy();
  });

  it("The search field never takes focus by itself (A4)", () => {
    const { packs, entries } = twoPacks();
    book(packs, entries);
    const search = screen.getByLabelText("Search the rules");
    expect(document.activeElement).not.toBe(search);
  });

  it("Search finds an entry in any panel and in any attached pack", async () => {
    const user = userEvent.setup();
    const { packs, entries } = twoPacks();
    book(packs, entries);
    await user.type(screen.getByLabelText("Search the rules"), "lantern oil");
    const hit = screen.getByRole("article", { name: "Flask" });
    expect(within(hit).getByText("Equipment, Bog setting")).toBeTruthy();
    expect(screen.queryByRole("article", { name: "Rope" })).toBeNull();
  });

  // tf-10: the list's two quiet headings, From the rules then The book's GM pages; no "pack" tag.
  it("A gmReference panel shows after the standard ones, under The book's GM pages, with no tag", () => {
    const entries = [
      item("a", "rope", "Rope", "Hemp."),
      rules("a", [fenPanel]),
    ];
    const first = book([pack("a", "Base rules")], entries);
    const nav = screen.getByRole("navigation", { name: "Panels" });
    expect(within(nav).getAllByRole("heading").map((h) => h.textContent)).toEqual(["From the rules", "The book's GM pages"]);
    const buttons = within(nav).getAllByRole("button");
    expect(buttons[0]!.textContent).toContain("Equipment");
    expect(buttons[buttons.length - 1]!.textContent).toBe("Fen rules›");
    expect(nav.textContent).not.toMatch(/pack|adventure/);
    first.unmount();

    book([pack("a", "Lantern trail", "adventure")], entries);
    const again = within(screen.getByRole("navigation", { name: "Panels" }));
    expect(again.getAllByRole("button").at(-1)!.textContent).toBe("Fen rules›");
  });

  it("A table named in an entry opens the table, and back returns to the panel", async () => {
    const user = userEvent.setup();
    const table: CampaignEntry = {
      kind: "table",
      packId: "a",
      packEntryId: "bog-table",
      name: "Bog lurker sightings",
      data: {
        die: "d6",
        rows: [{ min: 1, max: 6, result: "A ripple in the reeds" }],
      },
    };
    const panel = {
      id: "fen",
      title: "Fen rules",
      entries: [
        { heading: "Wading", text: "Slow going.", tableId: "bog-table" },
      ],
    };
    book([pack("a", "Base rules")], [table, rules("a", [panel])]);

    await user.click(screen.getByRole("button", { name: /Fen rules/ }));
    await user.click(screen.getByRole("button", { name: "Open the table ›" }));
    expect(screen.getAllByText(/Bog lurker sightings/).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByRole("button", { name: "Open the table ›" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "‹ Fen rules" }));
    expect(
      screen.getByRole("button", { name: "Open the table ›" }),
    ).toBeTruthy();
  });

  it('A setting with nothing to show reads "No reference in this setting."', () => {
    book([pack("a", "Base rules")], []);
    expect(screen.getByText("No reference in this setting.")).toBeTruthy();
  });

  it("It reopens on the panel last used", async () => {
    const user = userEvent.setup();
    const entries = [
      item("a", "rope", "Rope", "Hemp."),
      rules("a", [fenPanel]),
    ];
    const first = book([pack("a", "Base rules")], entries);
    await user.click(screen.getByRole("button", { name: /Fen rules/ }));
    expect(screen.getByRole("heading", { name: /Fen rules/ })).toBeTruthy();
    first.unmount();

    book([pack("a", "Base rules")], entries);
    // On a phone the list comes first; the panel last used is the one marked as current.
    const current = within(screen.getByRole("navigation", { name: "Panels" }))
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-current") === "true");
    expect(current?.textContent).toContain("Fen rules");
  });
});

describe("the way in to the reference", () => {
  const campaign = (role: "gm" | "player"): OpenCampaign => ({
    id: "c",
    name: "The Ash Barrows",
    role,
    line: null,
  });
  // A db whose every call fails: the screen shows its error line, which is enough to see that it opened.
  const brokenDb = {
    from: () => {
      throw new Error("offline");
    },
  } as unknown as Db;
  const row = () => <TopRow back="Your campaigns" onBack={() => undefined} />;

  it("Players have no route to the screen", async () => {
    const user = userEvent.setup();
    render(row());
    expect(screen.queryByRole("button", { name: "Reference" })).toBeNull();
    cleanup();

    render(
      <GmReferenceProvider db={brokenDb} campaign={campaign("player")}>
        {row()}
      </GmReferenceProvider>,
    );
    expect(screen.queryByRole("button", { name: "Reference" })).toBeNull();
    cleanup();

    render(
      <GmReferenceProvider db={brokenDb} campaign={campaign("gm")}>
        {row()}
      </GmReferenceProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Reference" }));
    expect(screen.getByRole("dialog", { name: "Reference" })).toBeTruthy();
  });

  it("The screen says so when the setting rules cannot be loaded", async () => {
    render(<GmReference db={brokenDb} campaign={campaign("gm")} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
