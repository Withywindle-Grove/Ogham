"""Tests for the scorecard scripts (book_units, map_units, score, triage_list), on invented text only.

Run from the repo root:
  py -E -m unittest discover -s skills/content-pack-converter/scripts/tests
"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import book_units as bu  # noqa: E402
import map_units as mu  # noqa: E402
import score  # noqa: E402
from triage_list import propose  # noqa: E402

# ----------------------------------------------------------------------------------------------- a synthetic page
# A two-column page (width 420) laid out like a rules book: a section title, a sub-heading, a label line, body
# text wrapped over two lines, a bulleted item, a small table under its own bold title, and a page number.

BODY = {"font": "Serif-Regular", "size": 10.0, "flags": 4}
BOLD = {"font": "Serif-Bold", "size": 10.0, "flags": 20}
SUB = {"font": "Sans-Bold", "size": 14.0, "flags": 20}
H4 = {"font": "Sans-Bold", "size": 12.0, "flags": 20}
TITLE = {"font": "Display", "size": 34.0, "flags": 4}
SMALL = {"font": "Serif-Semibold", "size": 8.8, "flags": 20}


def span(text, x0, y0, x1, style):
    return {"text": text, "bbox": [x0, y0, x1, y0 + 13], **style}


def line(*spans):
    return {"bbox": [min(s["bbox"][0] for s in spans), min(s["bbox"][1] for s in spans),
                     max(s["bbox"][2] for s in spans), max(s["bbox"][3] for s in spans)], "spans": list(spans)}


def synthetic_page():
    lines = [
        line(span("7", 12, 575, 20, SMALL)),                                  # page number: running
        line(span("Lantern Warden", 24, 18, 160, TITLE)),                     # section (level 2)
        line(span("Ward Light", 27, 60, 90, SUB)),                            # sub-heading (level 3)
        line(span("Duration:", 24, 80, 70, BOLD), span(" Until dawn.", 70, 80, 130, BODY)),
        line(span("The warden may kindle a ward light once per", 24, 95, 188, BODY)),
        line(span("day. Bog lurkers fear it and flee on sight.", 24, 107, 170, BODY)),
        line(span("▶", 24, 125, 30, BODY), span("Oath: A warden who breaks the oath loses the", 32, 125, 190, BODY)),
        line(span("light for a moon.", 32, 137, 95, BODY)),
        line(span("Ward Costs", 27, 160, 80, H4)),                            # table title
        line(span("Light", 27, 175, 50, H4)), line(span("Cost", 120, 175, 140, H4)), line(span("Weight", 160, 175, 190, H4)),
        line(span("Ward light", 27, 190, 70, BODY)), line(span("10", 125, 190, 135, BODY)), line(span("5", 170, 190, 175, BODY)),
        line(span("Moon lamp", 27, 203, 70, BODY)), line(span("4,000", 118, 203, 140, BODY)), line(span("–", 170, 203, 175, BODY)),
        # the right column continues the text
        line(span("Bog Lurker", 214, 18, 300, SUB)),
        line(span("AC ", 211, 40, 225, BOLD), span("5 [14], ", 225, 40, 260, BODY), span("HD ", 260, 40, 275, BOLD),
             span("3+1 (14hp), ", 275, 40, 330, BODY), span("ML ", 330, 40, 345, BOLD), span("9, ", 345, 40, 355, BODY),
             span("XP ", 355, 40, 370, BOLD), span("50", 370, 40, 380, BODY)),
        line(span("Lurkers hide in the mud and are im-", 211, 60, 375, BODY)),
        line(span("mune to fear.", 211, 72, 270, BODY)),
    ]
    return [(9, 420.0, 595.0, lines)]


class JoiningLines(unittest.TestCase):
    vocab = {"immune", "warden", "half", "elf", "sized", "human"}

    def test_a_hyphenated_word_is_joined_when_the_book_has_it_whole(self):
        self.assertEqual(bu.join_lines(["lurkers are im-", "mune to fear"], self.vocab), "lurkers are immune to fear")

    def test_a_compound_of_two_real_words_keeps_its_hyphen(self):
        self.assertEqual(bu.join_lines(["a human-", "sized hole"], self.vocab), "a human-sized hole")

    def test_a_hyphen_before_a_digit_stays(self):
        self.assertEqual(bu.join_lines(["a 2-", "in-6 chance"], self.vocab), "a 2-in-6 chance")

    def test_a_rare_word_broken_by_the_typesetter_is_joined(self):
        self.assertEqual(bu.join_lines(["they ap-", "proach"], self.vocab), "they approach")

    def test_a_soft_hyphen_at_a_line_end_joins_and_one_before_a_space_is_a_space(self):
        self.assertEqual(bu.join_lines(["kin­", "dle it"], self.vocab), "kindle it")
        self.assertEqual(bu.line_text({"spans": [{"text": "from­ "}, {"text": "magic"}]}), "from magic")


class SoftHyphensInALine(unittest.TestCase):
    def test_a_soft_hyphen_and_space_inside_a_word_joins_when_the_book_has_the_word_whole(self):
        bu.VOCAB.clear()
        bu.VOCAB.update({"lanternlight"})
        try:
            self.assertEqual(bu.line_text({"spans": [{"text": "by lantern­ light alone"}]}), "by lanternlight alone")
            self.assertEqual(bu.line_text({"spans": [{"text": "from­ magic"}]}), "from magic")
            # a line-end soft hyphen printed as its own span joins the word with the next line
            first = {"spans": [{"text": "lit by lantern", "bbox": [0, 0, 60, 10]}, {"text": "­", "bbox": [60, 0, 62, 10]}]}
            self.assertEqual(bu.join_lines([bu.line_text(first), "light alone"], {"lanternlight"}), "lit by lanternlight alone")
        finally:
            bu.VOCAB.clear()


class ParagraphEnds(unittest.TestCase):
    def test_a_line_well_short_of_the_edge_ends_the_paragraph(self):
        self.assertTrue(bu.ends_paragraph("flee on sight.", 120, 190, 180, "The next"))

    def test_a_full_line_continues(self):
        self.assertFalse(bu.ends_paragraph("once per", 188, 190, 180, "day."))

    def test_a_slightly_short_line_ending_a_sentence_before_a_capital_ends_it(self):
        self.assertTrue(bu.ends_paragraph("flee on sight.", 172, 190, 180, "Bog lurkers"))
        self.assertFalse(bu.ends_paragraph("flee on sight.", 172, 190, 180, "and hide"))

    def test_a_hyphen_never_ends_a_paragraph(self):
        self.assertFalse(bu.ends_paragraph("they are im-", 100, 190, 180, "mune"))


class Labels(unittest.TestCase):
    def test_a_bold_lead_in_with_a_colon_is_a_label(self):
        label, rest = bu.split_label(line(span("Duration:", 24, 80, 70, BOLD), span(" Until dawn.", 70, 80, 130, BODY)))
        self.assertEqual(label, "Duration:")
        self.assertEqual(rest[0]["text"], " Until dawn.")

    def test_a_line_with_several_bold_lead_ins_is_a_legend_not_a_label(self):
        label, _ = bu.split_label(line(span("D:", 24, 80, 30, BOLD), span(" Death; ", 30, 80, 60, BODY),
                                       span("W:", 60, 80, 70, BOLD), span(" Wands", 70, 80, 100, BODY)))
        self.assertIsNone(label)


class StatLines(unittest.TestCase):
    def test_inline_bold_labels_become_cells(self):
        lines = [line(span("AC ", 211, 40, 225, BOLD), span("5 [14], ", 225, 40, 260, BODY), span("HD ", 260, 40, 275, BOLD),
                      span("3+1 (14hp), ", 275, 40, 330, BODY), span("ML ", 330, 40, 345, BOLD), span("9, ", 345, 40, 355, BODY),
                      span("XP ", 355, 40, 370, BOLD), span("50", 370, 40, 380, BODY))]
        self.assertEqual(bu.stat_cells(lines), [("AC", "5 [14]"), ("HD", "3+1 (14hp)"), ("ML", "9"), ("XP", "50")])

    def test_fewer_than_four_labels_is_an_ordinary_paragraph(self):
        self.assertIsNone(bu.stat_cells([line(span("AC ", 0, 0, 10, BOLD), span("5", 10, 0, 15, BODY))]))

    def test_the_words_before_the_first_label_are_kept_as_a_lead(self):
        # "Lesser reaper: AC 5 [14], HD 3+1 ..." must not lose "Lesser reaper:" (it names what the line describes)
        lines = [line(span("Lesser reaper: ", 200, 40, 250, BODY), span("AC ", 250, 40, 262, BOLD), span("5 [14], ", 262, 40, 290, BODY),
                      span("HD ", 290, 40, 300, BOLD), span("3+1, ", 300, 40, 320, BODY), span("ML ", 320, 40, 330, BOLD),
                      span("9, ", 330, 40, 340, BODY), span("XP ", 340, 40, 350, BOLD), span("50", 350, 40, 360, BODY))]
        self.assertEqual(bu.stat_cells(lines)[0], ("", "Lesser reaper:"))


class BuildUnits(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units, cls.counts = bu.build_units(synthetic_page(), 2, "B")
        cls.by_text = {u["text"]: u for u in cls.units}

    def test_the_page_number_is_running_text_and_not_a_unit(self):
        self.assertEqual(self.counts["running"], 1)
        self.assertNotIn("7", self.by_text)

    def test_printed_page_is_pdf_page_minus_offset_and_ids_carry_the_book_letter(self):
        self.assertEqual(self.units[0]["page"], 7)
        self.assertTrue(self.units[0]["id"].startswith("B007."))

    def test_headings_build_the_path_of_the_units_under_them(self):
        u = self.by_text["Until dawn."]
        self.assertEqual(u["path"], ["Lantern Warden", "Ward Light"])
        self.assertEqual(self.by_text["Ward Light"]["level"], 3)

    def test_a_label_is_its_own_unit_and_its_value_the_next_paragraph(self):
        self.assertEqual(self.by_text["Duration:"]["kind"], "label")
        self.assertEqual(self.by_text["Until dawn."]["kind"], "para")

    def test_a_paragraph_is_joined_across_lines(self):
        self.assertIn("The warden may kindle a ward light once per day. Bog lurkers fear it and flee on sight.", self.by_text)

    def test_a_bulleted_item_is_a_list_unit_joined_with_its_second_line(self):
        u = self.by_text["Oath: A warden who breaks the oath loses the light for a moon."]
        self.assertEqual(u["kind"], "list")

    def test_a_table_is_found_from_aligned_spans_with_its_title_and_column_names(self):
        cells = [u for u in self.units if u["kind"] == "cell" and u.get("table") == "Ward Costs"]
        self.assertEqual(len(cells), 6)
        cost = next(c for c in cells if c["text"] == "4,000")
        self.assertEqual((cost["row"], cost["col"]), (2, "Cost"))
        self.assertEqual(self.by_text["Light Cost Weight"]["level"], 5)

    def test_a_stat_line_is_split_into_labelled_cells_under_its_entry(self):
        ac = next(u for u in self.units if u["kind"] == "cell" and u.get("col") == "AC")
        self.assertEqual((ac["text"], ac["table"], ac.get("stat")), ("5 [14]", "Bog Lurker", True))

    def test_a_hyphenated_word_in_the_second_column_is_joined(self):
        self.assertIn("Lurkers hide in the mud and are immune to fear.", self.by_text)


def roll_table_page():
    # A one-column roll table (width 420, so a column is 180 wide): a long result beside its roll range, a result
    # wrapped over three lines with a hyphen at the first break, and a legend under the table that is not a cell.
    lines = [
        line(span("Satchel Finds", 27, 40, 100, H4)),
        line(span("d20", 27, 55, 45, H4)), line(span("Find", 60, 55, 80, H4)),
        line(span("1–8", 27, 70, 45, BODY)), line(span("Lantern oil", 60, 70, 110, BODY)),
        line(span("9–15", 27, 83, 45, BODY)), line(span("Copper kettle that never boils dry, a gift", 60, 83, 196, BODY)),
        line(span("from the marsh folk", 60, 93.5, 150, BODY)),  # boxes overlap, as in real books
        line(span("16–20", 27, 109, 50, BODY)), line(span("Reed basket (woven by a lantern war-", 60, 109, 150, BODY)),
        line(span("den, holds two loaves, smells of", 60, 122, 180, BODY)),
        line(span("smoke)", 60, 135, 85, BODY)),
        line(span("Uses:", 27, 150, 50, BOLD), span(" Times per day. Reach: Farthest the find can be used.", 50, 150, 200, BODY)),
    ]
    return [(9, 420.0, 595.0, lines)]


DROP = {"font": "Caps", "size": 40.0, "flags": 4}


class DropCaps(unittest.TestCase):
    def test_a_drop_cap_joins_its_paragraph_and_is_not_a_heading(self):
        lines = [
            line(span("Wardens of the Fen", 27, 18, 200, SUB)),
            line(span("T", 24, 40, 60, DROP)),
            line(span("he wardens keep the lanterns lit on every", 62, 42, 190, BODY)),
            line(span("causeway through the fen at night.", 62, 54, 170, BODY)),
            line(span("A", 24, 90, 60, DROP)),
            line(span("lantern left dark invites the bog lurkers.", 62, 92, 190, BODY)),
        ]
        units, _ = bu.build_units([(9, 420.0, 595.0, lines)], 2, "B")
        texts = [u["text"] for u in units]
        self.assertIn("The wardens keep the lanterns lit on every causeway through the fen at night.", texts)
        self.assertIn("A lantern left dark invites the bog lurkers.", texts)
        self.assertFalse(any(u["kind"] == "heading" and u["text"] in ("T", "A") for u in units))


class RunningHeaders(unittest.TestCase):
    def test_a_letter_spaced_running_header_with_its_page_number_is_running_text(self):
        head = line(span("151 P a r t T w o | T h e F e n", 30, 570, 300, BODY))
        self.assertEqual(bu.classify(head, 10.0, 420.0, 595.0), "running")
        self.assertEqual(bu.classify(line(span("A lantern burns for a night.", 30, 300, 200, BODY)), 10.0, 420.0, 595.0), "body")


class ShadowLines(unittest.TestCase):
    def test_a_line_printed_twice_at_the_same_place_is_read_once(self):
        span_ = {"text": "Lanterns for the fen roads.", "font": "Serif", "size": 10.0, "flags": 4, "bbox": [30, 40, 200, 53]}
        block = {"type": 0, "lines": [{"spans": [span_]}, {"spans": [dict(span_)]}]}

        class Page:
            rect = type("R", (), {"width": 420.0, "height": 595.0})()

            def get_text(self, kind):
                return {"blocks": [block]}

        pages = bu.read_pages([Page()], [1])
        self.assertEqual([bu.line_text(l) for l in pages[0][3]], ["Lanterns for the fen roads."])


class WrappedCells(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        units, _ = bu.build_units(roll_table_page(), 2, "B")
        cls.cells = {(u["row"], u["colIndex"]): u["text"] for u in units if u["kind"] == "cell"}
        cls.texts = [u["text"] for u in units]

    def test_a_long_result_beside_its_roll_range_is_a_cell_with_its_wrapped_line(self):
        self.assertEqual(self.cells[(2, 1)], "Copper kettle that never boils dry, a gift from the marsh folk")

    def test_a_cell_wrapped_over_three_lines_keeps_every_line_and_joins_the_hyphen(self):
        self.assertEqual(self.cells[(3, 1)], "Reed basket (woven by a lantern warden, holds two loaves, smells of smoke)")

    def test_a_legend_under_the_table_is_not_a_wrapped_cell(self):
        self.assertEqual(self.cells[(3, 0)], "16–20")
        self.assertTrue(any(t.startswith("Times per day.") for t in self.texts))


# ----------------------------------------------------------------------------------------------- mapping

PACK = {
    "classes": [{"id": "lantern-warden", "name": "Lantern Warden", "blurb": "A keeper of lights.",
                 "requirements": {"CON": 9}, "languages": ["Alignment", "Common"],
                 "abilities": [{"name": "Ward light", "duration": "Until dawn",
                                "notes": "The warden may kindle a ward light once per day. Bog lurkers fear it and flee on sight."},
                               {"name": "Oath", "notes": "A warden who breaks the oath loses the light for a moon."}]}],
    "tables": [{"id": "ward-costs", "name": "Ward Costs", "rows": [{"key": "Ward light", "cost": 10, "weight": 5},
                                                                   {"key": "Moon lamp", "cost": 4000}]}],
    "statBlocks": [{"id": "bog-lurker", "name": "Bog Lurker", "fields": {"AC": "5 [14]", "HD": "3+1", "ML": 9}, "xp": 50,
                    "notes": "Lurkers hide in the mud and are immune to fear. They also sing at night."}],
    "options": [{"id": "x", "notes": "The book gives no rate here; the pack's choice."}],
}


def mapped():
    units, _ = bu.build_units(synthetic_page(), 2, "B")
    for u in units:
        u["n"] = mu.norm(u["text"])
    strings, entities, names = mu.collect_pack(PACK)
    index = mu.Index([s["n"] for s in strings])
    flow = mu.Flow(units)
    held = mu.map_reverse(strings, flow)
    mu.map_forward(units, strings, entities, names, index, held)
    return units, strings


class Normalising(unittest.TestCase):
    def test_quotes_dashes_feet_marks_and_spacing_are_evened_out(self):
        self.assertEqual(mu.norm("90’ (30’)"), "90' (30')")
        self.assertEqual(mu.norm("see Wards, p12 )."), "see wards, p12).")
        self.assertEqual(mu.norm("1 × bite"), "1 x bite")

    def test_a_space_beside_an_em_dash_is_typography(self):
        self.assertEqual(mu.norm("a Lantern of Warding —a rank 3 spell—is worth 30gp"), mu.norm("a Lantern of Warding—a rank 3 spell—is worth 30gp"))

    def test_hyphenation_and_slash_spacing_are_typography_not_wording(self):
        # the book's line-end "over-steps" and the pack's "halfway" are the same words; a chance keeps its hyphen
        self.assertEqual(mu.norm("A warden who over-steps the half-way mark"), mu.norm("A warden who oversteps the halfway mark"))
        self.assertEqual(mu.norm("a 1-in- 6 chance"), mu.norm("a 1-in-6 chance"))
        self.assertEqual(mu.norm("Dungeon entrance/ exit"), mu.norm("Dungeon entrance/exit"))

    def test_a_stat_line_reads_as_printed_in_the_flow(self):
        # "AC 5 [14], HD 3+1, ML 9, XP 50" then the next paragraph, with no comma after the last cell
        units = [{"id": "B1.1", "kind": "cell", "text": "5 [14]", "col": "AC", "stat": True},
                 {"id": "B1.2", "kind": "cell", "text": "3+1", "col": "HD", "stat": True},
                 {"id": "B1.3", "kind": "cell", "text": "50", "col": "XP", "stat": True},
                 {"id": "B1.4", "kind": "list", "text": "Oath: A warden who breaks the oath loses the light."}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        self.assertEqual(mu.Flow(units).text, "ac 5 [14], hd 3+1, xp 50 oath: a warden who breaks the oath loses the light.")

    def test_a_stitched_passage_is_placed_where_its_sentences_sit_together(self):
        # "Time:" is printed under many headings; the passage taken from one place must not read as crossing them
        units = [{"id": "B1.1", "kind": "heading", "level": 2, "text": "Poison"},
                 {"id": "B1.2", "kind": "label", "text": "Time:"},
                 {"id": "B1.3", "kind": "para", "text": "Applying a vial takes one turn."},
                 {"id": "B2.1", "kind": "heading", "level": 2, "text": "Searching"},
                 {"id": "B2.2", "kind": "para", "text": "Adventurers may search a ten foot area for secret doors."},
                 {"id": "B2.3", "kind": "label", "text": "Time:"},
                 {"id": "B2.4", "kind": "para", "text": "Searching takes one turn."},
                 {"id": "B2.5", "kind": "label", "text": "Referee rolls:"},
                 {"id": "B2.6", "kind": "para", "text": "The referee rolls for the character searching, so the player does not know."}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        s = {"path": "skills[0].notes", "rules": True, "key": "notes",
             "text": "Adventurers may search a ten foot area for secret doors. Time: Searching takes one turn. "
                     "Referee rolls: The referee rolls for the character searching, so the player does not know."}
        s["n"] = mu.norm(s["text"])
        mu.map_reverse([s], mu.Flow(units))
        self.assertEqual(s["status"], "verbatim")
        s2 = dict(s, text="Searching takes one turn. The referee rolls for the character searching, so the player does not know. Time:")
        s2["n"] = mu.norm(s2["text"])
        mu.map_reverse([s2], mu.Flow(units))
        self.assertEqual(s2["status"], "stitched")
        self.assertNotIn("crosses", s2)

    def test_a_line_ending_in_a_slash_runs_on_into_the_next_unit(self):
        # a duration printed over two lines ("Until the oath is kept /" then "Instant ( break oath )") is one value
        units = [{"id": "B1.1", "kind": "para", "text": "Until the oath is kept /"},
                 {"id": "B1.2", "kind": "para", "text": "Instant ( break oath )"}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        s = {"path": "spells[0].duration", "rules": True, "key": "duration",
             "text": "Until the oath is kept / Instant (break oath)"}
        s["n"] = mu.norm(s["text"])
        mu.map_reverse([s], mu.Flow(units))
        self.assertEqual(s["status"], "verbatim")

    def test_a_printed_duration_with_a_plural_unit_matches_a_stored_value_and_unit(self):
        pack = {"spells": [{"id": "snuff-candle", "name": "Snuff Candle", "duration": {"value": 12, "unit": "round"},
                            "notes": "Every candle in the room goes out."}]}
        units = [{"id": "B1.1", "page": 1, "kind": "para", "text": "12 rounds", "path": []}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        strings, entities, names = mu.collect_pack(pack)
        mu.map_forward(units, strings, entities, names, mu.Index([s["n"] for s in strings]), {})
        self.assertIn(units[0]["status"], ("value", "exact"))

    def test_a_printed_stat_line_is_carried_when_one_stat_block_holds_every_value(self):
        pack = {"statBlocks": [{"id": "bog-lurker", "name": "Bog Lurker",
                                "fields": {"Speed": "40", "Morale": "9", "XP": "180"}}]}
        units = [{"id": "B1.1", "page": 1, "kind": "para", "text": "Speed 40 Morale 9 XP 180", "path": []},
                 {"id": "B1.2", "page": 1, "kind": "para", "text": "Speed 40 Morale 7 XP 180", "path": []}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        strings, entities, names = mu.collect_pack(pack)
        mu.map_forward(units, strings, entities, names, mu.Index([s["n"] for s in strings]), {})
        self.assertIn(units[0]["status"], ("value", "exact"))
        self.assertNotIn(units[1]["status"], ("value", "exact"))

    def test_a_stat_line_whose_values_sit_under_the_wrong_labels_is_not_carried(self):
        # Purpose: two values swapped between labels must not pass because both numbers are somewhere in the block.
        pack = {"statBlocks": [{"id": "bog-lurker", "name": "Bog Lurker",
                                "fields": {"Speed": "30", "Morale": "25", "XP": "7"}}]}
        units = [{"id": "B1.1", "page": 1, "kind": "para", "text": "Speed 30 Morale 7 XP 25", "path": []},
                 {"id": "B1.2", "page": 1, "kind": "para", "text": "Speed 30 Morale 25 XP 7", "path": []}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        strings, entities, names = mu.collect_pack(pack)
        mu.map_forward(units, strings, entities, names, mu.Index([s["n"] for s in strings]), {})
        self.assertNotIn(units[0]["status"], ("value", "exact"))
        self.assertIn(units[1]["status"], ("value", "exact"))

    def test_cells_run_into_one_line_are_carried_when_each_piece_is_in_the_pack(self):
        pack = {"tables": [{"id": "warden-moods", "name": "Warden moods", "rows": [
            {"min": 1, "max": 1, "result": "Quiet lantern-keeper"}, {"min": 2, "max": 2, "result": "Gruff fen-walker"}]}]}
        units = [{"id": "B1.1", "page": 1, "kind": "para", "text": "Quiet lantern-keeper Gruff fen-walker", "path": []},
                 {"id": "B1.2", "page": 1, "kind": "para", "text": "Quiet lantern-keeper Merry bog-singer", "path": []}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        strings, entities, names = mu.collect_pack(pack)
        mu.map_forward(units, strings, entities, names, mu.Index([s["n"] for s in strings]), {})
        self.assertEqual(units[0]["status"], "value")
        self.assertNotEqual(units[1]["status"], "value")

    def test_a_type_line_is_carried_by_the_stat_blocks_three_fields(self):
        pack = {"statBlocks": [{"id": "bog-lurker", "name": "Bog Lurker", "description": "Lurkers hide in the mud.",
                                "fields": {"Size and type": "Large Fen-beast", "Intelligence": "Animal Intelligence",
                                           "Alignment": "Neutral"}}]}
        units = [{"id": "B1.1", "page": 1, "kind": "para", "path": [],
                  "text": "Large Fen-beast—Animal Intelligence—Neutral"},
                 {"id": "B1.2", "page": 1, "kind": "para", "path": [],
                  "text": "Lurkers hide in the mud. Large Fen-beast—Animal Intelligence—Neutral"}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        strings, entities, names = mu.collect_pack(pack)
        mu.map_forward(units, strings, entities, names, mu.Index([s["n"] for s in strings]), {})
        self.assertEqual(units[0]["status"], "value")
        self.assertEqual(units[1]["status"], "exact")

    def test_a_list_cell_naming_an_entry_and_its_reverse_is_a_value(self):
        pack = {"spells": [{"id": "mend-lantern", "name": "Mend Lantern", "reversedName": "Break Lantern",
                            "notes": "A cracked lantern is made whole."}]}
        units = [{"id": "B1.1", "page": 1, "kind": "cell", "text": "Mend Lantern (Break Lantern)", "table": "Spell List",
                  "row": 1, "col": 1, "colIndex": 1, "path": []}]
        for u in units:
            u["n"] = mu.norm(u["text"])
        strings, entities, names = mu.collect_pack(pack)
        mu.map_forward(units, strings, entities, names, mu.Index([s["n"] for s in strings]), {})
        self.assertEqual(units[0]["status"], "value")

    def test_numbers_get_their_plain_forms(self):
        self.assertEqual(mu.numeric_forms("4,000"), {"4000"})
        self.assertTrue({"1", "15"} <= mu.numeric_forms("01–15"))
        self.assertTrue({"19", "0"} <= mu.numeric_forms("19 [0]"))
        self.assertIn("7", mu.numeric_forms("+7"))

    def test_value_parts_split_a_requirements_line_and_a_name_with_dice(self):
        self.assertEqual(sorted(mu.value_parts("minimum con 9, minimum dex 9")), ["9", "con", "dex"])
        self.assertEqual(sorted(mu.value_parts("bog lurker (1d6)")), ["1d6", "bog lurker"])


class Forward(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units, cls.strings = mapped()
        cls.by_text = {u["text"]: u for u in cls.units}

    def status(self, text):
        return self.by_text[text]["status"]

    def test_a_paragraph_in_the_pack_word_for_word_is_exact(self):
        self.assertEqual(self.status("The warden may kindle a ward light once per day. Bog lurkers fear it and flee on sight."), "exact")
        self.assertIn("classes[0].abilities[0].notes", self.by_text["The warden may kindle a ward light once per day. Bog lurkers fear it and flee on sight."]["matches"])

    def test_a_label_with_its_text_in_a_structured_field_is_a_value(self):
        self.assertIn(self.status("Until dawn."), ("value", "exact"))

    def test_a_list_item_whose_label_is_a_name_and_text_is_the_notes_is_exact_by_stitching(self):
        u = self.by_text["Oath: A warden who breaks the oath loses the light for a moon."]
        self.assertEqual(u["status"], "exact")
        self.assertTrue(u.get("stitched"))

    def test_cells_map_to_values_and_a_dash_is_blank(self):
        self.assertEqual(self.status("4,000"), "value")
        self.assertEqual(self.status("10"), "value")
        self.assertEqual(self.status("–"), "blank")

    def test_a_stat_cell_maps_to_the_stat_block_field(self):
        ac = next(u for u in self.units if u.get("col") == "AC")
        self.assertEqual(ac["status"], "value")

    def test_a_paragraph_the_pack_holds_only_the_start_of_is_partial_with_the_rest_listed(self):
        units = [dict(u) for u in self.units]
        pack = json.loads(json.dumps(PACK))
        pack["statBlocks"][0]["notes"] = "Lurkers hide in the mud and are immune to fear."
        for u in units:
            u["n"] = mu.norm(u["text"])
        u = next(x for x in units if x["text"].startswith("The warden may kindle"))
        u["text"] = u["text"] + " They never sleep in winter."
        u["n"] = mu.norm(u["text"])
        strings, entities, names = mu.collect_pack(pack)
        index = mu.Index([s["n"] for s in strings])
        mu.map_forward(units, strings, entities, names, index, {})
        self.assertEqual(u["status"], "partial")
        self.assertEqual(u["missing"], ["they never sleep in winter."])

    def test_a_heading_that_is_a_pack_name_is_exact_and_an_unknown_one_unmapped(self):
        self.assertEqual(self.status("Lantern Warden"), "exact")
        self.assertEqual(self.status("Ward Light"), "exact")  # inside the ability name


class Reverse(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units, cls.strings = mapped()
        cls.by_path = {s["path"]: s for s in cls.strings}

    def test_a_pack_string_found_in_the_book_is_verbatim_with_its_units(self):
        s = self.by_path["classes[0].abilities[0].notes"]
        self.assertEqual(s["status"], "verbatim")
        self.assertTrue(all(u.startswith("B007.") for u in s["units"]))

    def test_a_pack_string_with_an_invented_sentence_is_partial(self):
        s = self.by_path["statBlocks[0].notes"]
        self.assertEqual(s["status"], "partial")
        self.assertEqual(s["missing"], ["they also sing at night."])

    def test_app_text_names_and_ids_are_not_rules_strings(self):
        self.assertFalse(self.by_path["classes[0].blurb"]["rules"])
        self.assertFalse(self.by_path["classes[0].name"]["rules"])
        self.assertFalse(self.by_path["classes[0].id"]["rules"])
        self.assertTrue(self.by_path["classes[0].abilities[1].notes"]["rules"])

    def test_a_string_running_across_a_section_heading_is_flagged(self):
        units, _ = bu.build_units(synthetic_page(), 2, "B")
        for u in units:
            u["n"] = mu.norm(u["text"])
        pack = {"items": [{"id": "a", "notes": "Oath: A warden who breaks the oath loses the light for a moon. Ward Costs "
                                               "Light Cost Weight Ward light 10 5 Moon lamp 4,000 – Bog Lurker AC 5 [14],"}]}
        strings, _, _ = mu.collect_pack(pack)
        mu.map_reverse(strings, mu.Flow(units))
        self.assertEqual(strings[1]["status"], "verbatim")
        self.assertTrue(strings[1].get("crosses"))

    def test_the_formats_machinery_is_not_rules_text(self):
        for v in ("firstDeath", "midpoint", "wards:old-oaths", "abilityModifiers.WIS.saves", "roll <= loyalty",
                  "floor(speed / 5)", "lurkers-{result}", "D(poison)"):
            self.assertFalse(mu.is_rules_string(["rulesSets", 0, "x"], v, set()), v)
        for v in ("Packed", "Lurkers flee from fire.", "Until dawn"):
            self.assertTrue(mu.is_rules_string(["rulesSets", 0, "x"], v, set()), v)

    def test_crossing_the_entrys_own_sub_heading_is_not_a_run_on_but_crossing_into_the_next_entry_is(self):
        units = [
            {"id": "B1.1", "kind": "heading", "level": 3, "text": "Mend Lantern", "path": ["Spells"]},
            {"id": "B1.2", "kind": "para", "text": "A cracked lantern touched by the caster is made whole and burns again.",
             "path": ["Spells", "Mend Lantern"]},
            {"id": "B1.3", "kind": "heading", "level": 4, "text": "Reversed: Break Lantern", "path": ["Spells", "Mend Lantern"]},
            {"id": "B1.4", "kind": "para", "text": "A lantern within reach of the caster cracks and goes dark at once.",
             "path": ["Spells", "Mend Lantern", "Reversed: Break Lantern"]},
            {"id": "B1.5", "kind": "heading", "level": 3, "text": "Snuff Candle", "path": ["Spells"]},
            {"id": "B1.6", "kind": "para", "text": "Every candle in the room goes out and cannot be relit for a turn.",
             "path": ["Spells", "Snuff Candle"]},
        ]
        for u in units:
            u["n"] = mu.norm(u["text"])
        own = {"path": "spells[0].notes", "rules": True, "key": "notes",
               "text": units[1]["text"] + " " + units[3]["text"]}
        runon = {"path": "spells[1].notes", "rules": True, "key": "notes",
                 "text": units[3]["text"] + " " + units[5]["text"]}
        for s in (own, runon):
            s["n"] = mu.norm(s["text"])
        mu.map_reverse([own, runon], mu.Flow(units))
        self.assertNotIn("crosses", own)
        self.assertEqual(runon.get("crosses"), ["B1.5"])

    def test_a_pack_string_the_units_split_but_the_page_prints_whole_is_the_books_words(self):
        page = "Wardens of the Fen\nA lantern left dark invites the bog lur-\nkers to the causeway, where they wait\n7"
        s = {"path": "items[0].notes", "rules": True, "key": "notes", "status": "unmapped",
             "text": "A lantern left dark invites the bog lurkers to the causeway, where they wait"}
        short = {"path": "items[1].notes", "rules": True, "key": "notes", "status": "unmapped", "text": "Bog lurkers"}
        mu.page_check([s, short], [page])
        self.assertEqual((s["status"], s.get("readerSplit")), ("verbatim", True))
        self.assertEqual(short["status"], "unmapped")
        two = {"path": "items[2].notes", "rules": True, "key": "notes", "status": "partial",
               "text": "Wardens of the Fen\nA lantern left dark invites the bog lurkers"}
        mu.page_check([two], ["A lantern left dark invites the bog lur-\nkers\n7", "Wardens of the Fen\n8"])
        self.assertEqual((two["status"], two.get("readerSplit")), ("stitched", True))

    def test_a_compact_form_with_the_same_numbers_is_values(self):
        units, _ = bu.build_units(synthetic_page(), 2, "B")
        for u in units:
            u["n"] = mu.norm(u["text"])
        pack = {"items": [{"id": "a", "weapon": {"qualities": ["Ward 10/5"]}}]}
        strings, _, _ = mu.collect_pack(pack)
        mu.map_reverse(strings, mu.Flow(units))
        self.assertEqual(strings[1]["status"], "values")


# ----------------------------------------------------------------------------------------------- scoring and triage

def unit(uid, kind, text, status, path=("Chapter", "Entry"), **extra):
    return {"id": uid, "page": int(uid[1:4]), "kind": kind, "text": text, "status": status, "path": list(path), **extra}


class Scoring(unittest.TestCase):
    def test_grades_big_and_small_misses(self):
        units = [
            unit("B010.001", "para", "A warden who breaks the oath loses the light for a moon.", "unmapped"),
            unit("B010.002", "para", "Only once.", "unmapped"),
            unit("B010.003", "heading", "Oath", "unmapped"),
            unit("B010.004", "para", "The light lasts until dawn. It heals 1d6 each night.", "partial", coverage=0.5,
                 missing=["it heals 1d6 each night."]),
            unit("B010.005", "cell", "12 [+7]", "unmapped", table="Costs", row=1, col="Cost"),
            unit("B010.006", "cell", "Ward light", "value", table="Costs", row=1, col="Light"),
            unit("B010.007", "cell", "Moon lamp", "unmapped", table="Costs", row=2, col="Light"),
            unit("B010.008", "cell", "4,000", "unmapped", table="Costs", row=2, col="Cost"),
        ]
        rows, misses = score.grade_units(units, score.load_triage(None))
        grades = {m[2]["id"]: m[0] for m in misses}
        self.assertEqual(grades["B010.001"], "big")      # a missing rule
        self.assertEqual(grades["B010.002"], "small")    # short, no number
        self.assertEqual(grades["B010.003"], "small")    # structure
        self.assertEqual(grades["B010.004"], "big")      # a cut-off with a number
        self.assertEqual(grades["B010.005"], "big")      # a value missing from a row the pack has
        self.assertEqual(grades["B010.007"], "big")      # a whole row missing: counted once
        self.assertNotIn("B010.008", grades)
        self.assertEqual(rows["Chapter"]["units"], 8)

    def test_triage_omits_by_unit_path_page_and_table_with_a_reason(self):
        triage = {"units": {"B010.001": {"omit": "example", "reason": "worked example"}},
                  "paths": [{"prefix": ["Intro"], "omit": "out-of-scope", "reason": "no rules"},
                            {"prefix": ["Chapter", "Advice"], "omit": "out-of-scope", "reason": "prose", "kinds": ["para"]}],
                  "pages": [{"book": "B", "from": 1, "to": 3, "omit": "out-of-scope", "reason": "contents"}],
                  "tables": [{"book": "B", "page": 10, "table": "Art", "omit": "art", "reason": "a picture caption"}],
                  "pack": {"hooks": {"keep": "app logic"}}}
        self.assertEqual(score.omission(unit("B010.001", "para", "x", "unmapped"), triage)[0], "example")
        self.assertEqual(score.omission(unit("B010.002", "para", "x", "unmapped", path=("Intro", "A")), triage)[0], "out-of-scope")
        self.assertEqual(score.omission(unit("B002.001", "para", "x", "unmapped"), triage)[0], "out-of-scope")
        self.assertEqual(score.omission(unit("B010.003", "cell", "x", "unmapped", table="Art"), triage)[0], "art")
        self.assertEqual(score.omission(unit("B010.004", "para", "x", "unmapped", path=("Chapter", "Advice")), triage)[0], "out-of-scope")
        self.assertIsNone(score.omission(unit("B010.005", "cell", "x", "unmapped", path=("Chapter", "Advice"), table="T"), triage))
        self.assertIsNone(score.omission(unit("B010.006", "para", "x", "unmapped"), triage))
        self.assertEqual(score.pack_kept("hooks[2].test", triage), "app logic")
        self.assertIsNone(score.pack_kept("items[0].notes", triage))

    def test_a_duplicate_repeated_on_purpose_loses_only_its_duplicate_flag(self):
        triage = score.load_triage(None)
        triage["duplicates"] = [{"path": r"statBlocks\[\d+\]\.groupAbilities\[\d+\]\.note",
                                 "reason": "a monster group's text on each variant"}]
        base = {"rules": True, "status": "verbatim", "text": "Lurkers hide in the mud and are immune to fear."}
        group = dict(base, path="statBlocks[1].groupAbilities[0].note", duplicateOf="statBlocks[0].groupAbilities[0].note")
        other = dict(base, path="items[3].notes", duplicateOf="items[2].notes")
        rows, misses = score.grade_pack([group, other], triage)
        self.assertEqual(rows["statBlocks"]["duplicateByDesign"], 1)
        self.assertEqual([m[2]["path"] for m in misses], ["items[3].notes"])

    def test_pack_strings_are_graded_and_modelling_notes_kept(self):
        strings = [
            {"path": "items[0].notes", "text": "A sack that eats whatever is put inside it.", "rules": True, "status": "unmapped"},
            {"path": "items[1].notes", "text": "Holds 600 coins.", "rules": True, "status": "unmapped"},
            {"path": "items[2].notes", "text": "The book gives no weight; the pack uses 10.", "rules": True, "status": "unmapped"},
            {"path": "items[3].notes", "text": "Lamp oil. It burns for 4 hours in a lantern.", "rules": True, "status": "partial",
             "missing": ["it burns for 4 hours in a lantern."]},
            {"path": "items[4].blurb", "text": "App words here.", "rules": False, "status": "unmapped"},
        ]
        rows, misses = score.grade_pack(strings, score.load_triage(None))
        grades = {m[2]["path"]: m[0] for m in misses}
        self.assertEqual(grades["items[0].notes"], "big")
        self.assertEqual(grades["items[1].notes"], "small")
        self.assertNotIn("items[2].notes", grades)
        self.assertEqual(rows["items"]["kept"], 1)
        self.assertEqual(grades["items[3].notes"], "big")
        self.assertNotIn("items[4].blurb", grades)

    def test_the_scorecard_file_is_written_with_the_two_numbers(self):
        m = {"pack": "x.pack.json", "packVersion": "0.1", "books": [{"book": "B", "file": "b.pdf"}],
             "units": [unit("B010.001", "para", "A rule the pack has.", "exact"),
                       unit("B010.002", "para", "A rule the pack lacks, with 1d6 damage.", "unmapped")],
             "packStrings": [{"path": "items[0].notes", "text": "A rule the pack has.", "rules": True, "status": "verbatim"}]}
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "scorecard.md")
            mapped_, scored, big, small = score.write_scorecard(m, score.load_triage(None), out, 100)
            text = open(out, encoding="utf-8").read()
        self.assertEqual((mapped_, scored, big, small), (1, 2, 1, 0))
        self.assertIn("Printed units carried: 50.0%", text)
        self.assertIn("B010.002", text)


class TriageProposals(unittest.TestCase):
    def test_proposals_follow_the_unit(self):
        self.assertEqual(propose(unit("B002.001", "para", "x", "unmapped", path=("Table of Contents",)), [])[0], "out-of-scope")
        self.assertEqual(propose(unit("B010.001", "heading", "Oath", "unmapped"), [])[0], "structure")
        self.assertEqual(propose(unit("B010.002", "para", "See Wards, p12 for details.", "unmapped"), [])[0], "cross-reference")
        self.assertEqual(propose(unit("B010.003", "para", "* Modifiers no longer apply.", "unmapped"), [])[0], "legend")
        self.assertEqual(propose(unit("B010.004", "para", "A warden rolls 1d6.", "unmapped", path=("Chapter", "Example of Play")), [])[0], "example")
        self.assertEqual(propose(unit("B010.005", "para", "A warden rolls 1d6.", "unmapped"), [(0.8, "items[0].notes", "x")])[0], "fix")


if __name__ == "__main__":
    unittest.main()
