"""Tests for the copying check and the adventure checker, on invented text only.
No PyMuPDF needed.

Run from the repo root:
  py -m unittest discover -s skills/content-pack-converter/scripts/tests
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from check_adventure import check  # noqa: E402
from copy_check import check as copy_check, words  # noqa: E402

BOOK = [
    ("p. 30", "The bog lurker waits beneath the still black water of the old mill pond, "
              "and it rises only when a lantern is carried across the plank bridge."),
    ("p. 31", "Lantern Wardens keep the ford. Their oath is short and spoken at dusk."),
]


def adventure(**parts):
    pack = {"format": "tabletop-pack", "formatVersion": 3,
            "meta": {"name": "Mire ford", "id": "mire-ford", "kind": "adventure", "code": "mf",
                     "requires": [{"packId": "river-rules", "minVersion": "1.0"}]}}
    pack.update(parts)
    return pack


def room(**fields):
    base = {"id": "mf-abbey-14", "name": "Chapter house", "key": "14", "source": "p. 31",
            "playerView": {"name": "Flooded hall", "text": "A low hall, knee-deep in water.", "exits": ["Stairs up"]}}
    base.update(fields)
    return base


class CopyCheck(unittest.TestCase):
    def test_flags_a_run_of_eight_words_copied_from_the_book(self):
        # A note that copies eight words in a row from the book is flagged with its page.
        pack = {"statBlocks": [{"id": "mf-bog-lurker", "name": "Bog lurker",
                                "notes": "It waits beneath the still black water of the old pond."}]}
        findings = copy_check(pack, BOOK, 8)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["page"], "p. 30")
        self.assertEqual(findings[0]["path"], "statBlocks[mf-bog-lurker].notes")

    def test_seven_words_are_not_flagged(self):
        # Seven matching words in a row stay under the limit.
        pack = {"items": [{"id": "mf-lamp", "notes": "beneath the still black water of the, then dry land"}]}
        self.assertEqual(copy_check(pack, BOOK, 8), [])

    def test_the_default_limit_is_eight_words_like_the_app(self):
        # Without a limit given, the check flags at 8 words in a row (the app's limit), not 9.
        eight = {"items": [{"id": "mf-a", "notes": "beneath the still black water of the old, then dry"}]}
        seven = {"items": [{"id": "mf-b", "notes": "beneath the still black water of the, then dry land"}]}
        self.assertEqual(len(copy_check(eight, BOOK)), 1)
        self.assertEqual(copy_check(seven, BOOK), [])

    def test_quotes_and_names_are_not_checked(self):
        # Ruled quotes and names may match the book word for word.
        line = "Lantern Wardens keep the ford. Their oath is short and spoken at dusk."
        pack = {"locations": [{"id": "mf-ford", "name": line,
                               "quotes": [{"text": line, "kind": "spoken", "source": "p. 31"}]}]}
        self.assertEqual(copy_check(pack, BOOK, 8), [])

    def test_stat_lines_and_treasure_amounts_are_mechanics_not_copying(self):
        # Mechanics are kept in full: a stat line or a hoard amount may match the book.
        line = "The bog lurker waits beneath the still black water of the old mill pond"
        pack = {"statBlocks": [{"id": "mf-bog-lurker", "fields": {"Attacks": line}}],
                "treasureTypes": [{"id": "mf-hoard", "entries": [{"chance": 25, "amount": line}]}]}
        self.assertEqual(copy_check(pack, BOOK, 8), [])
        # The same words in a note are flagged.
        pack["statBlocks"][0]["notes"] = line
        self.assertEqual(len(copy_check(pack, BOOK, 8)), 1)

    def test_case_punctuation_and_line_break_hyphens_are_ignored(self):
        # Copying is still caught when only case, punctuation or a hyphenated line break differ.
        self.assertEqual(words("Lan-\ntern WARDENS, keep... the ford!"), ["lantern", "wardens", "keep", "the", "ford"])
        pack = {"tables": [{"id": "mf-oath", "notes": "LANTERN wardens keep the ford; their oath is short!"}]}
        self.assertEqual(len(copy_check(pack, BOOK, 8)), 1)

    def test_one_long_copy_is_reported_once(self):
        # Overlapping matches merge into one finding with the full length.
        pack = {"items": [{"id": "mf-x", "notes": BOOK[0][1]}]}
        findings = copy_check(pack, BOOK, 8)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["words"], len(words(BOOK[0][1])))


class AdventureCheck(unittest.TestCase):
    def test_exits_written_as_text_and_to_are_read_for_leaks(self):
        pack = adventure(locations=[room(id="mf-1", name="Mill", playerView={"name": "Mill", "exits": [{"text": "A plank bridge", "to": "mf-2"}]}),
                                    room(id="mf-2", name="Pond", playerView={"name": "Pond"})])
        check(pack)  # must not crash on an exit object

    def test_a_clean_small_pack_has_no_errors(self):
        # A minimal invented adventure with linked entries passes.
        pack = adventure(
            locations=[room(contents=[{"statBlockId": "mf-bog-lurker", "count": "1"}])],
            statBlocks=[{"id": "mf-bog-lurker", "name": "Bog lurker", "source": "p. 30"}],
            images=[{"id": "mf-crop-031-a", "file": "crops/mf-crop-031-a.webp", "type": "crop",
                     "alt": "Boxed text for the flooded hall", "visibility": "gm", "source": "p. 31"}])
        pack["locations"][0]["readAloud"] = [{"imageId": "mf-crop-031-a", "source": "p. 31"}]
        report = check(pack)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["offSpec"], [])

    def test_ids_without_the_code_and_broken_links_are_errors(self):
        # An id missing the pack code and a link to a missing stat block are both caught.
        pack = adventure(locations=[room(id="abbey-14", contents=[{"statBlockId": "mf-nothing"}])])
        errors = " ".join(check(pack)["errors"])
        self.assertIn("doesn't start with mf-", errors)
        self.assertIn("mf-nothing isn't in this pack", errors)

    def test_revealable_crops_and_missing_alt_text_are_errors(self):
        # Crops must stay GM only and every image needs alt text.
        pack = adventure(images=[{"id": "mf-crop-1", "file": "crops/a.webp", "type": "crop",
                                  "alt": "", "visibility": "revealable", "source": "p. 2"}])
        errors = " ".join(check(pack)["errors"])
        self.assertIn("crops are always gm", errors)
        self.assertIn("alt text is required", errors)

    def test_unknown_fields_are_listed_as_off_spec(self):
        # A field 07 doesn't define is listed, not dropped or kept silently.
        pack = adventure(locations=[room(smell="peat")])
        self.assertIn("pack.locations[mf-abbey-14].smell", check(pack)["offSpec"])

    def test_cross_pack_references_need_the_other_pack(self):
        # A reference to another pack is listed until that pack is given.
        pack = adventure(premades=[{"id": "mf-pre-hild", "name": "Hild", "source": "p. 78",
                                    "classRef": "river-rules:lantern-warden"}])
        self.assertEqual(len(check(pack)["needsOtherPack"]), 1)
        other = {"meta": {"id": "river-rules"}, "classes": [{"id": "lantern-warden"}]}
        report = check(pack, [other])
        self.assertEqual(report["needsOtherPack"], [])
        self.assertEqual(report["errors"], [])

    def test_player_view_naming_an_npc_is_a_possible_leak(self):
        # Players must not learn a person's name from the room description.
        pack = adventure(
            locations=[room(playerView={"text": "Oswy sits by the water.", "people": [{"description": "Oswy"}]})],
            npcs=[{"id": "mf-npc-oswy", "name": "Oswy the reed-cutter", "source": "p. 30"}])
        self.assertTrue(any("Oswy" in line for line in check(pack)["possibleLeaks"]))


ONOFF = [{"id": "on", "name": "On"}, {"id": "off", "name": "Off"}]


def flood(**fields):
    track = {"id": "mf-flood", "name": "The flood", "start": 12, "source": "p. 8", "option": "mf-opt-flood"}
    track.update(fields)
    return track


def switch(**fields):
    option = {"id": "mf-opt-flood", "name": "The flood track", "default": "on", "choices": ONOFF,
              "category": "Adventure mechanics", "source": "p. 8"}
    option.update(fields)
    return option


class Rulings(unittest.TestCase):
    """The follow-up rulings of 2026-10-24 (07: treasure, rumours, rosters, switches)."""

    def test_treasure_value_is_whole_coins_and_old_value_gp_is_a_warning(self):
        # value holds whole coins; a fraction is an error; valueGp is converted, so only warned about.
        setting = {"meta": {"id": "river-rules"}, "rulesSets": [{"id": "rs", "currency": [{"key": "gp"}, {"key": "cp"}]}]}
        good = adventure(locations=[room(treasure=[{"text": "Seven coppers", "value": {"cp": 7}}])])
        self.assertEqual(check(good, [setting])["errors"], [])
        bad = adventure(locations=[room(treasure=[{"text": "Coins", "value": {"cp": 0.5}}])])
        self.assertTrue(check(bad)["errors"])
        old = adventure(locations=[room(treasure=[{"text": "Seal", "valueGp": 40}])])
        report = check(old)
        self.assertEqual(report["errors"], [])
        self.assertTrue(any("valueGp" in w for w in report["warnings"]))
        odd = adventure(locations=[room(treasure=[{"text": "Shells", "value": {"shell": 3}}])])
        self.assertTrue(any("coin shell" in w for w in check(odd, [setting])["warnings"]))

    def test_an_encounter_check_names_a_table_in_another_pack_with_table_ref(self):
        # tableRef resolves in the required pack; a missing table is an error; tableId and tableRef together are an error.
        setting = {"meta": {"id": "river-rules"}, "tables": [{"id": "rr-fen-encounters", "rows": []}]}
        check_ = {"every": {"value": 1, "unit": "day"}, "chance": {"die": "d6", "on": [1, 2]},
                  "tableRef": "river-rules:rr-fen-encounters"}
        self.assertEqual(check(adventure(locations=[room(encounterCheck=check_)]), [setting])["errors"], [])
        missing = dict(check_, tableRef="river-rules:rr-nowhere")
        self.assertTrue(check(adventure(locations=[room(encounterCheck=missing)]), [setting])["errors"])
        both = dict(check_, tableId="mf-abbey-encounters")
        self.assertTrue(any("both tableId and tableRef" in e for e in check(adventure(locations=[room(encounterCheck=both)]), [setting])["errors"]))

    def test_a_route_may_be_a_track(self):
        # 07 rules routes as "road" | "track": a track between two places is valid, an unknown type is not.
        setting = {"meta": {"id": "river-rules"}}
        rooms = [room(), room(id="mf-abbey-15", key="15")]
        track = {"id": "mf-reed-trail", "from": "mf-abbey-14", "to": "mf-abbey-15", "type": "track",
                 "travel": {"value": 3, "unit": "hour"}}
        self.assertEqual(check(adventure(locations=rooms, routes=[track]), [setting])["errors"], [])
        odd = dict(track, type="causeway")
        errors = check(adventure(locations=rooms, routes=[odd]), [setting])["errors"]
        self.assertEqual(len(errors), 1)
        self.assertIn('routes[mf-reed-trail].type: "causeway"', errors[0])

    def test_a_place_may_carry_terrain_and_two_road_flags(self):
        # Purpose: 07 lets a place carry a terrain id (text) and say it is hidden until searched or seen from the road
        # (true or false); the checker accepts those and names a value of the wrong kind.
        setting = {"meta": {"id": "river-rules"}}
        good = room(terrain="fen", hiddenUntilSearched=True, seenFromRoad=False)
        self.assertEqual(check(adventure(locations=[good]), [setting])["errors"], [])
        for field, wrong, kind in (("terrain", 3, "string"), ("hiddenUntilSearched", "yes", "boolean"),
                                   ("seenFromRoad", 1, "boolean")):
            errors = check(adventure(locations=[room(**{field: wrong})]), [setting])["errors"]
            self.assertEqual(errors, [f"pack.locations[mf-abbey-14].{field}: should be {kind}"])

    def test_a_road_distance_is_accepted_as_written(self):
        # Purpose: 07 gives a road's or track's `distance` no shape yet, so the checker accepts it as written (a
        # figure with a unit or words) and reports nothing; when 07 sets a shape, this test changes with it.
        setting = {"meta": {"id": "river-rules"}}
        rooms = [room(), room(id="mf-abbey-15", key="15")]
        road = {"id": "mf-causey", "from": "mf-abbey-14", "to": "mf-abbey-15", "type": "road"}
        for distance in ({"value": 6, "unit": "mile"}, "six miles"):
            self.assertEqual(check(adventure(locations=rooms, routes=[dict(road, distance=distance)]), [setting])["errors"], [])

    def test_a_settlement_size_is_one_of_the_settings_sizes(self):
        setting = {"meta": {"id": "river-rules"}, "rulesSets": [{"id": "rs", "settlement": {"availability": {
            "bySize": [{"size": "Village", "chance": 0}, {"size": "Town", "chance": 100}]}}}]}
        good = adventure(locations=[room(settlement={"size": "Village", "population": 120})])
        self.assertEqual(check(good, [setting])["errors"], [])
        bad = adventure(locations=[room(settlement={"size": "Hamlet"})])
        self.assertTrue(any("isn't one of the setting's sizes" in e for e in check(bad, [setting])["errors"]))

    def test_rumour_truth_is_a_string_and_plain_booleans_are_warned_about(self):
        # "true", "false" and "partial" pass; a plain true is converted at import, so it's a warning.
        rows = [{"text": "A", "truth": "true"}, {"text": "B", "truth": "partial"}, {"text": "C", "truth": True}]
        report = check(adventure(tables=[{"id": "mf-rumours", "kind": "rumours", "rows": rows, "source": "p. 5"}]))
        self.assertEqual(report["errors"], [])
        self.assertEqual(sum("truth" in w for w in report["warnings"]), 1)
        report = check(adventure(tables=[{"id": "mf-rumours", "kind": "rumours", "source": "p. 5",
                                          "rows": [{"text": "D", "truth": "maybe"}]}]))
        self.assertTrue(report["errors"])

    def test_roster_entries_have_an_npc_or_a_name_never_both(self):
        # An inline name (with a note) is fine; both or neither is an error.
        npcs = [{"id": "mf-npc-ansel", "name": "Ansel", "source": "p. 8"}]
        entries = [{"key": "11", "npcId": "mf-npc-ansel"}, {"key": "12", "name": "Novice Edda", "note": "Afraid of water"}]
        pack = adventure(npcs=npcs, options=[switch()], tracks=[flood(roster={"entries": entries})])
        self.assertEqual(check(pack)["errors"], [])
        entries = [{"key": "13", "npcId": "mf-npc-ansel", "name": "Ansel"}, {"key": "14"}]
        pack = adventure(npcs=npcs, options=[switch()], tracks=[flood(roster={"entries": entries})])
        self.assertEqual(len(check(pack)["errors"]), 2)

    def test_adventure_mechanics_carry_no_rule_key(self):
        # A shared ruleKey would make one choice for every mechanic, so it's an error.
        pack = adventure(options=[switch(ruleKey="adventure-mechanics")], tracks=[flood()])
        self.assertTrue(any("ruleKey" in e for e in check(pack)["errors"]))
        self.assertEqual(check(adventure(options=[switch()], tracks=[flood()]))["errors"], [])

    def test_option_links_name_a_real_switch_and_choice(self):
        # "id" needs an "on" choice; "id=choice" needs that choice; an unknown switch is an error.
        two = switch(choices=[{"id": "fast", "name": "Fast"}, {"id": "slow", "name": "Slow"}])
        self.assertTrue(check(adventure(options=[two], tracks=[flood()]))["errors"])
        self.assertEqual(check(adventure(options=[two], tracks=[flood(option="mf-opt-flood=slow")]))["errors"], [])
        self.assertTrue(check(adventure(options=[two], tracks=[flood(option="mf-opt-flood=never")]))["errors"])
        self.assertTrue(check(adventure(options=[switch()], tracks=[flood(option="mf-opt-tide")]))["errors"])
        beat = {"id": "mf-beat-day3", "day": 3, "gm": "The toll rises.", "source": "p. 9", "option": "mf-opt-flood"}
        self.assertEqual(check(adventure(options=[switch()], tracks=[flood()], timeline=[beat]))["errors"], [])

    def test_a_track_without_a_switch_is_a_warning(self):
        # Each mechanic should have its switch (07 §14).
        track = flood()
        del track["option"]
        report = check(adventure(tracks=[track]))
        self.assertTrue(any("no option" in w for w in report["warnings"]))


if __name__ == "__main__":
    unittest.main()
