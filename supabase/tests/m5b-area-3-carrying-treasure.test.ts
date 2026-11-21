// M5b pack review area 3 (build order 12): the GM's Carrying treasure switch (ruled 2026-11-04, eq-3;
// supabase/migrations/20261104220000_m5b_area_3_carrying_treasure.sql). TEST project only; invented content.
//   The GM switches it for a character: one Simple log line, the player reads it, and Undo puts it back to null.
//   A player can't change it, neither by the command nor straight at the table.
//   The database's tier line (20261104220500_m5b_area_3_treasure_on_fill.sql, the fix forward over #435's 200000):
//   reads the switch, and still weighs a bag by how full it is (eq-5) and ignores what's inside such a bag.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppRegistry } from "../../src/app/commandRegistry.ts";
import { runCommand, type CurrentUser } from "../../src/core/commands.ts";
import { loadCurrentUser } from "../../src/core/currentUser.ts";
import type { Db } from "../../src/core/supabase.ts";
import { undoChange } from "../../src/core/undo.ts";
import {
  addItem,
  moveItem,
  type CarrierRef,
  type ItemCopy,
} from "../../src/modules/inventory/inventory.ts";
import { setCarryingTreasure } from "../../src/modules/inventory/treasureSwitch.ts";
import { attachPack } from "../../src/modules/library/campaignPacks.ts";
import { importPack } from "../../src/modules/library/library.ts";
import { readPackJson } from "../../src/modules/library/packFile.ts";
import {
  buildWorld,
  must,
  tearDownWorld,
  type Person,
  type World,
} from "./world.ts";

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(
  person: Person,
  command: Parameters<typeof runCommand<I, T, O>>[3],
  input: I,
) {
  return runCommand(
    registry,
    asDb(person),
    (await loadCurrentUser(asDb(person))) as CurrentUser,
    command,
    input,
  );
}

const wren = () => ({
  campaignId: world.campaignId,
  actorId: world.wrenId,
  locationId: null,
  ownerUserId: world.playerA.id,
  archived: false,
});
const switchOf = async () =>
  must(
    await world.admin
      .from("actors")
      .select("carrying_treasure")
      .eq("id", world.wrenId)
      .single(),
  ).carrying_treasure;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("the Carrying treasure switch (eq-3)", () => {
  // Purpose: the GM's flip is stored, logged as one Simple line, readable by the player, and Undo puts it back.
  it("the GM's switch is one Simple line, the player reads it, and Undo puts it back to null", async () => {
    expect(await switchOf()).toBeNull();
    expect(
      (await as(world.gm, setCarryingTreasure, { carrier: wren(), on: true }))
        .ok,
    ).toBe(true);
    expect(await switchOf()).toBe(true);

    const lines = must(
      await world.admin
        .from("events")
        .select("id, level, target_table")
        .eq("campaign_id", world.campaignId)
        .eq("type", "inventory.carryingTreasure")
        .order("seq"),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "simple", target_table: "actors" });

    const seen = must(
      await world.playerA.db
        .from("actors")
        .select("carrying_treasure")
        .eq("id", world.wrenId)
        .single(),
    );
    expect(seen.carrying_treasure).toBe(true);

    const undone = await as(world.gm, undoChange, {
      campaignId: world.campaignId,
      eventId: lines[0]!.id as string,
      authorUserId: world.gm.id,
    });
    expect(undone).toMatchObject({ ok: true });
    expect(await switchOf()).toBeNull();
  });

  // Purpose: only the GM changes the switch, by the command and at the database itself.
  it("a player can't switch it, neither by the command nor straight at the table", async () => {
    const refused = await as(world.playerA, setCarryingTreasure, {
      carrier: wren(),
      on: true,
    });
    expect(refused.ok).toBe(false);
    const direct = await world.playerA.db
      .from("actors")
      .update({ carrying_treasure: true })
      .eq("id", world.wrenId)
      .select("id");
    expect(direct.error !== null || (direct.data ?? []).length === 0).toBe(
      true,
    );
    expect(await switchOf()).toBeNull();
  });

  // Purpose: a player's write of the value already stored is refused too (20261104221000), so the database never
  // lets a player run the GM's command, whatever the switch holds.
  it("a player can't write the switch even to the value it already holds", async () => {
    const direct = await world.playerA.db
      .from("actors")
      .update({ carrying_treasure: null })
      .eq("id", world.wrenId)
      .select("id");
    expect(direct.error?.code).toBe("42501");
    const viaCommand = await setCarryingTreasure.run(asDb(world.playerA), (await loadCurrentUser(asDb(world.playerA))) as CurrentUser, {
      carrier: wren(),
      on: null,
    });
    expect(viaCommand).toMatchObject({ ok: false, reason: "not-allowed" });
  });
});

// The tier line "<name> is now <tier>" with the switch and a bag by fill (the same invented rules as m5-intents.test.ts).
describe("the tier line reads the switch and still counts a bag by fill (20261104220500)", () => {
  let packId = "";
  const oneOff = (
    name: string,
    weightCoin: number | null,
    extra: Partial<ItemCopy> = {},
  ): ItemCopy => ({
    libraryEntryId: null,
    name,
    category: "gear",
    weightCoin,
    slots: null,
    stack: 1,
    ...extra,
  });
  const storedTier = async (actorId: string) =>
    (
      must(
        await world.admin
          .from("carrier_loads")
          .select("tier")
          .eq("actor_id", actorId),
      )[0] as { tier: string } | undefined
    )?.tier;
  const setMode = async (mode: "none" | "coin" | "armour") =>
    must(
      await world.admin
        .from("campaigns")
        .update({ settings: { encumbrance: { mode } } })
        .eq("id", world.campaignId)
        .select("id"),
    );
  async function newCharacter(name: string): Promise<CarrierRef> {
    const [row] = must(
      await world.admin
        .from("actors")
        .insert({
          campaign_id: world.campaignId,
          kind: "pc",
          name,
          owner_type: "user",
          owner_user_id: world.playerA.id,
          approval: "approved",
        })
        .select("id"),
    );
    return {
      campaignId: world.campaignId,
      actorId: row!.id as string,
      locationId: null,
      ownerUserId: world.playerA.id,
      archived: false,
    };
  }
  async function give(carrier: CarrierRef, item: ItemCopy, qty = 1) {
    const added = await as(world.gm, addItem, {
      carrier,
      item,
      qty,
      howGot: "given",
      equipped: false,
    });
    if (!added.ok) throw new Error(added.message);
    return added.value;
  }

  beforeAll(async () => {
    const read = readPackJson(
      JSON.stringify({
        format: "tabletop-pack",
        formatVersion: 2,
        meta: { name: "Fen treasure rules" },
        rulesSets: [
          {
            id: "fen-treasure",
            name: "Fen treasure",
            encumbrance: {
              containers: "hold-only",
              coin: {
                maxLoadCoin: 400,
                tiers: [
                  { label: "Unhindered", max: 100 },
                  { label: "Laden", max: 250 },
                  { label: "Bowed", max: 400 },
                ],
                overMax: "Can’t budge",
              },
              armour: {
                maxLoadCoin: 800,
                movement: [
                  {
                    armour: "none",
                    withoutTreasure: "120 ft",
                    withTreasure: "90 ft",
                  },
                ],
                armourTypes: {},
              },
              treasureWeights: { gem: 1 },
            },
          },
        ],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    packId = made.value;
    const attached = await as(world.gm, attachPack, {
      campaignId: world.campaignId,
      packId,
    });
    if (!attached.ok) throw new Error(attached.message);
  }, 120_000);

  afterAll(async () => {
    await setMode("none");
    if (packId) await world.admin.from("packs").delete().eq("id", packId);
  }, 60_000);

  // Purpose: in armour mode a gem inside a bag that weighs by fill doesn't count (eq-5), so the line says the
  // no-treasure move; the GM's switch on makes it the treasure move at once, and back to null follows the pack again.
  it("armour mode: the GM's switch decides over a gem hidden in a bag by fill", async () => {
    await setMode("armour");
    const grebe = await newCharacter("Grebe");
    const satchel = await give(
      grebe,
      oneOff("Heron satchel", 200, {
        details: {
          container: { capacityCoin: 400, weightEmpty: 0, weightFull: 200 },
        },
      }),
    );
    const pearl = await give(
      grebe,
      oneOff("River pearl", null, { category: "gem" }),
    );
    const moved = await as(world.gm, moveItem, {
      line: { id: pearl.id, carrier: grebe, version: pearl.version },
      to: grebe,
      containerLineId: satchel.id,
      qty: 1,
      of: 1,
    });
    if (!moved.ok) throw new Error(moved.message);
    expect(await storedTier(grebe.actorId!)).toBe("Move 120 ft");

    expect(
      (await as(world.gm, setCarryingTreasure, { carrier: grebe, on: true }))
        .ok,
    ).toBe(true);
    expect(await storedTier(grebe.actorId!)).toBe("Move 90 ft");
    expect(
      (await as(world.gm, setCarryingTreasure, { carrier: grebe, on: null }))
        .ok,
    ).toBe(true);
    expect(await storedTier(grebe.actorId!)).toBe("Move 120 ft");

    // A loose gem counts; the GM's "off" wins over it.
    await give(grebe, oneOff("Marsh pearl", null, { category: "gem" }));
    expect(await storedTier(grebe.actorId!)).toBe("Move 90 ft");
    expect(
      (await as(world.gm, setCarryingTreasure, { carrier: grebe, on: false }))
        .ok,
    ).toBe(true);
    expect(await storedTier(grebe.actorId!)).toBe("Move 120 ft");
  });

  // Purpose: #435's bag by fill (eq-5) is still in the tier line after the fix forward: a half-full satchel weighs half.
  it("coin mode: a half-full bag weighs half-way, and its contents do not count", async () => {
    await setMode("coin");
    const snipe = await newCharacter("Snipe");
    const satchel = await give(
      snipe,
      oneOff("Heron satchel", 200, {
        details: {
          container: { capacityCoin: 400, weightEmpty: 0, weightFull: 200 },
        },
      }),
    );
    const stones = await give(snipe, oneOff("River stones", 200));
    const moved = await as(world.gm, moveItem, {
      line: { id: stones.id, carrier: snipe, version: stones.version },
      to: snipe,
      containerLineId: satchel.id,
      qty: 1,
      of: 1,
    });
    if (!moved.ok) throw new Error(moved.message);
    expect(await storedTier(snipe.actorId!)).toBe("Unhindered");
    await give(snipe, oneOff("Iron bar", 100));
    expect(await storedTier(snipe.actorId!)).toBe("Laden");
  });
});
