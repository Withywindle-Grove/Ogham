// @vitest-environment jsdom
// The full sheet revised (plan m5b-sheet-revised, PR 1; mockup players/05), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Purposes:
//   The sections come in the ruled order on a tablet (two columns) and stacked in the same order on a phone, and the
//   removed blocks are absent.
//   The title shows by the name and nowhere else; the experience bonus is an Abilities row opening the prime table.
//   Every skill, ability and trait row opens its text; a language box opens the pack's text.
//   The saves' rule line is the first sentence of the pack's rule; the literacy line follows the pack's literacyNote;
//   with no rule there is no line.
//   A details edit saves at once with Undo.
//   A player's score change on an approved character is a request (the sheet keeps the old figure and its modifier, the
//   waiting line at the top says it, as the Player tab does (of-3); Take back withdraws it); the GM's Players tab lists it, Approve writes the figure, Refuse keeps the reason; the player
//   is told either way. The GM's own edit applies at once.
//   The Notes sheet lists the character's notes newest first, with when and who, and Add writes a note.
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../scripts/fixtures/m5b-creation.fixture.json?raw";
import { forgetFileLinks } from "../core/files.ts";
import { createFakeDb, type FakeWorld } from "../testing/fakeDb.ts";
import { Root } from "./App.tsx";
import { forgetCampaignSetting } from "./campaignSetting.ts";
import { openFullSheetFromMenu } from "../testing/openFullSheet.ts";

vi.mock("./services.ts", async () => {
  const { createAppRegistry } = await import("./commandRegistry.ts");
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

/** A window this many pixels wide (jsdom has no layout): matchMedia answers min-width and max-width queries. */
function windowOf(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches =
      (!min || width >= Number(min[1])) &&
      (!max || width <= Number(max[1])) &&
      Boolean(min || max);
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = {
  key: string;
  label: string;
  type: string;
  group?: string;
  fill?: string;
  choices?: string[];
  required?: boolean;
  from?: string;
};

interface Ids {
  gm: string;
  me: string;
  campaign: string;
  wren: string;
}

/**
 * The fixture on a campaign, and Wren (a bog folk Lantern Warden, level 1, leaning Lantern, two languages, approved) for
 * Sam; Priya is the GM. `rules` changes the rules set (a save rule, a literacy note).
 */
function fenWorld(rules: Record<string, unknown> = {}): Ids {
  const gm = world.addPerson("priya@lantern.example", "Priya");
  const me = world.addPerson("sam@lantern.example", "Sam");
  const campaign = world.addCampaign("The Ash Barrows", gm);
  world.tables.packs.push({
    id: "pack-fen",
    owner_user_id: gm,
    campaign_id: null,
    name: "Fen sample",
    version: "0.1",
    kind: "setting",
    format_version: 2,
    source: "",
    notes: "",
    updated_at: "2026-10-18T12:00:00Z",
    extra_meta: { shortName: "Fen sample" },
  });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({
      id: `entry-${kind}-${String(data.id)}`,
      pack_id: "pack-fen",
      kind,
      pack_entry_id: String(data.id),
      name: String(data.name ?? data.id),
      data,
    });
  for (const r of pack.rulesSets!) entry("rulesSet", { ...r, ...rules });
  for (const o of pack.options ?? []) entry("option", o);
  for (const r of pack.races!) entry("race", r);
  for (const c of pack.classes!) entry("class", c);
  for (const s of pack.spellLists ?? []) entry("spellList", s);
  for (const s of pack.spells ?? []) entry("spell", s);
  for (const t of pack.tables ?? []) entry("table", t);
  for (const h of pack.hooks!) entry("hook", h);
  for (const i of pack.items!) entry("item", i);
  for (const k of pack.startingKits!) entry("startingKit", k);
  for (const t of pack.traitLists!) entry("traitList", t);
  for (const t of pack.fieldTemplates!) entry("fieldTemplate", t);
  entry("xpTable", {
    id: "warden-xp",
    name: "Warden XP",
    levels: [
      { level: 1, xp: 0 },
      { level: 2, xp: 1500 },
    ],
  });
  world.tables.campaign_packs.push({
    id: "link-fen",
    campaign_id: campaign,
    pack_id: "pack-fen",
    pack_name: "Fen sample",
    option_choices: {},
    overrides: {},
    priority: 1,
  });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter(
    (f) => f.key !== "omen" && f.key !== "hp" && !f.from,
  );
  layout.forEach((f, order) => {
    const type = f.type === "list" && !f.choices?.length ? "text" : f.type;
    world.tables.field_definitions.push({
      id: `field-${f.key}`,
      campaign_id: campaign,
      applies_to: "pc",
      key: f.key,
      label: f.label,
      type,
      choices: f.choices ?? [],
      field_group: f.group ?? "",
      sort_order: order,
      show_on_card: false,
      hidden: false,
      fill: f.fill ?? null,
      required: !!f.required,
      from_list: null,
      created_at: "2026-10-18T12:00:00Z",
    });
  });
  const wren = world.addCharacter(campaign, "Wren", {
    ownerId: me,
    approval: "approved",
  });
  Object.assign(
    world.tables.actors.find((a) => a.id === wren)!,
    {
      level: 1,
      hp_current: 6,
      hp_max: 9,
      race_ref: "bog-folk",
      backstory: "Raised on the barges.",
      fields: {
        MUS: 13,
        NIM: 12,
        GRT: 11,
        WIT: 14,
        LORE: 9,
        CHARM: 10,
        languages: "Fen common, Heron-tongue",
      },
      classes: [{ classRef: "lantern-warden", level: 1, xp: 120 }],
    },
  );
  world.tables.character_alignments.push({
    actor_id: wren,
    campaign_id: campaign,
    owner_user_id: me,
    alignment: "Lantern",
    created_at: "2026-10-18T12:00:00Z",
    updated_at: "2026-10-18T12:00:00Z",
  });
  world.addMember(campaign, me, "player", wren);
  return { gm, me, campaign, wren };
}

const actorOf = (id: string) => world.tables.actors.find((a) => a.id === id)!;
const fieldsOf = (id: string) => actorOf(id).fields as Record<string, unknown>;

/** Signs in as this person and opens the app on the campaign. */
async function openCampaign(as: string): Promise<User> {
  world.signInAs(as);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(
    await screen.findByRole("button", { name: /The Ash Barrows/ }),
  );
  return user;
}

/** A player's Player screen, then the full sheet from the drawer's item (the tab's row is gone, tfr-5). */
async function openSheet(as: string): Promise<User> {
  const user = await openCampaign(as);
  await openFullSheetFromMenu(user);
  await screen.findByRole("region", { name: "Level" });
  return user;
}

/** The GM's Players tab, then Edit in Wren's ⋯ (page 32, pg32-1): Wren's sheet, on its form. */
async function openSheetAsGm(gm: string): Promise<User> {
  const user = await openCampaign(gm);
  await user.click(
    within(
      await screen.findByRole("navigation", { name: "Campaign sections" }),
    ).getByRole("button", { name: /^Players/ }),
  );
  await user.click(
    await screen.findByRole("button", { name: "More for Wren" }),
  );
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await screen.findByRole("form", { name: "Edit Wren" });
  return user;
}

const footOf = () => document.querySelector(".sheet__foot") as HTMLElement;

/** Edit (unless the form is open), then Muscle (or another score) stepped up by one, then Done in its sheet. */
async function stepScore(user: User, tile: RegExp, name: string, times = 1) {
  if (!screen.queryByRole("form", { name: "Edit Wren" }))
    await user.click(within(footOf()).getByRole("button", { name: "Edit" }));
  const form = within(await screen.findByRole("form", { name: "Edit Wren" }));
  await user.click(form.getByRole("button", { name: tile }));
  const dialog = within(await screen.findByRole("dialog", { name }));
  for (let n = 0; n < times; n += 1)
    await user.click(dialog.getByRole("button", { name: `More ${name}` }));
  await user.click(dialog.getByRole("button", { name: "Done" }));
}

/** The names of the sections directly in a column, in order. */
const sectionsIn = (column: Element) =>
  [...column.querySelectorAll(":scope > section[aria-label]")].map((s) =>
    s.getAttribute("aria-label"),
  );

const RIGHT = [
  "Level",
  "Saves",
  "Scores",
  "Movement",
  "Languages",
  "Skills",
  "Abilities",
  "Traits",
  "Details and backstory",
  "Notes",
];

describe("the sheet in the ruled order", () => {
  // Purpose: on a tablet the left column is who and how hurt (name, identity line, HP, AC, Attack, the hint) and the
  // right column has the sections in the ruled order; nothing else is on the left.
  it("has two columns on a tablet: the left column, then the right column in the ruled order", async () => {
    const { me } = fenWorld();
    await openSheet(me);
    const columns = document.querySelectorAll(
      ".sheet__columns--split > .sheet__column",
    );
    expect(columns).toHaveLength(2);
    const [left, right] = [columns[0]!, columns[1]!];
    // Left: the avatar's tap, the name, the identity line, the HP box, AC and Attack, the hint.
    const vitals = left.querySelector(".sheet__vitals") as HTMLElement;
    expect(left.children).toHaveLength(1);
    const parts = [
      ...vitals.querySelectorAll(
        ".sheet__heading, h1, .sheet__identity, .hp-box, .stat-tile, .vitals__hint",
      ),
    ].map((n) => n.className || n.tagName);
    expect(parts[0]).toContain("sheet__heading");
    expect(vitals.querySelector("h1")?.textContent).toBe("Wren");
    expect(vitals.querySelector(".sheet__identity")?.textContent).toBe(
      "Lamplighter, Lantern Warden 1, Bog folk",
    );
    expect(
      within(vitals).getByRole("button", { name: /^Hit points 6 of 9/ }),
    ).toBeTruthy();
    expect(
      within(vitals)
        .getAllByRole("button")
        .filter((b) => b.classList.contains("stat-tile")),
    ).toHaveLength(2);
    expect(
      within(vitals).getByText("Tap a figure for where it comes from"),
    ).toBeTruthy();
    // The order inside the left column: name, then HP, then the tiles, then the hint.
    const order = (selector: string) =>
      [...vitals.querySelectorAll("*")].indexOf(
        vitals.querySelector(selector)!,
      );
    expect(order("h1")).toBeLessThan(order(".sheet__identity"));
    expect(order(".sheet__identity")).toBeLessThan(
      order('[aria-label^="Hit points"]'),
    );
    expect(order('[aria-label^="Hit points"]')).toBeLessThan(
      order(".stat-tile--tap"),
    );
    expect(order(".stat-tile--tap")).toBeLessThan(order(".vitals__hint"));
    // Right: the sections in the ruled order (Magic would sit before Details, this class has none).
    expect(sectionsIn(right)).toEqual(RIGHT);
  });

  // Purpose: on a phone it is one column, the left column first, then the same sections in the same order.
  it("stacks the same order on a phone", async () => {
    windowOf(375);
    const { me } = fenWorld();
    await openSheet(me);
    expect(document.querySelectorAll(".sheet__columns--split")).toHaveLength(0);
    const columns = document.querySelectorAll(
      ".sheet__columns > .sheet__column",
    );
    expect(columns).toHaveLength(1);
    const column = columns[0]!;
    expect(column.firstElementChild?.classList.contains("sheet__vitals")).toBe(
      true,
    );
    expect(sectionsIn(column)).toEqual(RIGHT);
  });

  // Purpose: the Combat and Advancement blocks, the Pack load's fold rows, the Identity block and Change details are gone.
  it("has none of the removed blocks", async () => {
    const { me } = fenWorld();
    await openSheet(me);
    for (const name of [
      "Combat",
      "Advancement",
      "Identity",
      "Who they are",
      "Pack load",
    ])
      expect(screen.queryByRole("region", { name }), name).toBeNull();
    expect(document.querySelector(".sheet details.creation-fold")).toBeNull();
    expect(document.querySelector(".pack-load")).toBeNull();
    for (const words of [
      "Worn and in hand",
      "In the Backpack",
      "Carried",
      "Change details",
      "Hit dice",
    ])
      expect(screen.queryByText(words), words).toBeNull();
    expect(screen.queryByRole("button", { name: "Change details" })).toBeNull();
  });
});

describe("the title and the experience bonus", () => {
  // Purpose: the level title shows in the identity line by the name and nowhere else on the sheet.
  it("shows the title in the identity line only", async () => {
    const { me } = fenWorld();
    await openSheet(me);
    expect(screen.getAllByText("Lamplighter")).toHaveLength(1);
    expect(
      screen.getByText("Lamplighter").closest(".sheet__identity"),
    ).not.toBeNull();
    expect(screen.queryByText("Title")).toBeNull();
  });

  // Purpose: the experience bonus is a row in Abilities whose tap opens the prime table.
  it("lists the experience bonus under Abilities and opens the prime table", async () => {
    const { me } = fenWorld();
    const user = await openSheet(me);
    const abilities = within(screen.getByRole("region", { name: "Abilities" }));
    expect(
      within(screen.getByRole("region", { name: "Traits" })).queryByText(
        "Experience bonus",
      ),
    ).toBeNull();
    await user.click(
      abilities.getByRole("button", { name: /^Experience bonus/ }),
    );
    const sheet = within(
      await screen.findByRole("dialog", { name: "Experience bonus" }),
    );
    expect(
      sheet.getByRole("table", { name: "Prime score and experience" }),
    ).toBeTruthy();
  });
});

describe("rows open their text", () => {
  // Purpose: every skill, ability and trait row is a tap to its full text, and every one opens something that closes again.
  it("opens a text from every Skills, Abilities and Traits row", async () => {
    const { me } = fenWorld();
    const user = await openSheet(me);
    for (const name of ["Skills", "Abilities", "Traits"]) {
      const rows = within(screen.getByRole("region", { name })).getAllByRole(
        "button",
      );
      expect(rows.length, name).toBeGreaterThan(0);
      for (const row of rows) {
        await user.click(row);
        const dialogs = screen.getAllByRole("dialog");
        const top = within(dialogs.at(-1)!);
        expect(
          top.getAllByText(/\S/).length,
          `${name}: ${row.getAttribute("aria-label")}`,
        ).toBeGreaterThan(0);
        await user.click(
          top.queryAllByRole("button", { name: "Close" })[0] ??
            top.getByRole("button", { name: "Got it" }),
        );
        expect(screen.queryByRole("dialog")).toBeNull();
      }
    }
  });

  // Purpose: on the full sheet's own page every Skills, Abilities and Traits row that opens something carries a chevron,
  // as the shared block does on the Player screen (ch-1, dec-13 C13).
  it("every opening Skills, Abilities and Traits row carries a chevron", async () => {
    const { me } = fenWorld();
    await openSheet(me);
    for (const name of ["Skills", "Abilities", "Traits"]) {
      const rows = within(screen.getByRole("region", { name })).getAllByRole(
        "button",
      );
      expect(rows.length, name).toBeGreaterThan(0);
      for (const row of rows)
        expect(
          row.querySelector(".list-row__chevron"),
          `${name}: ${row.getAttribute("aria-label")}`,
        ).not.toBeNull();
    }
  });

  // Purpose: a skill rolled the target or higher on a d6 shows the d6's glyph inside its figure, "6+ on", the glyph,
  // "d6" (tfs-3, page M1; it sat before the odds, ch-1), and what a screen reader hears is the figure's words.
  it("a skill on a d6 shows the d6's glyph beside its odds", async () => {
    const { me } = fenWorld();
    await openSheet(me);
    const hark = within(
      screen.getByRole("region", { name: "Skills" }),
    ).getByRole("button", { name: /^Hark/ });
    const value = hark.querySelector(".list-row__value")!;
    const glyph = value.querySelector(".die-glyph");
    expect(glyph?.getAttribute("data-die")).toBe("6");
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
    expect([...value.childNodes].map((n) => (n === glyph ? "[glyph]" : n.textContent))).toEqual(["6+ on ", "[glyph]", "d6"]);
    expect(value.textContent).toBe("6+ on d6");
    expect(hark.getAttribute("aria-label")).toMatch(/^Hark.* 6\+ on d6: where it comes from$/);
  });

  // Purpose: a percentage skill shows the d100's glyph (two d10s) before its odds, read from the skill's own odds.
  it("a percentage skill shows the d100's glyph beside its odds", async () => {
    const { me } = fenWorld({
      skills: [
        { id: "hark", name: "Hark", die: "%", default: 35, fill: { best: ["base"] } },
      ],
    });
    await openSheet(me);
    const hark = within(
      screen.getByRole("region", { name: "Skills" }),
    ).getByRole("button", { name: /^Hark/ });
    const value = hark.querySelector(".list-row__value")!;
    expect(value.textContent).toBe("35%");
    expect(value.firstElementChild?.getAttribute("data-die")).toBe("100");
  });

  // Purpose: a skill on a die the app has no glyph for (a d7) shows its odds with no glyph, never a guessed one.
  it("a skill on a die the app doesn't draw shows no glyph", async () => {
    const { me } = fenWorld({
      skills: [
        { id: "hark", name: "Hark", die: "d7", default: 3, fill: { best: ["base"] } },
      ],
    });
    await openSheet(me);
    const hark = within(
      screen.getByRole("region", { name: "Skills" }),
    ).getByRole("button", { name: /^Hark/ });
    expect(hark.querySelector(".list-row__value")?.textContent).toBe("3");
    expect(hark.querySelector(".die-glyph")).toBeNull();
    expect(hark.querySelector(".list-row__chevron")).not.toBeNull();
  });

  // Purpose: a kindred trait's row opens that trait's entry with what it does.
  it("opens a trait with its words and whose it is", async () => {
    const { me } = fenWorld();
    const user = await openSheet(me);
    await user.click(
      within(screen.getByRole("region", { name: "Traits" })).getByRole(
        "button",
        { name: "Second wind" },
      ),
    );
    const entry = within(
      await screen.findByRole("dialog", { name: /Second wind/ }),
    );
    expect(entry.getByText("Breathes under water for a turn.")).toBeTruthy();
    expect(entry.getByText(/Your kindred, Bog folk/)).toBeTruthy();
  });

  // Purpose: a language box opens the pack's text for that language, and a box the pack doesn't list is plain words.
  it("opens the pack’s text from a language box", async () => {
    const { me } = fenWorld();
    const user = await openSheet(me);
    const languages = within(screen.getByRole("region", { name: "Languages" }));
    await user.click(
      languages.getByRole("button", { name: "Fen common: what it is" }),
    );
    const entry = within(
      await screen.findByRole("dialog", { name: "Fen common" }),
    );
    expect(entry.getAllByText(/\S/).length).toBeGreaterThan(1);
    await user.click(entry.getByRole("button", { name: "Got it" }));
    // Heron-tongue is not in the pack's list: still a box, with nothing to open.
    expect(
      languages.queryByRole("button", { name: /^Heron-tongue/ }),
    ).toBeNull();
    expect(languages.getByText("Heron-tongue")).toBeTruthy();
  });
});

describe("the saves rule line and the literacy line", () => {
  const rule =
    "Roll d20, equal or over the number. Add the kindred bonus first.";

  // Purpose: the line under the saves is built from the rules set's `rolls.save` (sv-1, pf-20; plan
  // dec-player-figure-sheet piece 4), with the d20 glyph; the pack's rule text no longer sits there (it is on a save's sheet).
  it("shows the Saves line built from the rules, not the pack’s rule text, under Saves", async () => {
    const { me } = fenWorld({
      saveRule: rule,
      rolls: { save: { die: "d20", pass: "atOrOver" } },
    });
    await openSheet(me);
    const saves = screen.getByRole("region", { name: "Saves" });
    expect(
      within(saves).getByText(
        "Roll d20: your save's number or higher succeeds.",
      ),
    ).toBeTruthy();
    expect(saves.querySelector('.roll-row [data-die="20"]')).not.toBeNull();
    expect(
      within(saves).queryByText("Roll d20, equal or over the number."),
    ).toBeNull();
  });

  // Purpose: a pack with no save rule text draws no line (no app wording), even when it has a save modifier (the
  // fixture has one, "Spell ward"): the line is the rule's first sentence, never a modifier's name.
  // KNOWN APP BUG: CharacterSheet.tsx takes saveRules(rulesSets)[0], which falls back to a modifier line.
  it("draws no line under Saves when the pack has no save rule", async () => {
    const { me } = fenWorld();
    await openSheet(me);
    expect(
      screen.getByRole("region", { name: "Saves" }).querySelector("p"),
    ).toBeNull();
  });

  // Purpose: the literacy line follows the pack's literacyNote for the character's literacy; another level, other words.
  it("shows the pack’s literacy note for the level the character has", async () => {
    const note = {
      Reads: "Reads the languages above. Writes only a little.",
      "Reads slowly": "Reads with a finger, one word at a time.",
    };
    const { me, wren } = fenWorld({ literacyNote: note });
    // The literacy the character has, as the sheet keeps it (the creation's derived figure).
    fieldsOf(wren).literacy = "Reads";
    await openSheet(me);
    const languages = screen.getByRole("region", { name: "Languages" });
    expect(
      within(languages).getByText(
        "Literacy: Reads, reads the languages above.",
      ),
    ).toBeTruthy();
    cleanup();
    // Another level of literacy: the other note.
    fieldsOf(wren).literacy = "Reads slowly";
    forgetCampaignSetting();
    await openSheet(me);
    expect(
      within(screen.getByRole("region", { name: "Languages" })).getByText(
        "Literacy: Reads slowly, reads with a finger, one word at a time.",
      ),
    ).toBeTruthy();
  });

  // Purpose: a pack with no literacy rule draws no literacy line; the figure stays a Details row.
  it("draws no literacy line when the pack has no literacy rule", async () => {
    const { me } = fenWorld();
    await openSheet(me);
    expect(
      within(screen.getByRole("region", { name: "Languages" })).queryByText(
        /^Literacy/,
      ),
    ).toBeNull();
    expect(
      within(
        screen.getByRole("region", { name: "Details and backstory" }),
      ).getByText("Literacy"),
    ).toBeTruthy();
  });

  // Purpose (the review of #910): only a text field holding words makes the sentence under Languages; a checkbox's
  // value or a number is never turned into "True." or "2.", and the literacy stays a Details line.
  it.each([
    ["checkbox", true],
    ["number", 2],
  ])(
    "keeps a %s literacy in Details, with no line under Languages",
    async (type, value) => {
      const { me, wren } = fenWorld();
      world.tables.field_definitions.find((f) => f.key === "literacy")!.type =
        type;
      fieldsOf(wren).literacy = value;
      await openSheet(me);
      const languages = screen.getByRole("region", { name: "Languages" });
      expect(within(languages).queryByText(/^(True|2)\.$/)).toBeNull();
      expect(languages.querySelector("p.auth__meta")).toBeNull();
      expect(
        within(
          screen.getByRole("region", { name: "Details and backstory" }),
        ).getByText("Literacy"),
      ).toBeTruthy();
    },
  );

  // Purpose (the review of #910): a pack with a literacy rule whose level isn't matched draws no line (never the raw
  // word as a sentence), and the literacy stays a Details line.
  it("keeps an unmatched literacy in Details when the pack has a literacy rule", async () => {
    const { me, wren } = fenWorld({
      literacyNote: { Reads: "Reads the languages above." },
    });
    fieldsOf(wren).literacy = "Cannot read";
    await openSheet(me);
    const languages = screen.getByRole("region", { name: "Languages" });
    expect(within(languages).queryByText(/Cannot read/)).toBeNull();
    expect(within(languages).queryByText(/^Literacy/)).toBeNull();
    const details = screen.getByRole("region", {
      name: "Details and backstory",
    });
    expect(within(details).getByText("Literacy")).toBeTruthy();
    expect(within(details).getByText("Cannot read")).toBeTruthy();
  });

  // Purpose (the second review of the Player stack): the literacy sentence is drawn only inside Languages, so a layout
  // with no Languages field, or a hidden one, keeps the literacy as a Details line rather than showing it nowhere.
  it.each([["no", "remove"], ["a hidden", "hide"]])(
    "keeps the literacy in Details when the layout has %s Languages field",
    async (_label, how) => {
      const { me, wren } = fenWorld();
      const defs = world.tables.field_definitions;
      const at = defs.findIndex((f) => f.key === "languages");
      if (how === "remove") defs.splice(at, 1);
      else defs[at]!.hidden = true;
      fieldsOf(wren).literacy = "Reads and writes";
      await openSheet(me);
      expect(screen.queryByRole("region", { name: "Languages" })).toBeNull();
      const details = screen.getByRole("region", {
        name: "Details and backstory",
      });
      expect(within(details).getByText("Literacy")).toBeTruthy();
      expect(within(details).getByText("Reads and writes")).toBeTruthy();
    },
  );
});

describe("Edit", () => {
  // Purpose: a details edit saves at once and says so with Undo, and Undo puts the old words back.
  it("saves a backstory at once, and Undo puts the old words back", async () => {
    const { me, wren } = fenWorld();
    const user = await openSheet(me);
    await user.click(within(footOf()).getByRole("button", { name: "Edit" }));
    const form = within(await screen.findByRole("form", { name: "Edit Wren" }));
    await user.click(form.getByRole("button", { name: /^Backstory:/ }));
    const sheet = within(
      await screen.findByRole("dialog", { name: "Backstory" }),
    );
    await user.clear(sheet.getByLabelText("Backstory"));
    await user.type(
      sheet.getByLabelText("Backstory"),
      "Raised on the ferries.",
    );
    await user.click(sheet.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Backstory saved")).toBeTruthy();
    await waitFor(() =>
      expect(actorOf(wren).backstory).toBe("Raised on the ferries."),
    );
    // Saved at once: no request, no waiting line.
    expect(world.tables.sheet_changes).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(actorOf(wren).backstory).toBe("Raised on the barges."),
    );
  });

  // Purpose: a player's Edit says the level is the GM's, in words, and offers no way to change it.
  it("shows a player the level as a line, not a choice", async () => {
    const { me } = fenWorld();
    const user = await openSheet(me);
    await user.click(within(footOf()).getByRole("button", { name: "Edit" }));
    const form = within(await screen.findByRole("form", { name: "Edit Wren" }));
    expect(form.getByText("Level 1, your GM changes it")).toBeTruthy();
    expect(form.queryByRole("combobox", { name: "Level" })).toBeNull();
  });
});

describe("a player's score change is a request", () => {
  // Purpose: Send to the GM creates the request; the sheet keeps the old figure and its modifier, the tile says
  // nothing of the change (as the Player tab's tile; of-3) and the line at the top says what waits; the foot counted
  // the change and said it needs approval.
  it("sends a score to the GM and shows it waiting on the sheet", async () => {
    const { me, wren } = fenWorld();
    const user = await openSheet(me);
    const before = within(screen.getByRole("region", { name: "Scores" })).getByRole("button", { name: /^Muscle 13/ });
    const tileName = before.getAttribute("aria-label") ?? before.textContent;
    const tileText = before.textContent;
    await stepScore(user, /^Muscle 13/, "Muscle");
    const edit = within(footOf());
    expect(edit.getByRole("status", { name: "Edit status" }).textContent).toBe(
      "1 change, 1 needs approval",
    );
    // The one accent in the foot is Send to the GM.
    expect(footOf().querySelectorAll(".button-primary")).toHaveLength(1);
    await user.click(edit.getByRole("button", { name: "Send to the GM" }));
    expect(
      await screen.findByText("Sent to your GM.", {
        selector: ".toast *, .toast",
      }),
    ).toBeTruthy();
    await waitFor(() => expect(world.tables.sheet_changes).toHaveLength(1));
    expect(world.tables.sheet_changes[0]).toMatchObject({
      actor_id: wren,
      field: "MUS",
      label: "Muscle",
      from_value: 13,
      to_value: 14,
      status: "waiting",
    });
    // The score itself is not changed.
    expect(fieldsOf(wren).MUS).toBe(13);
    const line = await screen.findByText(/Waiting for your GM:/);
    expect(line.closest(".sheet__change")?.textContent).toContain(
      "Muscle 13 → 14",
    );
    const scores = within(screen.getByRole("region", { name: "Scores" }));
    const tile = scores.getByRole("button", { name: /^Muscle 13/ });
    expect(tile.getAttribute("aria-label") ?? tile.textContent).toBe(tileName);
    expect(tile.textContent).toBe(tileText);
    expect(tile.textContent).not.toContain("waiting");
    expect(scores.queryByText(/14 waiting/)).toBeNull();
  });

  // Purpose: Max HP is asked the same way; the HP box keeps the old maximum.
  it("asks for a Max HP change the same way", async () => {
    const { me, wren } = fenWorld();
    const user = await openSheet(me);
    await user.click(within(footOf()).getByRole("button", { name: "Edit" }));
    const form = within(await screen.findByRole("form", { name: "Edit Wren" }));
    await user.click(form.getByRole("button", { name: "More Max HP" }));
    await user.click(
      within(footOf()).getByRole("button", { name: "Send to the GM" }),
    );
    await waitFor(() => expect(world.tables.sheet_changes).toHaveLength(1));
    expect(world.tables.sheet_changes[0]).toMatchObject({
      field: "hpMax",
      label: "Max HP",
      from_value: 9,
      to_value: 10,
      status: "waiting",
    });
    expect(actorOf(wren).hp_max).toBe(9);
    expect(await screen.findByText(/Waiting for your GM:/)).toBeTruthy();
  });

  // Purpose: Take back withdraws the request, logged; the waiting line goes.
  it("Take back withdraws the request and the line goes", async () => {
    const { me } = fenWorld();
    const user = await openSheet(me);
    await stepScore(user, /^Muscle 13/, "Muscle");
    await user.click(
      within(footOf()).getByRole("button", { name: "Send to the GM" }),
    );
    await screen.findByText(/Waiting for your GM:/);
    await user.click(
      screen.getByRole("button", { name: "Take back Muscle 13 → 14" }),
    );
    await waitFor(() =>
      expect(screen.queryByText(/Waiting for your GM:/)).toBeNull(),
    );
    expect(world.tables.sheet_changes[0]!.status).toBe("withdrawn");
    expect(screen.queryByText(/14 waiting/)).toBeNull();
    expect(
      world.tables.events.some((e) => e.type === "sheet.takeBackChange"),
    ).toBe(true);
  });

  // Purpose: asking again for the same figure takes the earlier ask back, so one waits per figure.
  it("keeps one request waiting per figure", async () => {
    const { me } = fenWorld();
    const user = await openSheet(me);
    await stepScore(user, /^Muscle 13/, "Muscle");
    await user.click(
      within(footOf()).getByRole("button", { name: "Send to the GM" }),
    );
    await screen.findByText(/Waiting for your GM:/);
    await stepScore(user, /^Muscle 13/, "Muscle", 2);
    await user.click(
      within(footOf()).getByRole("button", { name: "Send to the GM" }),
    );
    await waitFor(() =>
      expect(
        world.tables.sheet_changes.filter((c) => c.status === "waiting"),
      ).toHaveLength(1),
    );
    expect(world.tables.sheet_changes.map((c) => c.status)).toEqual([
      "withdrawn",
      "waiting",
    ]);
    expect(await screen.findByText(/Muscle 13 → 15/)).toBeTruthy();
  });
});

describe("the GM answers a sheet change", () => {
  /** Sam asks for Muscle 14 (and, with `second`, Nimble 15) the way his Send to the GM does. */
  async function asked(ids: Ids, second = false) {
    world.signInAs(ids.me);
    const send = async (field: string, label: string, to: number) => {
      const { error } = await world.db.rpc("request_sheet_change", {
        actor: ids.wren,
        field,
        label,
        to_value: to,
      });
      expect(error).toBeNull();
    };
    await send("MUS", "Muscle", 14);
    if (second) await send("NIM", "Nimble", 15);
  }

  // Purpose: the GM's Players tab lists a waiting change under Waiting for approval; Approve writes the figure.
  it("lists it under Waiting for approval, and Approve writes the figure", async () => {
    const ids = fenWorld();
    await asked(ids);
    const user = await openCampaign(ids.gm);
    const players = within(
      await screen.findByRole("navigation", { name: "Campaign sections" }),
    ).getByRole("button", { name: /^Players/ });
    expect(players.textContent).toMatch(/1/);
    await user.click(players);
    const waiting = (
      await screen.findByRole("heading", { name: "Waiting for approval" })
    ).parentElement as HTMLElement;
    const card = within(
      await within(waiting).findByRole("group", {
        name: /^Sheet change waiting: Wren, Muscle 13 → 14/,
      }),
    );
    expect(card.getByText("Wren asks: Muscle 13 → 14")).toBeTruthy();
    await user.click(card.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(fieldsOf(ids.wren).MUS).toBe(14));
    expect(
      await screen.findByText("Approved: Wren’s Muscle is 14."),
    ).toBeTruthy();
    expect(world.tables.sheet_changes[0]!.status).toBe("approved");
    expect(
      world.tables.events.some((e) => e.type === "sheet.approveChange"),
    ).toBe(true);
    // The player's sheet then shows 17-style figure: 14, with no waiting line.
    cleanup();
    await openSheet(ids.me);
    expect(
      within(screen.getByRole("region", { name: "Scores" })).getByRole(
        "button",
        { name: /^Muscle 14/ },
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Waiting for your GM:/)).toBeNull();
  });

  // Purpose (plan m5b-sheet-revised PR 2, steps 9–11): a waiting sheet change lights the GM's Players tab, named
  // "Players, 1 waiting: 1 to approve"; opening Players doesn't put it out (the selected tab keeps it); answering the last one
  // does; Scene and Rules stay unlit throughout.
  it("lights Players while a change waits, keeps it lit when opened, and puts it out once answered", async () => {
    const ids = fenWorld();
    await asked(ids);
    const user = await openCampaign(ids.gm);
    const nav = within(
      await screen.findByRole("navigation", { name: "Campaign sections" }),
    );
    const players = await nav.findByRole("button", {
      name: "Players, 1 waiting: 1 to approve",
    });
    expect(players.classList.contains("section-nav__tab--lit")).toBe(true);
    for (const name of ["Scene", "Rules"])
      expect(
        nav
          .getByRole("button", { name })
          .classList.contains("section-nav__tab--lit"),
      ).toBe(false);
    await user.click(players);
    await screen.findByRole("group", {
      name: /^Sheet change waiting: Wren, Muscle 13 → 14/,
    });
    const open = nav.getByRole("button", {
      name: "Players, 1 waiting: 1 to approve",
    });
    expect(open.getAttribute("aria-current")).toBe("page");
    expect(open.classList.contains("section-nav__tab--lit")).toBe(true);
    await user.click(
      within(
        screen.getByRole("group", { name: /^Sheet change waiting: Wren/ }),
      ).getByRole("button", { name: "Approve" }),
    );
    const unlit = await nav.findByRole("button", { name: "Players" });
    expect(unlit.classList.contains("section-nav__tab--lit")).toBe(false);
  });

  // Purpose: Refuse asks for a reason and records it; the figure stays; the player's sheet says why until put away.
  it("Refuse keeps the reason, leaves the figure, and shows the player why", async () => {
    const ids = fenWorld();
    await asked(ids);
    const user = await openCampaign(ids.gm);
    await user.click(
      within(
        await screen.findByRole("navigation", { name: "Campaign sections" }),
      ).getByRole("button", { name: /^Players/ }),
    );
    const card = within(
      await screen.findByRole("group", {
        name: /^Sheet change waiting: Wren, Muscle 13 → 14/,
      }),
    );
    await user.click(card.getByRole("button", { name: "Refuse" }));
    await user.type(
      card.getByLabelText(/^Why \(optional/),
      "Not before the next level",
    );
    await user.click(card.getByRole("button", { name: "Refuse" }));
    await waitFor(() =>
      expect(world.tables.sheet_changes[0]!.status).toBe("refused"),
    );
    expect(world.tables.sheet_changes[0]!.reason).toBe(
      "Not before the next level",
    );
    expect(fieldsOf(ids.wren).MUS).toBe(13);
    expect(
      world.tables.events.some((e) => e.type === "sheet.refuseChange"),
    ).toBe(true);
    cleanup();
    const player = await openSheet(ids.me);
    const line = (await screen.findByText(/Your GM refused/)).closest(
      ".sheet__change",
    ) as HTMLElement;
    expect(line.textContent).toContain(
      "Muscle 13 → 14: Not before the next level",
    );
    // OK puts the refusal away.
    await player.click(
      within(line).getByRole("button", { name: /^Put away the refusal/ }),
    );
    expect(screen.queryByText(/Your GM refused/)).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Scores" })).getByRole(
        "button",
        { name: /^Muscle 13/ },
      ),
    ).toBeTruthy();
  });

  // Purpose: a player with the sheet open is told when the GM answers, approved or refused.
  it("tells the player with a toast when the GM approves or refuses", async () => {
    const ids = fenWorld();
    await asked(ids, true);
    await openSheet(ids.me);
    expect(await screen.findAllByText(/Waiting for your GM:/)).toHaveLength(2);
    // The GM answers from another device: switch the pretend sign-in for the calls only.
    const changes = world.tables.sheet_changes;
    world.signInAs(ids.gm);
    const approve = await world.db.rpc("answer_sheet_change", {
      change: String(changes[0]!.id),
      approve: true,
      reason: "",
      seen_version: 1,
    });
    expect(approve.error).toBeNull();
    expect(await screen.findByText("Your GM approved Muscle 14.")).toBeTruthy();
    const refuse = await world.db.rpc("answer_sheet_change", {
      change: String(changes[1]!.id),
      approve: false,
      reason: "Not yet",
      seen_version: 1,
    });
    expect(refuse.error).toBeNull();
    expect(
      await screen.findByText("Your GM refused Nimble 15: Not yet"),
    ).toBeTruthy();
  });

  // Purpose: the GM approves a score while the player's Edit is open; the player then saves a detail, and the approved
  // figure stays (a detail save sends only that field, never the whole set as the screen loaded it).
  it("keeps an approved score when the player saves a detail from an Edit screen opened before", async () => {
    const ids = fenWorld();
    await asked(ids);
    const user = await openSheet(ids.me);
    await user.click(within(footOf()).getByRole("button", { name: "Edit" }));
    const form = within(await screen.findByRole("form", { name: "Edit Wren" }));
    // The GM approves from another device while Edit is open.
    const waiting = world.tables.sheet_changes[0]!;
    world.signInAs(ids.gm);
    const approved = await world.db.rpc("answer_sheet_change", {
      change: String(waiting.id),
      approve: true,
      reason: "",
      seen_version: 1,
    });
    expect(approved.error).toBeNull();
    world.signInAs(ids.me);
    expect(fieldsOf(ids.wren).MUS).toBe(14);
    await user.click(form.getByRole("button", { name: /^Motto:/ }));
    const sheet = within(await screen.findByRole("dialog", { name: "Motto" }));
    await user.type(sheet.getByLabelText("Motto"), "Lights first");
    await user.click(sheet.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fieldsOf(ids.wren).motto).toBe("Lights first"));
    expect(fieldsOf(ids.wren).MUS).toBe(14);
  });

  // Purpose: Approve on a change whose figure moved since it was asked is refused with "That's changed since", and the
  // score is left as it is.
  it("refuses Approve when the figure changed since the ask", async () => {
    const ids = fenWorld();
    await asked(ids);
    fieldsOf(ids.wren).MUS = 15;
    const user = await openCampaign(ids.gm);
    await user.click(
      within(
        await screen.findByRole("navigation", { name: "Campaign sections" }),
      ).getByRole("button", { name: /^Players/ }),
    );
    const card = within(
      await screen.findByRole("group", {
        name: /^Sheet change waiting: Wren, Muscle 13 → 14/,
      }),
    );
    await user.click(card.getByRole("button", { name: "Approve" }));
    expect((await card.findByRole("alert")).textContent).toMatch(
      /That's changed since/,
    );
    expect(fieldsOf(ids.wren).MUS).toBe(15);
    expect(world.tables.sheet_changes[0]!.status).toBe("waiting");
  });

  // Purpose: a worked-out figure the pack fills that no section shows appears as an Abilities row and opens its breakdown.
  it("shows a pack-filled figure no section shows as an Abilities row that opens its breakdown", async () => {
    const { me } = fenWorld();
    // An invented figure, "lamps", filled by a pack hook like the movement is (a value), with no field and no section.
    const hook = {
      id: "fen-fill-lamps",
      kind: "fill",
      when: "levelUp",
      value: 3,
      target: "lamps",
    };
    world.tables.library_entries.push({
      id: "entry-hook-lamps",
      pack_id: "pack-fen",
      kind: "hook",
      pack_entry_id: "fen-fill-lamps",
      name: "fen-fill-lamps",
      data: hook,
    });
    const user = await openSheet(me);
    const row = within(
      screen.getByRole("region", { name: "Abilities" }),
    ).getByRole("button", { name: /^Lamps/i });
    expect(row.textContent).toContain("3");
    await user.click(row);
    expect(await screen.findByRole("dialog", { name: /Lamps/i })).toBeTruthy();
  });

  // Purpose: the GM's own score edit applies at once: no request, no waiting line, the figure changes.
  it("applies the GM’s own score edit at once", async () => {
    const ids = fenWorld();
    const user = await openSheetAsGm(ids.gm);
    await stepScore(user, /^Muscle 13/, "Muscle");
    // No approval for the GM: the accent is Save.
    expect(
      within(footOf()).getByRole("status", { name: "Edit status" }).textContent,
    ).toBe("1 change");
    expect(
      within(footOf()).queryByRole("button", { name: "Send to the GM" }),
    ).toBeNull();
    await user.click(within(footOf()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fieldsOf(ids.wren).MUS).toBe(14));
    expect(world.tables.sheet_changes).toHaveLength(0);
    expect(screen.queryByText(/Waiting for your GM:/)).toBeNull();
    // Saved, back on Players (as the player's Edit comes back to Your characters); Wren's sheet shows the new score.
    await user.click(
      await screen.findByRole("button", { name: "View Wren’s sheet" }),
    );
    expect(
      await screen.findByRole("button", { name: /^Muscle 14/ }),
    ).toBeTruthy();
  });
});

describe("the Notes sheet", () => {
  /** Notes about Wren: the GM's, yesterday; Sam's, this morning; one about someone else, which must not show. */
  function seedNotes(ids: Ids) {
    const now = new Date();
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      12,
      0,
      0,
    ).toISOString();
    const earlier = new Date(now.getTime() - 60_000).toISOString();
    const note = (
      id: string,
      by: string,
      text: string,
      about: string,
      at: string,
      audience = "all",
    ) =>
      world.tables.notes.push({
        id,
        campaign_id: ids.campaign,
        created_by: by,
        text,
        about_actor_id: about,
        annotates_event_id: null,
        audience,
        reveal_at: "now",
        owner_user_id: null,
        created_at: at,
        updated_at: at,
      });
    note(
      "note-gm",
      ids.gm,
      "The ferryman owes you a favour.",
      ids.wren,
      yesterday,
    );
    note(
      "note-me",
      ids.me,
      "Ask the ferryman about the lamp.",
      ids.wren,
      earlier,
    );
    note(
      "note-other",
      ids.me,
      "Nothing to do with Wren.",
      "actor-someone-else",
      earlier,
    );
    // A note for the GM's eyes only about Wren (audience gm): never on a player's device.
    note("note-secret", ids.gm, "Wren is the thief.", ids.wren, earlier, "gm");
  }

  // Purpose: the button's line counts the character's notes and says when the last was; the sheet lists them newest
  // first with when and who (a GM note reads "from your GM"), and leaves other characters' notes out.
  it("lists the character’s notes newest first with when and who", async () => {
    const ids = fenWorld();
    seedNotes(ids);
    const user = await openSheet(ids.me);
    const notes = within(screen.getByRole("region", { name: "Notes" }));
    expect(await notes.findByText("2 notes, last one today")).toBeTruthy();
    await user.click(notes.getByRole("button", { name: "Notes" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Notes" }));
    const items = sheet.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "Today, by youAsk the ferryman about the lamp.",
      "Yesterday, from your GMThe ferryman owes you a favour.",
    ]);
    expect(sheet.queryByText("Nothing to do with Wren.")).toBeNull();
    // Hidden means hidden: a GM-audience note about Wren is not on the player's sheet, nor in the count (2 above).
    expect(sheet.queryByText("Wren is the thief.")).toBeNull();
  });

  // Purpose: Add writes a note about this character (logged), the list and the button's count follow.
  it("adds a note about the character with Add", async () => {
    const ids = fenWorld();
    seedNotes(ids);
    const user = await openSheet(ids.me);
    const notes = within(screen.getByRole("region", { name: "Notes" }));
    await notes.findByText("2 notes, last one today");
    await user.click(notes.getByRole("button", { name: "Notes" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Notes" }));
    await user.type(
      sheet.getByLabelText("A new note"),
      "Light the lamp at dusk.",
    );
    await user.click(sheet.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(
        world.tables.notes.some(
          (n) =>
            n.text === "Light the lamp at dusk." &&
            n.about_actor_id === ids.wren,
        ),
      ).toBe(true),
    );
    expect((await sheet.findAllByRole("listitem"))[0]!.textContent).toBe(
      "Today, by youLight the lamp at dusk.",
    );
    expect(world.tables.events.some((e) => e.type === "note.add")).toBe(true);
    await user.click(sheet.getAllByRole("button", { name: "Close" })[0]!);
    expect(await notes.findByText("3 notes, last one today")).toBeTruthy();
  });

  // Purpose: with no notes the button says so and the sheet invites the first one.
  it("says there are no notes yet", async () => {
    const ids = fenWorld();
    const user = await openSheet(ids.me);
    const notes = within(screen.getByRole("region", { name: "Notes" }));
    expect(await notes.findByText("No notes yet")).toBeTruthy();
    await user.click(notes.getByRole("button", { name: "Notes" }));
    expect(
      within(await screen.findByRole("dialog", { name: "Notes" })).getByText(
        /No notes yet\./,
      ),
    ).toBeTruthy();
  });
});
