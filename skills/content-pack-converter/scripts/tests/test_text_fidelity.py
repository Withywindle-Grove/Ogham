"""Tests for the book-text fidelity tools, on invented text only.

Run from the repo root:
  py -m unittest discover -s skills/content-pack-converter/scripts/tests
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from text_fidelity import audit, is_verbatim, norm, strip_page_numbers  # noqa: E402

BOOK = norm("The Lantern Warden may kin­ dle a ward light once per day. It lasts until dawn. "
            "Bog lurkers fear it: they flee on sight. A warden who breaks the oath loses the light for a moon.")


class PageNumbers(unittest.TestCase):
    def test_a_page_number_at_the_bottom_edge_is_dropped(self):
        lines = ["Bog lurker", "It waits.", "", "42"]
        self.assertEqual(strip_page_numbers(lines, 44), ["Bog lurker", "It waits.", ""])

    def test_a_number_in_the_middle_of_a_page_is_table_data_and_stays(self):
        lines = ["Head", "a", "b", "c", "6", "d", "e", "f", "tail"]
        self.assertIn("6", strip_page_numbers(lines, 6))

    def test_a_number_at_the_edge_far_from_the_page_number_stays(self):
        lines = ["Rounds", "text", "more", "6"]
        self.assertEqual(strip_page_numbers(lines, 120), lines)


class Verbatim(unittest.TestCase):
    def test_soft_hyphens_and_curly_quotes_do_not_count_as_changes(self):
        self.assertTrue(is_verbatim("The Lantern Warden may kindle a ward light once per day.", BOOK))

    def test_a_reworded_rule_is_not_the_book_s_words(self):
        self.assertFalse(is_verbatim("Once a day the warden can make a ward light that lasts all night.", BOOK))

    def test_a_passage_joined_from_two_places_counts_when_every_sentence_is_in_the_book(self):
        self.assertTrue(is_verbatim("It lasts until dawn. A warden who breaks the oath loses the light for a moon.", BOOK))

    def test_one_invented_sentence_in_a_joined_passage_fails_it(self):
        self.assertFalse(is_verbatim("It lasts until dawn. The light also heals the warden.", BOOK))


class Audit(unittest.TestCase):
    def test_app_text_is_skipped_and_rules_text_is_counted(self):
        pack = {"classes": [{"id": "lantern-warden",
                             "blurb": "A keeper of lights who scares off things in the bog at night.",
                             "abilities": [{"name": "Ward light",
                                            "notes": "The Lantern Warden may kindle a ward light once per day."},
                                           {"name": "Oath",
                                            "notes": "Break the oath and you lose the light for about a month."}]}]}
        stats, misses = audit(pack, BOOK)
        self.assertEqual(sum(s[0] for s in stats.values()), 1)
        self.assertEqual([p for p, _ in misses], ["classes.0.abilities.1.notes"])

    def test_lookup_table_cells_are_checked_and_numbers_only_cells_are_not(self):
        pack = {"tables": [{"id": "ward-costs", "kind": "lookup", "columns": ["Light", "Cost"],
                            "rows": [{"key": "Ward light", "values": ["lasts until dawn", "10"]},
                                     {"key": "Moon lamp", "values": ["burns all week", "25"]}]}]}
        stats, misses = audit(pack, BOOK)
        self.assertEqual(sorted(p for p, _ in misses),
                         ["tables.0.columns.1", "tables.0.rows.1.key", "tables.0.rows.1.values.0"])

    def test_rules_text_under_any_key_is_checked(self):
        pack = {"rulesSets": [{"saveRule": "Roll a die and hope the bog lurker looks away from you tonight."}]}
        self.assertEqual(len(audit(pack, BOOK)[1]), 1)


if __name__ == "__main__":
    unittest.main()
