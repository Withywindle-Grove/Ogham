// @vitest-environment jsdom
// The players' screens on creation's standard, slices A and B (plan m5b-players-screens-standard), on the invented
// fixture pack scripts/fixtures/m5b-creation.fixture.json. Purposes:
//   The Player screen draws no " · ", "›" or "▲": its header, vitals, Traits, Skills, Saves, every sheet they open and
//   every toast (the At hand rows are the Pack's, slice C, and its own scan covers them). The watcher
//   (src/testing/markScan.ts) is shared, so C and D add their screens to the same check.
//   The top bar: the character's name centred, ⋯ a Sheet ("More") with the screen's options, then the app's menu
//   where there's no drawer; the full sheet's bar reads "Full sheet" with ← named for where it goes back to.
//   Every tappable figure (AC, attack, a save, a skill) opens the breakdown sheet: the figure, its parts, the source.
//   A trait's Use marks one at once with Undo in the toast; with none left it stays tappable and says why; the trait's
//   sheet keeps the dots that give a use back.
//   The Statuses row (plan m5b-creation-retest-3 F): each status a ring in its tone with its arc and words, no end
//   dashed, none no row; the ring's sheet gives the count, what it does, source, who set it and the log line.
//   Pins reach traits (dec-13 C8, pin-2; since row P3, euf-3 and page 28): a trait's sheet has the pin star in its head;
//   pinned, the trait is a block first in "Abilities and traits" with the small filled star, never At hand (each thing
//   once), its Use still works, and the toast's Undo puts it back as a row; a stored pin whose trait is gone shows nothing.
//   The drawer's nit (Design on #549): a player with no character yet is offered no Full character sheet or Company.
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
import type { CurrentUser } from "../core/commands.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { PlayerDetails } from "./player/PlayerDetails.tsx";
import { createFakeDb, type FakeWorld } from "../testing/fakeDb.ts";
import { Root } from "./App.tsx";
import { forgetCampaignSetting } from "./campaignSetting.ts";
import { watchMarks } from "../testing/markScan.ts";
import { openFullSheetFromMenu } from "../testing/openFullSheet.ts";

vi.mock("./services.ts", async () => {
  const { createAppRegistry } = await import("./commandRegistry.ts");
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

let watching: ReturnType<typeof watchMarks> | null = null;

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
  windowOf(375);
});

afterEach(() => {
  watching?.stop();
  watching = null;
  cleanup();
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

/** The fixture on a campaign, and Wren (a Lantern Warden, level 1, 6 of 9 hit points) approved and active for Sam. */
function fenWorld({ withCharacter = true } = {}) {
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
  for (const r of pack.rulesSets!) entry("rulesSet", r);
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
  let wren: string | null = null;
  if (withCharacter) {
    wren = world.addCharacter(campaign, "Wren", {
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
        fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10 },
        classes: [{ classRef: "lantern-warden", level: 1, xp: 0 }],
      },
    );
    world.addMember(campaign, me, "player", wren);
  } else world.addMember(campaign, me, "player");
  world.signInAs(me);
  return { gm, me, campaign, wren };
}

async function openPlayer(user: User) {
  await user.click(
    await screen.findByRole("button", { name: /The Ash Barrows/ }),
  );
  await screen.findByRole("region", { name: "Vitals" });
}

/** Opens a tile or row, checks a Sheet opened, and closes it with its ✕. */
async function opensSheet(
  user: User,
  button: HTMLElement,
  name: string | RegExp,
) {
  await user.click(button);
  const sheet = await screen.findByRole("dialog", { name });
  expect(sheet.classList.contains("dialog--sheet")).toBe(true);
  return sheet;
}

const closeTop = async (user: User) => {
  const dialogs = screen.getAllByRole("dialog");
  await user.click(
    within(dialogs.at(-1)!).getAllByRole("button", { name: "Close" })[0]!,
  );
};

describe("the Player screen on the standard (A, B)", () => {
  it("draws no middle dot, › or ▲ in the bar, the header, the vitals, Traits, Skills, Saves, their sheets and toasts", async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    // The At hand rows (.pack) are the Pack's, slice C's to change.
    watching = watchMarks(
      '.top-row, .player__pane--play, [role="dialog"], .toast',
      ".pack",
    );
    await openPlayer(user);
    const vitals = within(screen.getByRole("region", { name: "Vitals" }));
    for (const tile of vitals
      .getAllByRole("button")
      .filter((b) =>
        /where it comes from|how it's worked out/.test(
          b.getAttribute("aria-label") ?? "",
        ),
      )) {
      await user.click(tile);
      await closeTop(user);
    }
    const skills = screen.queryByRole("region", { name: "Skills" });
    if (skills) {
      await user.click(within(skills).getAllByRole("button")[0]!);
      await closeTop(user);
    }
    const saves = within(screen.getByRole("region", { name: "Saves" }));
    await user.click(saves.getAllByRole("button")[0]!);
    await closeTop(user);
    const traits = within(screen.getAllByRole("region", { name: "Abilities and traits" })[0]!);
    await user.click(traits.getByRole("button", { name: "Use Steady flame" }));
    await screen.findByText(/^Used Steady flame/);
    await user.click(traits.getByRole("button", { name: /^Steady flame/ }));
    await closeTop(user);
    // Hit points in place: the burst's toast, and the typing Sheet.
    await user.click(screen.getByRole("button", { name: "Take 1 damage" }));
    await screen.findByText("Took 1 damage, 5 of 9");
    // The toast can land before the screen re-renders the tile (a loaded CI runner): wait for it.
    await user.click(
      await screen.findByRole(
        "button",
        { name: /^Hit points 5 of 9/ },
        { timeout: 5000 },
      ),
    );
    await screen.findByRole("dialog", { name: "Hit points" });
    await closeTop(user);
    expect([...watching!.found]).toEqual([]);
  });

  it("the bar: the name centred, ⋯ absent on a phone (the drawer holds the menu), the full sheet from the drawer", async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const bar = document.querySelector(".top-row") as HTMLElement;
    expect(bar.classList.contains("top-row--standard")).toBe(true);
    expect(bar.querySelector(".top-row__title--centred")?.textContent).toBe(
      "Wren",
    );
    expect(
      within(bar).queryByRole("button", { name: "Character options" }),
    ).toBeNull();
    // The name is the bar's; the page keeps it for screen readers only.
    expect(
      screen
        .getByRole("heading", { level: 1, name: "Wren" })
        .classList.contains("visually-hidden"),
    ).toBe(true);
    // No row "Full character sheet" on the tab (tfr-4, tfr-5): the drawer's item opens the page.
    expect(screen.queryByRole("button", { name: "Full character sheet" })).toBeNull();
    await openFullSheetFromMenu(user);
    // The full sheet: ← named for the Player screen, "Full sheet" centred, ⋯ a Sheet with the app's menu.
    const back = await screen.findByRole("button", { name: "Back to Wren" });
    const sheetBar = back.closest(".top-row") as HTMLElement;
    expect(
      sheetBar.querySelector(".top-row__title--centred")?.textContent,
    ).toBe("Full sheet");
    const more = await opensSheet(
      user,
      within(sheetBar).getByRole("button", {
        name: "Account and device options",
      }),
      "More",
    );
    expect(
      within(more).getByRole("button", { name: "Setting rules" }),
    ).toBeTruthy();
    expect(within(more).getByText("This device")).toBeTruthy();
    await user.click(within(more).getByRole("button", { name: "Close" }));
    await user.click(back);
    expect(await screen.findByRole("region", { name: "Vitals" })).toBeTruthy();
  });

  it("on a tablet, ⋯ is a Sheet with the app’s menu, and the title is centred too", async () => {
    windowOf(1024);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const bar = document.querySelector(".top-row") as HTMLElement;
    // In two columns the bar reads the name, "the" kindred and the title (dec-13 C2, frame P1).
    expect(bar.querySelector(".top-row__title--centred")?.textContent).toBe(
      "Wren the Bog folk, Lamplighter",
    );
    const more = await opensSheet(
      user,
      within(bar).getByRole("button", { name: "Character options" }),
      "More",
    );
    expect(
      within(more).getByRole("button", { name: "Setting rules" }),
    ).toBeTruthy();
    // Choosing an item closes it.
    await user.click(
      within(more).getByRole("button", { name: "Setting rules" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "More" })).toBeNull(),
    );
  });

  it("every tappable figure opens the breakdown sheet: the figure, its parts, where it comes from", async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const attack = screen
      .getAllByRole("button")
      .find(
        (b) =>
          /^Attack|^THAC0|^To hit/i.test(b.getAttribute("aria-label") ?? "") &&
          /how it's worked out/.test(b.getAttribute("aria-label") ?? ""),
      );
    if (attack) {
      const sheet = await opensSheet(user, attack, /.+/);
      expect(sheet.querySelector(".dialog__figure")).not.toBeNull();
      await closeTop(user);
    }
    const save = within(
      screen.getByRole("region", { name: "Saves" }),
    ).getAllByRole("button")[0]!;
    const name = (save.getAttribute("aria-label") ?? "").replace(
      / \d+: where it comes from$/,
      "",
    );
    const sheet = within(await opensSheet(user, save, name));
    // One sheet with the save's number and the source; no class-and-level line and no "The rule" row (sv-2, sv-2a).
    expect(sheet.queryByText(/for a Lantern Warden at level 1/)).toBeNull();
    expect(sheet.queryByRole("button", { name: /The rule/ })).toBeNull();
    expect(sheet.getByText(/^From your setting: Fen sample/)).toBeTruthy();
  });

  it("a skill opens its breakdown with the odds in words, commas and no dot", async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const skills = within(
      await screen.findByRole("region", { name: "Skills" }),
    );
    // The full sheet's Skills, hosted (dec-13 C1): the kindred's change is in the row's name.
    const hark = skills.getByRole("button", {
      name: /^Hark, 4 when wading 6\+ on d6: where it comes from$/,
    });
    const sheet = within(await opensSheet(user, hark, "Hark"));
    expect(sheet.getByText("Succeeds on a 6+,")).toBeTruthy();
  });

  // Purpose: on the Player screen each skill is a row with a chevron and its die's glyph just before its odds, as
  // frame P1 draws (dec-13 C13, ch-1).
  it("each skill is a row with a chevron and the die's glyph beside its odds", async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const rows = within(
      await screen.findByRole("region", { name: "Skills" }),
    ).getAllByRole("button");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector(".list-row__chevron")).not.toBeNull();
      const value = row.querySelector(".list-row__value")!;
      expect(value.firstElementChild?.getAttribute("data-die")).toBe("6");
    }
  });

  it("Use marks a use at once with Undo; with none left it says why; the sheet’s dots give one back", async () => {
    const { wren } = fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const traits = within(screen.getAllByRole("region", { name: "Abilities and traits" })[0]!);
    expect(traits.getByText("1 of 1 left, back each day")).toBeTruthy();
    await user.click(traits.getByRole("button", { name: "Use Steady flame" }));
    expect(
      await screen.findByText("Used Steady flame, 0 of 1 left"),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        world.tables.character_play.find((p) => p.actor_id === wren)
          ?.uses_spent,
      ).toMatchObject({ "Steady flame": 1 }),
    );
    expect(
      await traits.findByText("None of 1 left, back each day"),
    ).toBeTruthy();
    // None left: still tappable, and it says why (never a disabled button).
    const use = traits.getByRole("button", { name: "Use Steady flame" });
    expect(use.hasAttribute("disabled")).toBe(false);
    await user.click(use);
    expect(
      await screen.findByText(
        "No uses of Steady flame left. They come back each day.",
      ),
    ).toBeTruthy();
    // The sheet keeps the dots: a spent one gives the use back.
    await user.click(traits.getByRole("button", { name: /^Steady flame/ }));
    const sheet = within(
      await screen.findByRole("dialog", { name: "Steady flame" }),
    );
    await user.click(
      sheet.getByRole("button", { name: "Give back a use of Steady flame" }),
    );
    await waitFor(() =>
      expect(
        (
          world.tables.character_play.find((p) => p.actor_id === wren)
            ?.uses_spent as Record<string, number>
        )["Steady flame"] ?? 0,
      ).toBe(0),
    );
  });
});

describe("the skill sheet shows the pack's words on the skill (R3-13, G-210)", () => {
  const fallback =
    "Your setting doesn't describe what this skill does. Ask your GM how it works at your table.";

  /** Wren as a Mire Stalker, the class's skills given these `notes` (a copy: the shared fixture stays as it is). */
  function stalkerWorld(notes: unknown, extra: Record<string, unknown> = {}) {
    const { wren } = fenWorld();
    Object.assign(
      world.tables.actors.find((a) => a.id === wren)!,
      { classes: [{ classRef: "mire-stalker", level: 1, xp: 0 }] },
    );
    const row = world.tables.library_entries.find(
      (e) => e.kind === "class" && e.pack_entry_id === "mire-stalker",
    )!;
    const data = structuredClone(row.data) as {
      skills: Record<string, unknown>;
    };
    data.skills.notes = notes;
    Object.assign(data.skills, extra);
    row.data = data;
  }

  async function openSkill(user: User, name: RegExp, title: string) {
    await openPlayer(user);
    const skills = within(
      await screen.findByRole("region", { name: "Skills" }),
    );
    return within(
      await opensSheet(user, skills.getByRole("button", { name }), title),
    );
  }

  it("a rules set skill's notes are the sheet's paragraph, and the fallback is gone", async () => {
    // Purpose: tapping Hark shows what the setting says Hark does (the bug: the fallback always showed instead).
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const sheet = await openSkill(
      user,
      /^Hark, 4 when wading 6\+ on d6: where it comes from$/,
      "Hark",
    );
    expect(
      sheet.getByText("Hearing what waits behind a door.", {
        selector: "p.reading",
      }),
    ).toBeTruthy();
    expect(sheet.queryByText(fallback)).toBeNull();
  });

  it("a class skill shows its entry from the class's skills.notes map", async () => {
    // Purpose: a class-defined skill (Keen ear) reads its words from the class's map, keyed like its names.
    stalkerWorld({ EAR: "Catching the faint splash of something wading." });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const sheet = await openSkill(
      user,
      /^Keen ear 1-2: where it comes from$/,
      "Keen ear",
    );
    expect(
      sheet.getByText("Catching the faint splash of something wading."),
    ).toBeTruthy();
    expect(sheet.queryByText(fallback)).toBeNull();
  });

  it("a class whose skills.notes is one string doesn't show it as the skill's text; the fallback shows", async () => {
    // Purpose: a pack not yet rebuilt writes the class-wide line in `notes`; it must not pass for Keen ear's description.
    stalkerWorld("Mire stalkers learn these as children.");
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const sheet = await openSkill(
      user,
      /^Keen ear 1-2: where it comes from$/,
      "Keen ear",
    );
    expect(
      sheet.queryByText("Mire stalkers learn these as children."),
    ).toBeNull();
    expect(sheet.getByText(fallback)).toBeTruthy();
  });

  /** The full sheet's own page, from the drawer's item (the Player tab's row is gone, tfr-5). */
  async function openFullSheet(user: User) {
    await openFullSheetFromMenu(user);
    await screen.findByRole("button", { name: "Back to Wren" });
  }

  it("the class's skills.note is one muted line under the Skills heading", async () => {
    // Purpose: the class-wide line shows at the top of the full sheet's Skills, right under its heading; the Player
    // screen's Skills has none (ps-7; plan test-feedback-2026-11-19 row A8).
    stalkerWorld(undefined, { note: "Mire stalkers learn these as children." });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    expect(
      screen.queryByText("Mire stalkers learn these as children."),
    ).toBeNull();
    await openFullSheet(user);
    const skills = await screen.findByRole("region", { name: "Skills" });
    const line = within(skills).getByText(
      "Mire stalkers learn these as children.",
    );
    expect(line.classList.contains("auth__meta")).toBe(true);
    expect(line.previousElementSibling?.tagName).toBe("H2");
  });

  it("a string skills.notes counts as the class line until the packs are rebuilt", async () => {
    // Purpose: an older pack's one-string `notes` shows as that same muted top line (on the full sheet's own page).
    stalkerWorld("Mire stalkers learn these as children.");
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    await openFullSheet(user);
    const skills = await screen.findByRole("region", { name: "Skills" });
    expect(
      within(skills)
        .getByText("Mire stalkers learn these as children.")
        .classList.contains("auth__meta"),
    ).toBe(true);
  });

  it("with no class line, the Skills list has no muted line", async () => {
    // Purpose: nothing is drawn when the pack has none.
    stalkerWorld(undefined);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    expect(
      (await screen.findByRole("region", { name: "Skills" })).querySelector(
        ".auth__meta",
      ),
    ).toBeNull();
  });

  it("a skill with no words anywhere shows the fallback", async () => {
    // Purpose: with neither source, the sheet still says the setting is silent and to ask the GM.
    stalkerWorld(undefined);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const sheet = await openSkill(
      user,
      /^Keen ear 1-2: where it comes from$/,
      "Keen ear",
    );
    expect(sheet.getByText(fallback)).toBeTruthy();
  });
});

describe("the Statuses row as rings (plan m5b-creation-retest-3 F)", () => {
  const TURN = 600;
  /** Invented: a condition with a symbol and a tone, given by the GM with a 6-turn timer, 4 turns left; and a typed one. */
  async function withStatuses(t: ReturnType<typeof fenWorld>) {
    world.tables.library_entries.push({
      id: "entry-condition-bog-adder-venom",
      pack_id: "pack-fen",
      kind: "condition",
      pack_entry_id: "bog-adder-venom",
      name: "Bog adder venom",
      data: {
        id: "bog-adder-venom",
        name: "Bog adder venom",
        icon: "drop",
        tone: "harm",
        notes: "Slow and sick until it passes.",
      },
    });
    world.signInAs(t.gm);
    await world.db.rpc("add_status", {
      campaign: t.campaign,
      actors: [t.wren!],
      status_name: "Bog adder venom",
      condition_id: "bog-adder-venom",
      icon: "drop",
      timer_seconds: 6 * TURN,
      timer_unit: "turn",
      source: "condition",
    });
    await world.db.rpc("add_status", {
      campaign: t.campaign,
      actors: [t.wren!],
      status_name: "Muddy boots",
    });
    // 4 of its 6 turns left.
    Object.assign(
      world.tables.character_statuses.find(
        (st) => st.name === "Bog adder venom",
      )!,
      { ends_at: 4 * TURN, total_seconds: 6 * TURN },
    );
    world.signInAs(t.me);
  }

  it("with no statuses, neither the row nor its heading is drawn", async () => {
    fenWorld();
    render(<Root db={world.db} />);
    await openPlayer(userEvent.setup());
    expect(screen.queryByRole("heading", { name: "Statuses" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Statuses" })).toBeNull();
  });

  it("each status is a ring: its tone, its arc, its words; no end is dashed; Encumbered is not one of them", async () => {
    const t = fenWorld();
    await withStatuses(t);
    render(<Root db={world.db} />);
    await openPlayer(userEvent.setup());
    // The head draws the rings beside the portrait with no heading (dec-13 C2, frame P1); the group keeps the name.
    const row = await screen.findByRole("group", { name: "Statuses" });
    const rings = within(row).getAllByRole("button");
    expect(rings.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Bog adder venom, 4 turns left. Details",
      "Muddy boots. Details",
    ]);
    const [venom, boots] = rings as [HTMLElement, HTMLElement];
    expect(
      venom
        .querySelector<HTMLElement>(".status-ring__mark")!
        .style.getPropertyValue("--ring-tone"),
    ).toBe("var(--danger)");
    const [drawn, length] = (
      venom
        .querySelector(".status-ring__arc")!
        .getAttribute("stroke-dasharray") ?? ""
    )
      .split(" ")
      .map(Number);
    expect(drawn! / length!).toBeCloseTo(2 / 3, 3);
    expect(venom.textContent).toBe("Bog adder venom4 turns");
    // A typed status: no symbol named (the first letter), no tone (ink), no end (dashed, no arc).
    expect(boots.querySelector(".status-ring__letter")?.textContent).toBe("M");
    expect(boots.querySelector(".status-ring__track--endless")).not.toBeNull();
    expect(boots.querySelector(".status-ring__arc")).toBeNull();
    expect(boots.textContent).toBe("MMuddy bootsuntil removed");
    expect(within(row).queryByText(/Encumbered/)).toBeNull();
  });

  it("the player's sheet: the big ring, the count, what it does, source, who set it, the log line to the log, Remove", async () => {
    const t = fenWorld();
    await withStatuses(t);
    render(<Root db={world.db} />);
    const user = userEvent.setup();
    await openPlayer(user);
    const sheet = await opensSheet(
      user,
      await screen.findByRole("button", {
        name: "Bog adder venom, 4 turns left. Details",
      }),
      "Bog adder venom",
    );
    const inSheet = within(sheet);
    expect(sheet.querySelector(".status-ring__mark--big")).not.toBeNull();
    expect(inSheet.getByText("4 of 6 turns left")).toBeTruthy();
    expect(inSheet.getByText("Slow and sick until it passes.")).toBeTruthy();
    expect(inSheet.getByText("From the setting's conditions")).toBeTruthy();
    expect(await inSheet.findByText("Priya")).toBeTruthy();
    expect(
      inSheet.queryByText("Only the GM changes the time left."),
    ).toBeNull();
    expect(inSheet.getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(inSheet.queryByRole("button", { name: "End it now" })).toBeNull();
    await user.click(
      inSheet.getByRole("button", { name: /^Log: .*Open the log$/ }),
    );
    expect(await screen.findByRole("dialog", { name: "Log" })).toBeTruthy();
    expect(
      screen.queryByRole("dialog", { name: "Bog adder venom" }),
    ).toBeNull();
  });
});

describe("the head (dec-13 C2: ps-3, ps-5; frames P1, P2)", () => {
  /** Six typed statuses on Wren (invented), each with no end. */
  async function sixStatuses(t: ReturnType<typeof fenWorld>) {
    world.signInAs(t.gm);
    for (const name of ["Muddy boots", "Reed-cut", "Mist-dazed", "Soaked", "Watchful", "Heartened"])
      await world.db.rpc("add_status", { campaign: t.campaign, actors: [t.wren!], status_name: name });
    world.signInAs(t.me);
  }
  const ringsIn = (row: HTMLElement) => row.querySelectorAll(".status-ring").length;

  it("on a phone the bar keeps the name and the head's line reads \"the\" kindred and the title", async () => {
    // Purpose: in one column the name stays in the bar and the rest of the head's words sit beside the portrait.
    fenWorld();
    render(<Root db={world.db} />);
    await openPlayer(userEvent.setup());
    expect(document.querySelector(".top-row__title")?.textContent).toBe("Wren");
    expect(document.querySelector(".player-head__line")?.textContent).toMatch(/^the Bog folk(, .+)?$/);
    expect(document.querySelector(".player-head .portrait--head")).not.toBeNull();
  });

  it("on a tablet in two columns the bar reads the name, \"the\" kindred and the title, and the head has no line", async () => {
    // Purpose: frame P1's bar, "Brannoch the Hornkin, Shieldbearer"; the head is the portrait and the rings alone.
    windowOf(1366);
    fenWorld();
    render(<Root db={world.db} />);
    await openPlayer(userEvent.setup());
    expect(document.querySelector(".top-row__title")?.textContent).toMatch(/^Wren the Bog folk(, .+)?$/);
    expect(document.querySelector(".player-head__line")).toBeNull();
  });

  it("six statuses on a phone: three rings in view, then \"+3\", which opens every status; a ring there opens its own", async () => {
    // Purpose: four in view at most, the rest one tap away (ps-5); a phone keeps three so the row fits 375 px.
    const t = fenWorld();
    await sixStatuses(t);
    render(<Root db={world.db} />);
    const user = userEvent.setup();
    await openPlayer(user);
    const row = await screen.findByRole("group", { name: "Statuses" });
    expect(ringsIn(row)).toBe(3);
    // Three or more: the ring alone, its name and time in its label.
    expect(row.querySelector(".status-ring__name")).toBeNull();
    const more = within(row).getByRole("button", { name: "3 more: see every status" });
    expect(more.textContent).toBe("+3");
    const sheet = await opensSheet(user, more, "Statuses");
    expect(sheet.querySelectorAll(".status-ring").length).toBe(6);
    await user.click(within(sheet).getByRole("button", { name: "Watchful. Details" }));
    expect(await screen.findByRole("dialog", { name: "Watchful" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Statuses" })).toBeNull();
  });

  it("six statuses on a tablet: four rings in view, then \"+2\"", async () => {
    // Purpose: frame P1's four in view.
    windowOf(1366);
    const t = fenWorld();
    await sixStatuses(t);
    render(<Root db={world.db} />);
    await openPlayer(userEvent.setup());
    const row = await screen.findByRole("group", { name: "Statuses" });
    expect(ringsIn(row)).toBe(4);
    expect(within(row).getByRole("button", { name: "2 more: see every status" })).toBeTruthy();
  });

  it("four statuses show all four rings and no \"+N\", even on a phone", async () => {
    // Purpose: "+N" only when there are more than four.
    const t = fenWorld();
    world.signInAs(t.gm);
    for (const name of ["Muddy boots", "Reed-cut", "Mist-dazed", "Soaked"])
      await world.db.rpc("add_status", { campaign: t.campaign, actors: [t.wren!], status_name: name });
    world.signInAs(t.me);
    render(<Root db={world.db} />);
    await openPlayer(userEvent.setup());
    const row = await screen.findByRole("group", { name: "Statuses" });
    expect(ringsIn(row)).toBe(4);
    expect(row.querySelector(".status-ring-more")).toBeNull();
  });

  it("one status: its name and time in words beside the ring", async () => {
    // Purpose: frame P2, with one or two rings the words sit beside the ring.
    const t = fenWorld();
    world.signInAs(t.gm);
    await world.db.rpc("add_status", { campaign: t.campaign, actors: [t.wren!], status_name: "Muddy boots" });
    world.signInAs(t.me);
    render(<Root db={world.db} />);
    await openPlayer(userEvent.setup());
    const ring = (await screen.findByRole("group", { name: "Statuses" })).querySelector(".status-ring")!;
    expect(ring.classList.contains("status-ring--beside")).toBe(true);
    expect(ring.querySelector(".status-ring__beside")?.textContent).toBe("Muddy bootsuntil removed");
  });
});

describe("the drawer’s nit (Design on #549)", () => {
  it("a player with no character yet is offered no Full character sheet or Company", async () => {
    windowOf(1024);
    fenWorld({ withCharacter: false });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(
      await screen.findByRole("button", { name: /The Ash Barrows/ }),
    );
    await screen.findByText(/Make your first character/);
    await user.click(
      screen.getByRole("button", { name: "Account and device options" }),
    );
    const items = [...document.querySelectorAll(".more-menu__item")].map(
      (b) => b.textContent,
    );
    expect(items).toContain("Setting rules");
    expect(items).not.toContain("Full character sheet");
    expect(items).not.toContain("Company");
  });
});

describe("the two columns (dec-13 C1: ps-2, ps-2a, ps-4)", () => {
  /** Whether a comes before b in the page. */
  const before = (a: Element, b: Element) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  const region = (name: string) => screen.getAllByRole("region", { name })[0]!;

  it("on a landscape tablet the left holds the vitals, the level block and Details; the right the scores, saves, Traits, Skills and the full sheet, in that order", async () => {
    // Purpose: the tablet's order is ps-2's, the left for what the player does now and the right for reference.
    windowOf(1024);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const left = document.querySelector(".player__pane--play")!;
    const right = document.querySelector(".player__right")!;
    await waitFor(() =>
      expect(right.querySelector('[aria-label="Scores"]')).not.toBeNull(),
    );
    for (const name of ["Vitals", "Level", "Details"])
      expect(left.contains(region(name))).toBe(true);
    for (const name of [
      "Scores",
      "Saves",
      "Abilities and traits",
      "Skills",
    ])
      expect(right.contains(region(name))).toBe(true);
    // Then the sheet's rows, with no heading (tfr-4, tfr-5): Notes last.
    const notes = await screen.findByRole("button", { name: "Notes" });
    expect(right.contains(notes)).toBe(true);
    expect(before(region("Vitals"), region("Level"))).toBe(true);
    expect(before(region("Level"), region("Details"))).toBe(true);
    expect(before(region("Scores"), region("Saves"))).toBe(true);
    expect(before(region("Saves"), region("Abilities and traits"))).toBe(true);
    expect(before(region("Abilities and traits"), region("Skills"))).toBe(true);
    expect(before(region("Skills"), notes)).toBe(true);
    // Each part once: no second Saves or Skills on the screen.
    expect(screen.getAllByRole("region", { name: "Saves" })).toHaveLength(1);
    expect(screen.getAllByRole("region", { name: "Skills" })).toHaveLength(1);
  });

  it("on a phone the saves sit directly under hit points and armour class, then the left, then the right, and the sheet's rows last", async () => {
    // Purpose: ps-2a's order in one column, the saves straight after the vitals.
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const saves = await screen.findByRole("region", { name: "Saves" });
    expect(region("Vitals").nextElementSibling?.contains(saves)).toBe(true);
    // The sheet's rows where the one row "Full character sheet" was (tfr-5): Notes last.
    const sheetRow = await screen.findByRole("button", { name: "Notes" });
    expect(
      screen.queryByRole("button", { name: /^Full character sheet/ }),
    ).toBeNull();
    const order = [
      saves,
      region("Level"),
      region("Details"),
      region("Scores"),
      region("Abilities and traits"),
      region("Skills"),
      sheetRow,
    ];
    for (let n = 1; n < order.length; n += 1)
      expect(before(order[n - 1]!, order[n]!)).toBe(true);
    expect(
      screen.queryByRole("region", { name: "Full character sheet" }),
    ).toBeNull();
  });

  it("no hint line explains what the screen shows, on a tablet or a phone; the full sheet page keeps its own", async () => {
    // Purpose: mc-46: no "Tap a figure…", "Tap a score…" or "Tap a row…" line on the Player screen (frames P1, P2).
    const hints = [
      "Tap a figure for where it comes from",
      "Tap a score for everything it changes",
      "Tap a row for the full rule",
    ];
    for (const width of [1024, 375]) {
      windowOf(width);
      fenWorld();
      const user = userEvent.setup();
      render(<Root db={world.db} />);
      await openPlayer(user);
      await screen.findAllByRole("region", { name: "Scores" });
      for (const hint of hints) expect(screen.queryByText(hint)).toBeNull();
      cleanup();
      world = createFakeDb();
      forgetCampaignSetting();
      sessionStorage.clear();
      localStorage.clear();
    }
  });

  it("no party list and no marching order on the Player screen, on a tablet or a phone", async () => {
    // Purpose: ps-4: they live on Scene.
    for (const width of [1024, 375]) {
      windowOf(width);
      fenWorld();
      const user = userEvent.setup();
      render(<Root db={world.db} />);
      await openPlayer(user);
      await screen.findAllByRole("region", { name: "Scores" });
      expect(screen.queryByRole("heading", { name: "The party" })).toBeNull();
      expect(screen.queryByText(/marching order/i)).toBeNull();
      cleanup();
      world = createFakeDb();
      forgetCampaignSetting();
      sessionStorage.clear();
      localStorage.clear();
    }
  });
});

describe('pins reach traits (dec-13 C8, pin-2; row P3, euf-3, page 28)', () => {
  const region = (name: string) => screen.queryByRole('region', { name });
  const list = async () => within(await screen.findByRole('region', { name: 'Abilities and traits' }));
  const block = () => document.querySelector('.pinned-box--block');

  it('the star on a trait’s sheet makes it a block first in Abilities and traits, never At hand; Undo puts it back', async () => {
    const { wren } = fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    expect(region('At hand')).toBeNull();
    await user.click((await list()).getByRole('button', { name: /^Steady flame/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Steady flame' }));
    const star = sheet.getByRole('button', { name: 'Pin to top' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    await user.click(star);
    expect(await screen.findByText('Steady flame pinned to the top')).toBeTruthy();
    await waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === wren)?.pins).toEqual([{ kind: 'trait', key: 'Steady flame' }]));
    // Each thing once: a block in the right column's list with the small star before the name, never At hand.
    await waitFor(() => expect(block()).not.toBeNull());
    const row = within(block() as HTMLElement).getByRole('button', { name: /^Steady flame, pinned/ });
    expect(row.querySelector('.list-row__title .pinned-mark')).not.toBeNull();
    expect(row.querySelector('.list-row__sub')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('● 1 of 1 left, back each day');
    expect(region('At hand')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Use Steady flame' })).toHaveLength(1);
    // Undo in the toast unpins it: a row again, no block.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === wren)?.pins).toEqual([]));
    await waitFor(() => expect(block()).toBeNull());
    expect((await list()).getByRole('button', { name: 'Use Steady flame' })).toBeTruthy();
  });

  it('a pinned trait’s Use in its block marks a use; its sheet’s filled star unpins it', async () => {
    const { wren, campaign } = fenWorld();
    world.tables.character_play.push({ actor_id: wren!, campaign_id: campaign, prepared: [], uses_spent: {}, pins: [{ kind: 'trait', key: 'Steady flame' }] });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    await list();
    await waitFor(() => expect(block()).not.toBeNull());
    const inBlock = within(block() as HTMLElement);
    await user.click(inBlock.getByRole('button', { name: 'Use Steady flame' }));
    expect(await screen.findByText('Used Steady flame, 0 of 1 left')).toBeTruthy();
    await waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === wren)?.uses_spent).toMatchObject({ 'Steady flame': 1 }));
    await user.click(within(block() as HTMLElement).getByRole('button', { name: /^Steady flame/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Steady flame' }));
    const star = sheet.getByRole('button', { name: 'Unpin' });
    expect(star.getAttribute('aria-pressed')).toBe('true');
    await user.click(star);
    expect(await screen.findByText('Steady flame unpinned')).toBeTruthy();
    await waitFor(() => expect(block()).toBeNull());
    expect(region('At hand')).toBeNull();
  });

  it('a stored pin whose trait is gone shows nothing and leaves the list as it is', async () => {
    const { wren, campaign } = fenWorld();
    world.tables.character_play.push({ actor_id: wren!, campaign_id: campaign, prepared: [], uses_spent: {}, pins: [{ kind: 'trait', key: 'Gone power' }] });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    expect((await list()).getByRole('button', { name: 'Use Steady flame' })).toBeTruthy();
    expect(block()).toBeNull();
    expect(region('At hand')).toBeNull();
    expect(screen.queryByText('Gone power')).toBeNull();
  });
});

describe("Details on the Player screen (dec-13 C4: ps-3, frame P1)", () => {
  it("shows the sheet’s details as the book’s labelled lines, and literacy under Languages, not in Details", async () => {
    // Purpose: Details is the pack's and the player's own words, read once from the sheet; the literacy the character
    // has (the pack's word, "Reads") is the line under Languages, and Literacy leaves Details.
    const { wren } = fenWorld();
    const actor = world.tables.actors.find((a) => a.id === wren)!;
    Object.assign(actor, {
      fields: {
        ...(actor.fields as Record<string, unknown>),
        motto: "Ask the water first.",
        affiliation: "The Lantern Wardens",
        literacy: "Reads",
      },
      backstory:
        "Wren cut reeds on the Ash Barrows until the lanterns went out.",
    });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const details = await screen.findByRole("region", { name: "Details" });
    // Folded at first, however few lines (tfr-1, C5): its heading row opens it.
    const fold = within(details).getByRole("button", { name: "Details" });
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(details.querySelector(".book-line")).toBeNull();
    await user.click(fold);
    await waitFor(() =>
      expect(details.querySelector(".book-line")).not.toBeNull(),
    );
    const labels = [
      ...details.querySelectorAll(".book-line > .book-label"),
    ].map((l) => l.textContent);
    expect(labels).toEqual([
      "Motto",
      "Affiliation",
      "Kindred",
      "Class",
      "Backstory",
    ]);
    expect(within(details).getByText(/Ask the water first\./)).toBeTruthy();
    expect(
      within(details).getByText(/until the lanterns went out/),
    ).toBeTruthy();
    const languages = screen.getAllByRole("region", { name: "Languages" })[0]!;
    expect(within(languages).getByText("Reads.")).toBeTruthy();
  });

  it("adds Kindred, Class and the alignment as P3 draws them, each name a tap to its entry, after the player's words (pib-3)", async () => {
    // Purpose: the sheet hands Details who the character is, in the pack's words (its word for kindred, its alignment
    // field's label), each name opening its entry and followed by the entry's own short line; the backstory is
    // labelled. Invented pack: "Bog folk", "Lantern Warden", "Lantern".
    const { wren, campaign } = fenWorld();
    // The layout's Background, fed by the kindred's list (the fixture's `from`), which fenWorld leaves out.
    world.tables.field_definitions.push({
      id: "field-background",
      campaign_id: campaign,
      applies_to: "pc",
      key: "background",
      label: "Background",
      type: "text",
      choices: [],
      field_group: "Who they are",
      sort_order: 90,
      show_on_card: false,
      hidden: false,
      fill: null,
      required: false,
      from_list: null,
      created_at: "2026-10-18T12:00:00Z",
    });
    const actor = world.tables.actors.find((a) => a.id === wren)!;
    Object.assign(actor, {
      fields: {
        ...(actor.fields as Record<string, unknown>),
        motto: "Ask the water first.",
        alignment: "Lantern",
        background: "eel-catcher",
      },
      backstory: "Wren cut reeds on the Ash Barrows.",
    });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const details = await screen.findByRole("region", { name: "Details" });
    await user.click(within(details).getByRole("button", { name: "Details" }));
    await waitFor(() =>
      expect(details.querySelector(".book-line")).not.toBeNull(),
    );
    const lines = [...details.querySelectorAll(".book-line")].map(
      (l) => l.textContent,
    );
    expect(lines).toEqual([
      "Motto Ask the water first.",
      "Kindred Bog folk. Short, damp and hard to drown.",
      "Class Lantern Warden. Keeps the light alive and the dark at bay.",
      "Leaning Lantern. Keeps the lights lit for everyone.",
      "Background Eel catcher. Knows the channels and their moods.",
      "Backstory Wren cut reeds on the Ash Barrows.",
    ]);
    await opensSheet(
      user,
      within(details).getByRole("button", { name: "Bog folk: open its entry" }),
      "Bog folk",
    );
  });

  it("is open again when the Player tab is opened again after Details was left open (euf-1, P1)", async () => {
    // Purpose: the Player screen hands Details its character, so the fold left open is remembered on this device for
    // that character, and the tab opened again shows it open.
    const { wren } = fenWorld();
    const actor = world.tables.actors.find((a) => a.id === wren)!;
    actor.fields = {
      ...(actor.fields as Record<string, unknown>),
      motto: "Ask the water first.",
    };
    const user = userEvent.setup();
    const first = render(<Root db={world.db} />);
    await openPlayer(user);
    const details = await screen.findByRole("region", { name: "Details" });
    await user.click(within(details).getByRole("button", { name: "Details" }));
    await waitFor(() =>
      expect(within(details).getByText(/Ask the water first\./)).toBeTruthy(),
    );
    first.unmount();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const again = await screen.findByRole("region", { name: "Details" });
    expect(
      within(again)
        .getByRole("button", { name: "Details" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    await waitFor(() =>
      expect(within(again).getByText(/Ask the water first\./)).toBeTruthy(),
    );
  });

  /** A hidden field (only the GM sees it) on the campaign, with words written on Wren. */
  const hiddenOath = (campaign: string, wren: string) => {
    world.tables.field_definitions.push({
      id: "field-old-oath",
      campaign_id: campaign,
      applies_to: "pc",
      key: "old_oath",
      label: "Old oath",
      type: "text",
      choices: [],
      field_group: "",
      sort_order: 99,
      show_on_card: false,
      hidden: true,
      fill: null,
      required: false,
      from_list: null,
      created_at: "2026-10-18T12:00:00Z",
    });
    const actor = world.tables.actors.find((a) => a.id === wren)!;
    actor.fields = {
      ...(actor.fields as Record<string, unknown>),
      old_oath: "Sworn to the drowned bell.",
      motto: "Ask the water first.",
    };
  };

  it("never hands a player the hidden fields", async () => {
    // Purpose (the review of #910): the GM's hidden fields never reach a player's Details, by line or by heading.
    const { campaign, wren } = fenWorld();
    hiddenOath(campaign, wren!);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const details = await screen.findByRole("region", { name: "Details" });
    // Opened (folded at first, tfr-1), so the player's own lines are there to compare with.
    await user.click(within(details).getByRole("button", { name: "Details" }));
    await waitFor(() =>
      expect(within(details).getByText(/Ask the water first\./)).toBeTruthy(),
    );
    expect(
      within(details).queryByText("Sworn to the drowned bell."),
    ).toBeNull();
    expect(
      within(details).queryByRole("heading", { name: "Hidden fields" }),
    ).toBeNull();
  });

  it('shows the GM their hidden fields under "Hidden fields", not among the lines', async () => {
    // Purpose (the review of #910): the hosted sheet hands the GM's hidden fields over as their own labelled group, so
    // Details draws them as the sheet drew them before C4, not appended to its lines with no heading. (The GM reaches
    // a hosted sheet by no screen today; the sheet is rendered hosted directly, as the Player screen hosts it.)
    const { gm, campaign, wren } = fenWorld();
    hiddenOath(campaign, wren!);
    world.signInAs(gm);
    const asGm: CurrentUser = { id: gm, roles: { [campaign]: "gm" } };
    render(
      <CharacterSheet
        db={world.db}
        user={asGm}
        characterId={wren!}
        host={({ parts }) => <PlayerDetails part={parts?.details} />}
      />,
    );
    // Details starts folded (tfr-1): the hidden fields show under their heading once the sheet has opened; then the
    // player's lines are opened, so the check below compares against lines that are really there.
    const heading = await screen.findByRole(
      "heading",
      { name: "Hidden fields" },
      { timeout: 4000 },
    );
    const details = screen.getByRole("region", { name: "Details" });
    expect(details.contains(heading)).toBe(true);
    await userEvent
      .setup()
      .click(within(details).getByRole("button", { name: "Details" }));
    await waitFor(() =>
      expect(details.querySelector(".book-line")).not.toBeNull(),
    );
    const oath = within(details).getByText("Sworn to the drowned bell.");
    expect(
      [...details.querySelectorAll(".book-line > .book-label")].map(
        (l) => l.textContent,
      ),
    ).not.toContain("Old oath");
    expect(
      heading.compareDocumentPosition(oath) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('the sheet’s rows on the Player tab (dec-13 C12, frame P1; tfr-4, tfr-5)', () => {
  const foot = () => document.querySelector('.player__right .sheet--beside') as HTMLElement;

  it('on a tablet the rows are summary rows with a chevron, each opening what the sheet showed; Notes opens the notes', async () => {
    // Purpose: P1 draws the rows as short rows, not today's whole sections; nothing is lost, each opens. No heading (tfr-4).
    windowOf(1024);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    await waitFor(() => expect(within(foot()).getByRole('button', { name: 'Notes' })).toBeTruthy());
    const rows = within(foot()).getAllByRole('button').filter((b) => b.querySelector('.list-row__chevron'));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) expect(row.querySelector('.list-row__chevron')).not.toBeNull();
    // The Abilities and Traits rows by name, each with its chevron (the review of #914).
    for (const name of [/^Abilities/, /^Traits/]) {
      const row = within(foot()).getByRole('button', { name });
      expect(row.querySelector('.list-row__chevron')).not.toBeNull();
    }
    // No old whole sections: the Notes button of the old foot is a row now.
    expect(foot().querySelector('.sheet__notes-row')).toBeNull();
    await user.click(within(foot()).getByRole('button', { name: 'Notes' }));
    expect(await screen.findByRole('dialog', { name: /Notes/ })).toBeTruthy();
  });
});

describe("the book's pop-ups stop at creation's parts beside the Player tab (tfb-1, row C8; the review of #1079)", () => {
  // Purpose: on a tablet held sideways the sheet's rest sits beside the tab; Notes there is one of the tab's book
  // pop-ups (red heading), but a step To finish opens and the edit form's pop-ups are creation's and keep the Sheet's
  // own heading, as they do on a phone. Since the M1 stack, "To finish" is a notice in the notices box (row C1, tfn-2)
  // and Edit is on the cards of Your characters (tfr-4): the two tests reach them there.
  const headingOf = (dialog: HTMLElement) => dialog.querySelector(".dialog__head .dialog__title")!;

  it("Notes beside the tab takes the red heading; a step from To finish keeps the Sheet's own", async () => {
    windowOf(1366);
    const t = fenWorld();
    // A background put off at creation (the fixture's per-kindred trait list), so the To finish card lists it beside
    // the tab.
    world.tables.field_definitions.push({ id: "field-background", campaign_id: t.campaign, applies_to: "pc", key: "background", label: "Background", type: "text", choices: [], field_group: "Who they are", sort_order: 99, show_on_card: false, hidden: false, fill: null, required: false, from_list: null, created_at: "2026-10-18T12:00:00Z" });
    Object.assign(world.tables.actors.find((a) => a.id === t.wren)!, { creation: { toFinish: ["fen-backgrounds-bog-folk"] } });
    render(<Root db={world.db} />);
    const user = userEvent.setup();
    await openPlayer(user);
    await user.click(await screen.findByRole("button", { name: /^Notes/ }));
    const notes = await screen.findByRole("dialog", { name: "Notes" });
    expect(headingOf(notes).classList.contains("book-heading")).toBe(true);
    await user.click(within(notes).getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: /notices?, open them$/ }));
    const sheet = await screen.findByRole("dialog", { name: "Notices" });
    while (!within(sheet).queryByRole("region", { name: "To finish" })) {
      await user.click(within(sheet).getByRole("button", { name: "Next" }));
    }
    const card = within(sheet).getByRole("region", { name: "To finish" });
    const item = within(card).getAllByRole("button")[0]!;
    await user.click(item);
    const step = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(headingOf(step).classList.contains("book-heading")).toBe(false);
    expect(step.classList.contains("dialog--book")).toBe(false);
  });

  it("the edit form's pop-ups beside the tab keep the Sheet's own heading", async () => {
    windowOf(1366);
    fenWorld();
    render(<Root db={world.db} />);
    const user = userEvent.setup();
    await openPlayer(user);
    await user.click(screen.getByRole("button", { name: "Character options" }));
    await user.click(screen.getByRole("button", { name: "Your characters" }));
    await user.click(await screen.findByRole("button", { name: "Edit Wren" }));
    const form = await screen.findByRole("form", { name: "Edit Wren" });
    await user.click(within(form).getAllByRole("button", { name: /Change it$/ })[0]!);
    const pop = screen.getAllByRole("dialog").at(-1)!;
    expect(headingOf(pop).classList.contains("book-heading")).toBe(false);
    expect(pop.classList.contains("dialog--book")).toBe(false);
  });
});
