"""Check an adventure pack (format version 3) until M8b's importer exists.

Usage:
  py check_adventure.py PACK.json [--id-plan id-plan.json] [--other-pack OTHER.pack.json ...] [--spot 5]

It checks, with no extra installs:
- the JSON schema in ../schema/adventure-pack-v3.schema.json (fields 07 doesn't
  define are listed as off-spec, not as errors);
- meta.code, and that every entry id starts with it plus a dash;
- ids unique per kind, and every same-pack link (parentId, npcId, tableId...) resolves;
- cross-pack references ("<meta.id>:<id>"): resolved against --other-pack files,
  else listed as needing that pack, and checked against meta.requires;
- images: alt text, crops always gm, readAloud pointing at crops, .webp files;
- a page reference (source) on every entry;
- the 2026-10-24 rulings: treasure `value` in whole coins (old valueGp is converted,
  coins the setting doesn't define are warned about), rumour truth as strings,
  roster entries with npcId or name (never both), adventure mechanics without a
  ruleKey, and every `option` link naming a real switch and choice;
- possible leaks: player-facing text naming an NPC, a hidden route's far end,
  or sharing 4+ words in a row with a secret or clue (for the Reviewer to judge);
- counts against the ID plan, and which map keys have locations.
--spot N picks N random locations for the Reviewer's spot checks.
Exit code 1 when there are errors.
"""
import argparse
import json
import os
import random
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from copy_check import build_index, find_runs  # noqa: E402

SCHEMA = os.path.join(HERE, "..", "schema", "adventure-pack-v3.schema.json")
KINDS = ["locations", "routes", "npcs", "factions", "shops", "tracks", "images", "timeline", "premades",
         "items", "lightTypes", "classes", "xpTables", "rulesSets", "conditions", "statBlocks", "tables",
         "fieldTemplates", "calendars", "options", "races", "spells", "spellLists", "treasureTypes",
         "startingKits", "hooks"]
# Same-pack link key -> the kinds its id may name.
LINKS = {"parentId": ["locations"], "locationId": ["locations"], "locationIds": ["locations"],
         "npcId": ["npcs"], "factionId": ["factions"], "memberIds": ["npcs"], "statBlockId": ["statBlocks"],
         "itemId": ["items"], "tableId": ["tables"], "shopId": ["shops"], "trackId": ["tracks"],
         "imageId": ["images"], "mapId": ["images"], "playerVersionId": ["images"],
         "pointsTo": ["locations", "npcs", "items", "factions"]}
REFS = {"itemRef", "classRef", "statBlockRef", "itemRefs", "tableRef"}   # tableRef: an encounter check's table in another pack (G-154)
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


# ---- a small JSON-schema reader (only the keywords the schema file uses) ----

def is_type(value, name):
    if name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if name == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return isinstance(value, TYPES[name])


def validate(value, schema, root, path, errors, offspec):
    if "$ref" in schema:
        schema = root["$defs"][schema["$ref"].split("/")[-1]]
    if "anyOf" in schema:
        if not any(not validate_quiet(value, option, root) for option in schema["anyOf"]):
            errors.append(f"{path}: doesn't match any allowed shape")
        return
    types = schema.get("type")
    if types is not None:
        types = types if isinstance(types, list) else [types]
        if not any(is_type(value, t) for t in types):
            errors.append(f"{path}: should be {' or '.join(types)}")
            return
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: should be {json.dumps(schema['const'])}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {json.dumps(value)} isn't one of {json.dumps(schema['enum'])}")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path}: is empty")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: {json.dumps(value)} doesn't fit the expected form")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: needs at least {schema['minItems']}")
        if "items" in schema:
            for i, item in enumerate(value):
                label = item.get("id") if isinstance(item, dict) and isinstance(item.get("id"), str) else i
                validate(item, schema["items"], root, f"{path}[{label}]", errors, offspec)
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing {key}")
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for key, item in value.items():
            if key in props:
                validate(item, props[key], root, f"{path}.{key}", errors, offspec)
            elif extra is False:
                offspec.append(f"{path}.{key}")
            elif isinstance(extra, dict):
                validate(item, extra, root, f"{path}.{key}", errors, offspec)


def validate_quiet(value, schema, root):
    errors = []
    validate(value, schema, root, "", errors, [])
    return errors


# ---- pack checks ----

def walk(node, path=""):
    """Yield (path, key, value) for every key in nested dicts and lists."""
    if isinstance(node, dict):
        for key, value in node.items():
            here = f"{path}.{key}" if path else key
            yield here, key, value
            yield from walk(value, here)
    elif isinstance(node, list):
        for i, value in enumerate(node):
            label = value.get("id") if isinstance(value, dict) and isinstance(value.get("id"), str) else i
            yield from walk(value, f"{path}[{label}]")


def as_list(value):
    return value if isinstance(value, list) else [value]


def check(pack, others=(), plan=None):
    report = {"errors": [], "warnings": [], "offSpec": [], "needsOtherPack": [], "possibleLeaks": [],
              "counts": {}, "plan": {}, "mapKeys": {}}
    errors, warnings = report["errors"], report["warnings"]

    with open(SCHEMA, encoding="utf-8") as handle:
        schema = json.load(handle)
    validate(pack, schema, schema, "pack", errors, report["offSpec"])

    meta = pack.get("meta", {}) if isinstance(pack.get("meta"), dict) else {}
    code = meta.get("code")
    if pack.get("formatVersion") != 3:
        warnings.append("formatVersion should be 3 for an adventure pack")
    if meta.get("kind") != "adventure":
        warnings.append('meta.kind should be "adventure"')
    if not code:
        errors.append("meta.code is missing (2-6 lowercase letters)")

    ids = defaultdict(set)
    for kind in KINDS:
        entries = pack.get(kind, [])
        if not isinstance(entries, list):
            continue
        report["counts"][kind] = len(entries)
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
                continue
            entry_id = entry["id"]
            if entry_id in ids[kind]:
                errors.append(f"{kind}: {entry_id} appears twice")
            ids[kind].add(entry_id)
            if code and not entry_id.startswith(code + "-"):
                errors.append(f"{kind}: {entry_id} doesn't start with {code}-")
            if not entry.get("source"):
                warnings.append(f"{kind}: {entry_id} has no page reference (source)")

    for path, key, value in walk(pack):
        if key in LINKS and not path.startswith("meta"):
            for target in as_list(value):
                if target is not None and not any(target in ids[k] for k in LINKS[key]):
                    errors.append(f"{path}: {target} isn't in this pack ({' or '.join(LINKS[key])})")
    for route in pack.get("routes", []):
        for end in ("from", "to"):
            if route.get(end) not in ids["locations"]:
                errors.append(f"routes[{route.get('id')}].{end}: {route.get(end)} isn't a location")

    check_refs(pack, meta, others, report)
    check_images(pack, report)

    check_rulings(pack, others, report)

    report["possibleLeaks"] = leaks(pack)
    if plan:
        report["plan"] = compare_plan(plan, ids)
    for location in pack.get("locations", []):
        if location.get("mapId") and location.get("key"):
            report["mapKeys"].setdefault(location["mapId"], []).append(location["key"])
    for keys in report["mapKeys"].values():
        keys.sort(key=lambda k: (len(k), k))
    return report


def check_refs(pack, meta, others, report):
    known = {o.get("meta", {}).get("id"): o for o in others}
    required = {r.get("packId") for r in meta.get("requires", []) if isinstance(r, dict)}
    for path, key, value in walk(pack):
        if key not in REFS:
            continue
        for ref in as_list(value):
            if ref is None:  # a pre-made with no class (a retainer) leaves classRef null
                continue
            if not isinstance(ref, str) or ":" not in ref:
                report["errors"].append(f"{path}: {ref} should look like <pack id>:<id>")
                continue
            pack_id, entry_id = ref.split(":", 1)
            if pack_id not in required:
                report["warnings"].append(f"{path}: {pack_id} isn't in meta.requires")
            other = known.get(pack_id)
            if other is None:
                report["needsOtherPack"].append(f"{path}: {ref}")
            elif not any(isinstance(e, dict) and e.get("id") == entry_id
                         for kind in KINDS for e in other.get(kind, []) if isinstance(other.get(kind), list)):
                report["errors"].append(f"{path}: {entry_id} isn't in {pack_id}")


def coin_keys(others):
    """Coin keys the setting packs define (rulesSets[].currency), or None when none are given."""
    keys = {c.get("key") for o in others for r in o.get("rulesSets", []) if isinstance(r, dict)
            for c in r.get("currency", []) if isinstance(c, dict)}
    return keys or None


def check_rulings(pack, others, report):
    errors, warnings = report["errors"], report["warnings"]
    coins = coin_keys(others)

    def check_coins(path, value):
        if coins and isinstance(value, dict):
            for key in value:
                if key not in coins:
                    warnings.append(f"{path}: coin {key} isn't defined by the setting (shown as written)")

    # a settlement's size is one of the setting's sizes (G-157)
    sizes = {x.get("size") for o in others for r in o.get("rulesSets", []) if isinstance(r, dict)
             for x in ((r.get("settlement") or {}).get("availability") or {}).get("bySize", []) if isinstance(x, dict)}
    for loc in pack.get("locations", []):
        st = loc.get("settlement")
        if isinstance(st, dict) and sizes and st.get("size") not in sizes:
            errors.append(f"locations[{loc.get('id')}].settlement.size: {st.get('size')} isn't one of the setting's sizes ({', '.join(sorted(sizes))})")

    # an encounter check names its table one way: tableId (this pack) or tableRef (another pack), never both (G-154)
    for loc in pack.get("locations", []):
        ec = loc.get("encounterCheck")
        if isinstance(ec, dict) and ec.get("tableId") and ec.get("tableRef"):
            errors.append(f"locations[{loc.get('id')}].encounterCheck: has both tableId and tableRef (one or the other)")

    # e. Treasure value in whole coins; valueGp is converted at import.
    for loc in pack.get("locations", []):
        for i, item in enumerate(loc.get("treasure", []) or []):
            path = f"locations[{loc.get('id')}].treasure[{i}]"
            if "valueGp" in item and "value" in item:
                errors.append(f"{path}: has both value and valueGp (use value)")
            elif "valueGp" in item and item["valueGp"] is not None:
                warnings.append(f"{path}: valueGp is converted to value {{\"gp\": n}} at import; write value")
            check_coins(f"{path}.value", item.get("value"))
    for shop in pack.get("shops", []):
        for i, line in enumerate((shop.get("stock") or []) + (shop.get("services") or [])):
            check_coins(f"shops[{shop.get('id')}] line {i + 1} price", line.get("price"))

    # f. Player-safe looks and table descriptions are text (ruled 2026-11-01, M5 gate B1 and B2).
    for loc in pack.get("locations", []):
        for kind in ("contents", "hazards"):
            for i, entry in enumerate(loc.get(kind, []) or []):
                if "appearance" in entry and not isinstance(entry["appearance"], str):
                    warnings.append(f"locations[{loc.get('id')}].{kind}[{i}].appearance: isn't text")
    for table in pack.get("tables", []):
        if "description" in table and not isinstance(table["description"], str):
            warnings.append(f"tables[{table.get('id')}].description: isn't text")
        for i, row in enumerate(table.get("rows", []) or []):
            if isinstance(row, dict) and "note" in row and not isinstance(row["note"], str):
                warnings.append(f"tables[{table.get('id')}].rows[{i}].note: isn't text")

    # b. Rumour truth is a string; plain true/false is converted at import.
    for table in pack.get("tables", []):
        for i, row in enumerate(table.get("rows", []) or []):
            if isinstance(row, dict) and isinstance(row.get("truth"), bool):
                warnings.append(f"tables[{table.get('id')}].rows[{i}].truth: write \"{str(row['truth']).lower()}\" "
                                "(a plain true/false is converted at import)")

    # a. Roster entries: npcId or an inline name, never both; note goes with name.
    for track in pack.get("tracks", []):
        roster = track.get("roster") or {}
        for entry in roster.get("entries", []) or []:
            path = f"tracks[{track.get('id')}].roster.entries[{entry.get('key')}]"
            has_npc, has_name = bool(entry.get("npcId")), bool(entry.get("name"))
            if has_npc and has_name:
                errors.append(f"{path}: has both npcId and name (use one)")
            elif not has_npc and not has_name:
                errors.append(f"{path}: needs npcId or name")
            elif has_npc and entry.get("note"):
                warnings.append(f"{path}: note goes with an inline name; an NPC keeps its notes on the NPC")

    # d. Adventure mechanics: one switch each, no ruleKey.
    options = {o.get("id"): o for o in pack.get("options", []) if isinstance(o, dict)}
    for option in options.values():
        if option.get("ruleKey") == "adventure-mechanics" or (
                option.get("category") == "Adventure mechanics" and option.get("ruleKey")):
            errors.append(f"options[{option.get('id')}]: adventure mechanics carry no ruleKey "
                          "(a shared ruleKey makes one choice for all of them)")

    # c. option links name a real switch, and a real choice ("id" means its "on" choice).
    linked = set()
    places = [(f"tracks[{t.get('id')}]", t) for t in pack.get("tracks", [])]
    places += [(f"timeline[{b.get('id')}]", b) for b in pack.get("timeline", [])]
    places += [(f"tables[{t.get('id')}]", t) for t in pack.get("tables", [])]
    places += [(f"locations[{loc.get('id')}].encounterCheck", loc.get("encounterCheck"))
               for loc in pack.get("locations", [])]
    for path, entry in places:
        if not isinstance(entry, dict) or not isinstance(entry.get("option"), str):
            continue
        option_id, _, choice = entry["option"].partition("=")
        option = options.get(option_id)
        if option is None:
            errors.append(f"{path}.option: {option_id} isn't an optional rule in this pack")
            continue
        linked.add(option_id)
        choices = {c.get("id") for c in option.get("choices", []) if isinstance(c, dict)}
        wanted = choice or "on"
        if wanted not in choices:
            errors.append(f"{path}.option: {option_id} has no choice {wanted}"
                          + ("" if choice else ' (a bare id means live when the choice is "on")'))
    for track in pack.get("tracks", []):
        if not track.get("option"):
            warnings.append(f"tracks[{track.get('id')}]: no option links it to its switch (07 §14)")
    if pack.get("timeline") and not any(b.get("option") for b in pack.get("timeline", [])):
        warnings.append("timeline: no beat has an option linking the reminders to a switch (07 §14)")
    for option in options.values():
        if option.get("category") == "Adventure mechanics" and option.get("id") not in linked:
            warnings.append(f"options[{option.get('id')}]: an adventure mechanic nothing links to (option)")


def check_images(pack, report):
    images = {i.get("id"): i for i in pack.get("images", []) if isinstance(i, dict)}
    for image in images.values():
        if image.get("type") == "crop" and image.get("visibility") != "gm":
            report["errors"].append(f"images[{image.get('id')}]: crops are always gm")
        if not str(image.get("alt", "")).strip():
            report["errors"].append(f"images[{image.get('id')}]: alt text is required")
    for location in pack.get("locations", []):
        for item in location.get("readAloud", []):
            image = images.get(item.get("imageId"))
            if image and image.get("type") != "crop":
                report["errors"].append(f"locations[{location.get('id')}].readAloud: {item['imageId']} isn't a crop")


def leaks(pack, n=4):
    found = []
    npc_names = []
    for npc in pack.get("npcs", []):
        name = str(npc.get("name", ""))
        npc_names.append(name)
        first = name.split()[0] if name.split() else ""
        if len(first) >= 4:
            npc_names.append(first)
    locations = {loc.get("id"): loc for loc in pack.get("locations", [])}
    hidden_ends = defaultdict(list)
    for route in pack.get("routes", []):
        if route.get("hidden"):
            for here, there in ((route.get("from"), route.get("to")), (route.get("to"), route.get("from"))):
                if there in locations:
                    hidden_ends[here].append(str(locations[there].get("name", "")))
    for loc_id, loc in locations.items():
        view = loc.get("playerView") or {}
        # an exit is a string or {text, to} (07 allows both); only its text is shown to players
        exit_texts = [e if isinstance(e, str) else str((e or {}).get("text") or "") for e in view.get("exits", [])]
        shown = [view.get("name") or "", view.get("text") or ""] + exit_texts
        shown += [p.get("description", "") for p in view.get("people", [])]
        shown = [s for s in shown if s]
        joined = " ".join(shown).casefold()
        for name in npc_names:
            if name and re.search(r"\b" + re.escape(name.casefold()) + r"\b", joined):
                found.append(f"locations[{loc_id}].playerView names NPC '{name}'")
        for far in hidden_ends.get(loc_id, []):
            if far and far.casefold() in " ".join(exit_texts).casefold():
                found.append(f"locations[{loc_id}].playerView.exits names '{far}', the end of a hidden route")
        gm = loc.get("gm") or {}
        hidden = [gm.get("notes") or ""] + list(gm.get("secrets", [])) + [c.get("text", "") for c in loc.get("clues", [])]
        index = build_index([("gm", text) for text in hidden if text], n)
        for text in shown:
            for run in find_runs(text, index, n):
                found.append(f"locations[{loc_id}].playerView shares '{run['text']}' with its GM notes, secrets or clues")
    return found


def compare_plan(plan, ids):
    planned = Counter(e.get("kind") for e in plan.get("entries", []))
    planned_ids = {(e.get("kind"), e.get("id")) for e in plan.get("entries", [])}
    present = {(kind, i) for kind, values in ids.items() for i in values}
    return {"planned": dict(planned), "present": {k: len(v) for k, v in ids.items() if v},
            "missing": sorted(f"{k}: {i}" for k, i in planned_ids - present),
            "notInPlan": sorted(f"{k}: {i}" for k, i in present - planned_ids)}


def main():
    parser = argparse.ArgumentParser(description="Check an adventure pack (format v3).")
    parser.add_argument("pack")
    parser.add_argument("--id-plan")
    parser.add_argument("--other-pack", action="append", default=[])
    parser.add_argument("--spot", type=int, default=0, help="pick N random locations for spot checks")
    parser.add_argument("--out")
    args = parser.parse_args()

    def load(path):
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)

    pack = load(args.pack)
    report = check(pack, [load(p) for p in args.other_pack], load(args.id_plan) if args.id_plan else None)
    if args.spot:
        locations = [loc.get("id") for loc in pack.get("locations", [])]
        report["spotChecks"] = random.sample(locations, min(args.spot, len(locations)))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False)

    for section in ("errors", "warnings", "offSpec", "needsOtherPack", "possibleLeaks"):
        print(f"{section}: {len(report[section])}")
        for line in report[section]:
            print(f"  - {line}")
    print("counts:", json.dumps(report["counts"]))
    if report["plan"]:
        print("against the ID plan:", json.dumps({k: report["plan"][k] for k in ("missing", "notInPlan")}, indent=2))
    for map_id, keys in report["mapKeys"].items():
        print(f"map {map_id} has locations keyed: {', '.join(keys)}")
    if report.get("spotChecks"):
        print("spot checks:", ", ".join(report["spotChecks"]))
    sys.exit(1 if report["errors"] else 0)


if __name__ == "__main__":
    main()
