"""Where each printed unit is in the pack, and where each pack rules string came from (the scorecard's second step).

Usage: py map_units.py units.json [units2.json ...] PACK.json --out map.json

Forward (book -> pack), per unit:
- exact       the unit's normalised text is inside a pack string (the paths are recorded)
- partial     some of its sentences are in the pack and some are not (the missing ones are listed), or a pack
              string holds part of it
- value       a cell (or a stat-line field) whose value sits in a structured field of the entity the table
              maps to (an item, a class table row, a stat block...)
- blank       a cell that prints a dash: nothing to carry
- unmapped    none of the above (`nearest` names the pack entity the table mapped to, when there is one)

Reverse (pack -> book), per pack rules string (every string but app text, names, ids and references; list items
and table cells included):
- verbatim    the whole string is in the book's flow (the unit ids it spans are recorded)
- stitched    every sentence is in the book, from more than one place
- partial     some sentences are the book's and some are not (listed)
- values      a compact form of one printed unit or table row (the same numbers in the same order)
- duplicateOf the same text already sits at another path (listed, graded small)
- unmapped    invented or paraphrased

Normalisation evens out quotes, dashes, soft hyphens, ligatures, spacing and case, so only wording counts.
"""
import argparse
import bisect
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict

from text_fidelity import APP_KEYS, norm as base_norm, sentences

REF_KEYS = {"option", "ruleKey", "castingType", "unit", "letter", "tableId", "itemId", "baseId", "classIds", "lists",
            "slot", "xpTableId", "listId", "spellListId", "classId", "raceId", "nextTable", "statBlockId", "home",
            "appliesTo", "when", "from", "target", "version", "built", "author", "format", "shortName", "for",
            "equipSlot", "templateId", "fieldId", "key", "type", "cost", "reversedName", "pluralName",
            "onlyWithOption", "nextTablePattern", "familiarFormula", "perDay", "terrainChance", "reverseAt", "mode",
            "event", "autoFill", "fill"}

# values that are the format's own machinery, not text a reader sees: a camelCase or lower-case enum word, an
# option reference ("spell-books:advanced"), a dotted field path, a formula, a save code ("D(poison)")
MACHINE_VALUE = re.compile(r"[a-z]+(?:[A-Z][a-z0-9]*)*"                     # firstDeath, midpoint, tags
                           r"|[a-z0-9-]+:[a-z0-9-]+"                         # option:choice
                           r"|[A-Za-z]+(?:\.[A-Za-z0-9]+)+"                  # abilityModifiers.WIS.magicSaves
                           r"|[\w.]+\s*(?:<=|>=|==|<|>|\*)\s*[\w.]+"          # roll <= loyalty, speed * 3
                           r"|\w+\(.*\)"                                    # floor(speed / 5)
                           r"|.*\{\w+\}.*"                                   # encounter-{result}
                           r"|[A-Z]\(\w+\)")                                 # D(poison)
SHINGLE = 12
DASHES = {"", "-", "–", "—", "n/a", "none"}


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s*—\s*", "—", s)   # a stray space beside an em dash ("Dead —a Rank 5 spell") is typography
    s = s.replace("×", "x").replace("‒", "-").replace("′", "'").replace("″", '"')
    # a chance broken at a line end ("1-in- 6") keeps its hyphen: base_norm would join it to "1-in6"
    s = re.sub(r"-\s+(?=\d)", "-", s)
    s = base_norm(s)
    s = re.sub(r"\s+([,.;:)\]])", r"\1", s)
    s = re.sub(r"([(\[])\s+", r"\1", s)
    # typography, not wording: a hyphen inside a word (the book's "over-steps" at a line end, the pack's
    # "half-way"), and a space after a slash ("entrance/ exit")
    s = re.sub(r"(?<=[a-z])-(?=[a-z])", "", s)
    s = re.sub(r"\s*/\s*", "/", s)
    return s


def numeric_forms(text):
    """'4,000' -> {'4000'}; '19 [0]' -> {'19', '0'}; '10gp' -> {'10'}; '1†' -> {'1'}; '01–15' -> {'1', '15'};
    '+7' -> {'+7', '7'}."""
    t = text.replace(",", "")
    forms = {t.strip("*†‡ ").strip(), t.replace("'", "").replace('"', "").strip("*†‡ ").strip()}
    for f in re.findall(r"(?:(?<!\d)[+-])?\d+(?:\.\d+)?", t):
        forms.add(f)
        sign = f[0] if f[0] in "+-" else ""
        digits = f[len(sign):].lstrip("0") or "0"
        forms.add(sign + digits)
        forms.add(digits)
    return {f for f in forms if f}


# ----------------------------------------------------------------------------------------------- the pack side

def path_str(path):
    out = ""
    for p in path:
        out += f"[{p}]" if isinstance(p, int) else (f".{p}" if out else p)
    return out


def last_key(path):
    for p in reversed(path):
        if not isinstance(p, int):
            return p
    return ""


SKIP_ANCESTORS = {"source", "refs", "uses", "gmOnly", "hooks", "fieldTemplates", "sheetFields", "optionCategories",
                  "presets", "byOption", "creationMethods", "meta"}


def is_rules_string(path, value, ids):
    if not re.search(r"[A-Za-z]{3,}", value):
        return False
    key = last_key(path)
    if key in APP_KEYS or key in REF_KEYS:
        return False
    if any(p in SKIP_ANCESTORS for p in path if isinstance(p, str)):
        return False
    if value in ids or re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)+", value) or MACHINE_VALUE.fullmatch(value.strip()):
        return False
    return True


def collect_pack(pack):
    """strings: [{path, text, n, rules, key}]; scalars by entity: {entity_path: set(norm forms)};
    names: {norm: [path]} for name-like keys."""
    strings, entities, names, ids = [], defaultdict(set), defaultdict(list), set()

    def walk_ids(v):
        if isinstance(v, dict):
            if isinstance(v.get("id"), str):
                ids.add(v["id"])
            for x in v.values():
                walk_ids(x)
        elif isinstance(v, list):
            for x in v:
                walk_ids(x)

    walk_ids(pack)

    def add_scalar(path, forms):
        # every dict on the way down (to depth 4) owns the scalar; each form is also kept tagged with the key it sits
        # under ("@xp=25"), so a printed stat line can be matched label by label (a tag never equals a unit's text)
        key = norm(last_key(path)) if path and isinstance(path[-1], str) else ""
        tagged = {f"@{key}={f}" for f in forms} if key else set()
        for depth in range(1, min(len(path), 5)):
            entities[path_str(path[:depth])].update(forms | tagged)

    def walk(v, path):
        if isinstance(v, dict):
            for k, x in v.items():
                if isinstance(x, (int, float, str)) and not isinstance(x, bool):
                    add_scalar(path + [k], {norm(k)})
                walk(x, path + [k])
        elif isinstance(v, list):
            for i, x in enumerate(v):
                walk(x, path + [i])
        elif isinstance(v, bool):
            return
        elif isinstance(v, (int, float)):
            add_scalar(path, {str(v)})
        elif isinstance(v, str):
            n = norm(v)
            if not n:
                return
            key = last_key(path)
            strings.append({"path": path_str(path), "text": v, "n": n, "key": key,
                            "rules": is_rules_string(path, v, ids)})
            if key in ("name", "heading", "title", "label", "key", "reversedName", "appearsAs"):
                names[n].append(path_str(path))
            if len(n) <= 60:
                add_scalar(path, {n} | numeric_forms(n))

    for k, v in pack.items():
        if k in ("meta", "format", "formatVersion"):
            continue
        walk(v, [k])
    return strings, entities, names


class Index:
    """Find which of many strings contain a query: shingles at word starts -> string ids, then a real check."""

    def __init__(self, texts):
        self.texts = texts
        self.by_shingle = defaultdict(list)
        self.exact = defaultdict(list)
        self.blob = "\n".join(texts)
        for i, t in enumerate(texts):
            self.exact[t].append(i)
            for m in re.finditer(r"(?:^|(?<= ))\S", t):
                sh = t[m.start():m.start() + SHINGLE]
                if len(sh) == SHINGLE:
                    self.by_shingle[sh].append(i)

    def containing(self, q):
        if len(q) < SHINGLE:
            if q in self.exact:
                return list(self.exact[q])
            return [i for i, t in enumerate(self.texts) if q in t] if q in self.blob else []
        return [i for i in self.by_shingle.get(q[:SHINGLE], ()) if q in self.texts[i]]


class Flow:
    """The book as one normalised string in reading order, with the unit each position belongs to."""

    def __init__(self, units):
        self.units = units
        parts, self.starts, pos = [], [], 0
        for i, u in enumerate(units):
            n = u["n"]
            if u.get("stat"):
                # the printed line reads "AC 5 [14], HD 3+1, ... XP 50" then the next paragraph: a comma after a
                # cell only when another stat cell follows it (the last one has none in print)
                n = f"{norm(str(u.get('col', '')))} {n}"
                nxt = units[i + 1] if i + 1 < len(units) else None
                if nxt is not None and nxt.get("stat") and not n.endswith((",", ".", ":", ";")):
                    n += ","
            # a line ending in a slash runs on into the next unit ("Until done /" then "Instant"): norm() closes
            # the space after a slash, so the flow does too
            sep = "" if not parts or parts[-1].endswith("/") else " "
            pos += len(sep)
            parts.append(sep + n)
            self.starts.append(pos)
            pos += len(n)
        self.text = "".join(parts)
        self.by_shingle = defaultdict(list)
        for m in re.finditer(r"(?:^|(?<= ))\S", self.text):
            sh = self.text[m.start():m.start() + SHINGLE]
            if len(sh) == SHINGLE:
                self.by_shingle[sh].append(m.start())

    def find(self, q):
        """Positions where q occurs (at most 20)."""
        if len(q) < SHINGLE:
            out, start = [], 0
            while len(out) < 20:
                p = self.text.find(q, start)
                if p < 0:
                    break
                out.append(p)
                start = p + 1
            return out
        return [p for p in self.by_shingle.get(q[:SHINGLE], ()) if self.text.startswith(q, p)][:20]

    def inside(self, first_id, heading_id):
        """The heading is a sub-heading of the entry the text starts in (a spell's own "Reversed:" heading, a
        section's own sub-sections): crossing it keeps the text inside its entry, so it is not a run-on."""
        if not hasattr(self, "_by_id"):
            self._by_id = {u["id"]: u for u in self.units}
        start, head = self._by_id.get(first_id), self._by_id.get(heading_id)
        if not start or not head:
            return False
        trail = list(start.get("path", []))
        if start.get("kind") == "heading":
            trail = trail + [start.get("text", "")]
        if not trail:
            return False
        return list(head.get("path", []))[:len(trail)] == trail

    def kind_of(self, uid):
        if not hasattr(self, "_kinds"):
            self._kinds = {u["id"]: (u["kind"], u.get("level", 9)) for u in self.units}
        kind, level = self._kinds.get(uid, ("", 9))
        return "heading" if kind == "heading" and level <= 3 else kind

    def level_of(self, uid):
        self.kind_of(uid)
        return self._kinds.get(uid, ("", 9))[1]

    def order_of(self, ids):
        if not hasattr(self, "_order"):
            self._order = {u["id"]: i for i, u in enumerate(self.units)}
        return [self._order[i] for i in ids if i in self._order]

    def unit_with_numbers(self, nums):
        """A unit (or a run of cells of one table row) holding exactly these numbers in this order."""
        if not hasattr(self, "_nums"):
            self._nums = defaultdict(list)
            rows = defaultdict(list)
            for u in self.units:
                un = re.findall(r"\d+", u["n"])
                if len(un) >= 2:
                    self._nums[tuple(un[:2])].append((u["id"], un))
                if u["kind"] == "cell":
                    rows[(u["id"][:1], u["page"], u.get("table"), u.get("row"))].append(u)
            for key, cells in rows.items():
                un = [x for c in cells for x in re.findall(r"\d+", c["n"])]
                if len(un) >= 2:
                    self._nums[tuple(un[:2])].append((cells[0]["id"], un))
        for uid, un in self._nums.get(tuple(nums[:2]), ()):
            if un == nums:
                return uid
        return None

    def units_at(self, pos, length):
        first = bisect.bisect_right(self.starts, pos) - 1
        last = bisect.bisect_right(self.starts, pos + length - 1) - 1
        return [self.units[i]["id"] for i in range(max(first, 0), last + 1)]


# ----------------------------------------------------------------------------------------------- mapping

STAT_LABELS = r"att|attacks|speed|fly|swim|climb|burrow|morale|xp|enc|encounters|hoard|level|ac|hp|saves|behaviour|speech|possessions"
STAT_PAIR = re.compile(r"\b(" + STAT_LABELS + r")\b(.*?)(?=\b(?:" + STAT_LABELS + r")\b|$)")
UNIT_PLURAL = re.compile(r"\b(round|turn|segment|minute|hour|day|week|month|year|mile|foot|yard|level|charge)s\b")
STOP = {"and", "or", "minimum", "the", "of", "to", "a", "an", "per", "at", "in", "on", "by", "with"}

# A printed stat label and the pack field keys that carry it (normalised); a label the block has no field for falls
# back to the whole block's values.
STAT_ALIASES = {"att": {"att", "attacks", "attack"}, "attacks": {"att", "attacks", "attack"},
                "enc": {"enc", "encounters", "number appearing", "lair"},
                "encounters": {"enc", "encounters", "number appearing", "lair"},
                "hp": {"hp", "hpaverage", "hit points"}, "level": {"level", "hd", "hit dice"},
                "fly": {"fly", "speed"}, "swim": {"swim", "speed"}, "climb": {"climb", "speed"},
                "burrow": {"burrow", "speed"}}


def is_stat_line(n):
    """Whether a normalised line is nothing but printed stat labels and their values ("speed 30 morale 7")."""
    pairs = STAT_PAIR.findall(n)
    return bool(pairs) and "".join(k + v for k, v in pairs).replace(" ", "") == n.replace(" ", "")


def under_label(label, forms_wanted, block_forms):
    """Whether a stat block holds one of a printed value's forms under that value's own label."""
    keys = STAT_ALIASES.get(label, {label})
    has_label = any(f.startswith("@") and f[1:].split("=", 1)[0] in keys for f in block_forms)
    if not has_label:
        return bool(forms_wanted & block_forms)
    return any(f"@{k}={f}" in block_forms for k in keys for f in forms_wanted)



def value_parts(n):
    """'minimum con 9, minimum dex 9' -> ['con', '9', 'dex', '9']; 'ankheg 3 hd (1d2)' -> ['ankheg 3 hd', '1d2'];
    'cleric*: 11th' -> ['cleric', '11th', '11']. The parts a structured field would hold."""
    n = n.strip(" .")
    if ":" in n and not re.search(r"\d:\d", n):
        n = n.split(":", 1)[1].strip() or n
    parts = [p.strip(" .*†‡") for p in re.split(r",|/|;|\(|\)|\bor\b", n) if p.strip(" .*†‡")]
    out = []
    for p in parts:
        words = [w for w in p.split() if w not in STOP]
        if not words:
            continue
        if (re.fullmatch(r"[+-]?\d+(st|nd|rd|th)?", words[-1]) and len(words) > 1) or re.fullmatch(r"[+-]?\d+\s+\w+", p):
            out.extend(words)
        else:
            out.append(" ".join(words))
    forms = set()
    for p in out:
        forms.add(p)
        forms.add(re.sub(r"(\d)(st|nd|rd|th)$", r"\1", p))
        forms.add(p.lstrip("+"))
        forms.add(UNIT_PLURAL.sub(r"\1", p))   # "12 rounds" is held as {value: 12, unit: "round"}
    return [f for f in forms if f] or [n]


def held_as_values(n, entities):
    """Entities whose scalars hold every part of the text (one entity holds them all)."""
    n_forms = {n, n.strip(" .")}
    groups = {}
    for p in value_parts(n):
        groups.setdefault(UNIT_PLURAL.sub(r"\1", re.sub(r"(\d)(st|nd|rd|th)$", r"\1", p).lstrip("+")), set()).add(p)
    alts = list(groups.values())
    return [e for e, forms in entities.items()
            if forms & n_forms or all(any(a in forms for a in alt) for alt in alts)]

def cover(n, index):
    """Split a line into the longest consecutive pieces the pack holds (each 2+ words, 12+ characters), or None."""
    words, pieces, i = n.split(), [], 0
    if len(words) < 4 or len(n) > 240:
        return None
    while i < len(words):
        best = None
        for j in range(len(words), i + 1, -1):
            piece = " ".join(words[i:j]).strip(" ,;")
            if len(piece) >= 12 and index.containing(piece):
                best = j
                break
        if best is None:
            return None
        pieces.append(" ".join(words[i:best]))
        i = best
    return pieces


TYPE_LINE = re.compile("(Small|Medium|Large)(/(Small|Medium|Large))? [A-Z][A-Za-z-]+(/[A-Za-z-]+)?—"
                       "[A-Z][A-Za-z -]+—[A-Za-z ]+$")


def type_line_held(raw, entities):
    """A creature's printed type line at the end of a unit (invented: "... Small Fen-beast—Low Wits—Lawful"):
    held when one stat block holds its three parts (size and type, intelligence, alignment fields). Returns
    (holders, the unit's text before the line)."""
    m = TYPE_LINE.search(raw.strip())
    if not m:
        return [], raw
    parts = [norm(x) for x in m.group(0).split("—")]
    holders = [e for e, forms in entities.items() if e.startswith("statBlocks") and all(x in forms for x in parts)]
    return holders, raw.strip()[: m.start()].strip()


def map_forward(units, strings, entities, names, index, held_by):
    """Sets status/matches/missing on each unit (in place)."""
    # entity votes per table: which pack entities hold the table's values
    scalar_index = defaultdict(set)
    for ent, forms in entities.items():
        for f in forms:
            scalar_index[f].add(ent)
    name_index = defaultdict(set)
    for s in strings:
        if s["key"] in ("name", "appearsAs", "key", "heading", "label"):
            ent = s["path"].rsplit(".", 1)[0]
            name_index[s["n"]].add(ent)

    tables = defaultdict(list)
    for u in units:
        if u["kind"] == "cell":
            tables[(u["id"][:1], u["page"], u["table"])].append(u)

    table_entities = {}
    for key, cells in tables.items():
        votes = Counter()
        for c in cells:
            forms = {c["n"]} | numeric_forms(c["n"])
            for f in forms:
                if f in DASHES:
                    continue
                for ent in scalar_index.get(f, ()):
                    votes[ent] += 1 if len(f) > 1 or not f.isdigit() else 0.3
        for ent in name_index.get(norm(key[2]), ()):
            votes[ent] += 5
        # the row keys (first column) name entities too (an equipment table's rows are items)
        for c in cells:
            if c.get("colIndex") == 0 or c.get("col") in ("Level",):
                for ent in name_index.get(c["n"], ()):
                    votes[ent] += 2
        best = [e for e, _ in sorted(votes.items(), key=lambda kv: (-kv[1], len(entities[kv[0]])))[:4]]
        table_entities[key] = best

    for u in units:
        n = u["n"]
        kind = u["kind"]
        if kind == "cell":
            key = (u["id"][:1], u["page"], u["table"])
            if n in DASHES:
                u["status"] = "blank"
                continue
            hits = index.containing(n) if len(n) >= 12 else []
            if hits:
                u["status"] = "exact"
                u["matches"] = [strings[i]["path"] for i in hits[:5]]
                continue
            forms = {n} | numeric_forms(n)
            ents = table_entities.get(key, [])
            row_ents = set()
            if u.get("colIndex") == 0:
                row_ents = name_index.get(n, set())
            # the entity named by this row's key, if any
            row_key = next((c["n"] for c in tables[key] if c["row"] == u["row"] and c.get("colIndex") == 0), None)
            if row_key:
                row_ents |= name_index.get(row_key, set())
            pool = set(ents) | row_ents
            numeric = {re.sub(r"^0+(?=\d)", "", f.lstrip("+")) for f in forms if re.fullmatch(r"[+-]?\d+(\.\d+)?", f)}
            found = any(n in entities[e] or n.strip("*†‡") in entities[e] for e in pool) \
                or (numeric and any(all(f in entities[e] for f in numeric) for e in pool)) \
                or bool(held_as_values(n, {e: entities[e] for e in pool}))
            # a list cell naming an entry and its reverse ("Mend Lantern (Break Lantern)"): both names in the pack
            pair = re.fullmatch(r"(.+?)\s*\((.+)\)", n)
            pair_ents = [] if found or not pair else \
                [e for e in (name_index.get(pair.group(1)) or ()) if pair.group(2) in entities.get(e, ())]
            if pair_ents:
                u["status"] = "value"
                u["matches"] = pair_ents[:3]
            elif found:
                u["status"] = "value"
                u["matches"] = [e for e in pool if n in entities[e] or n.strip("*†‡") in entities[e]
                                or (numeric and all(f in entities[e] for f in numeric))][:3]
            else:
                u["status"] = "unmapped"
                u["nearest"] = list(ents[:2])
            continue
        if kind == "heading":
            if n in names:
                u["status"] = "exact"
                u["matches"] = names[n][:5]
            else:
                hits = index.containing(n) if len(n) >= 6 else []
                if hits:
                    u["status"] = "exact"
                    u["matches"] = [strings[i]["path"] for i in hits[:5]]
                else:
                    u["status"] = "unmapped"
            continue
        # para, list, label
        hits = index.containing(n) or index.containing(n.rstrip(".:;"))
        if hits:
            u["status"] = "exact"
            u["matches"] = [strings[i]["path"] for i in hits[:5]]
            continue
        parts = sentences(n)
        found, missing, paths = [], [], []
        for p in parts:
            h = index.containing(p) or index.containing(p.rstrip(".:;"))
            if h:
                found.append(p)
                paths.extend(strings[i]["path"] for i in h[:2])
            elif len(p.split()) <= 6 and not is_stat_line(p) and held_as_values(p, entities):
                found.append(p)
                paths.extend(held_as_values(p, entities)[:1])
            else:
                missing.append(p)
        held = held_by.get(u["id"], [])
        if found and not missing:
            u["status"] = "exact"
            u["stitched"] = True
            u["matches"] = sorted(set(paths))[:6]
            continue
        typed, before = type_line_held(u["text"], entities)
        if typed and (not before or index.containing(norm(before))):
            u["status"] = "value" if not before else "exact"
            u["matches"] = typed[:3]
            continue
        # a printed stat line (invented: "speed 30 morale 7 xp 25"): every value held by one stat block, each under its own label
        pairs = STAT_PAIR.findall(n)
        if is_stat_line(n):
            # each value whole, or its parts ("1d4 (no lair)" -> "1d4", "no lair"), held by the same stat block
            vals = [(k, numeric_forms(v) | {v.strip(" ,.")} | set(value_parts(v.strip(" ,.")))) for k, v in pairs]
            holders = [e for e, forms in entities.items() if e.startswith("statBlocks")
                       and all(under_label(k, f, forms) for k, f in vals)
                       and (len(pairs) >= 2 or len(pairs[0][1].strip()) >= 4)]
            if holders:
                u["status"] = "value"
                u["matches"] = holders[:3]
                continue
        if not is_stat_line(n) and (len(n.split()) <= 14 or (":" in n and n.count(",") >= 3)):
            holders = held_as_values(n, entities)
            if holders:
                u["status"] = "value"
                u["matches"] = sorted(holders, key=len)[:3]
                continue
        # cells the reading ran into one line (invented: "quiet lantern-keeper gruff fen-walker merry,
        # bog-singer"): carried when the line splits into consecutive pieces the pack holds, each 2+ words and
        # 12+ characters (so common words can't cover a line)
        pieces = cover(n, index)
        if pieces and len(pieces) >= 2:
            u["status"] = "value"
            u["matches"] = []
            u["covered"] = pieces
            continue
        if found or held:
            u["status"] = "partial"
            u["matches"] = sorted(set(paths + held))[:6]
            u["missing"] = missing if found else [n]
            u["coverage"] = round(sum(len(p) for p in found) / max(len(n), 1), 2)
        else:
            u["status"] = "unmapped"


def map_reverse(strings, flow):
    """Sets status/units/missing on each pack string (in place). Returns {unit_id: [pack paths held in it]}."""
    held_by = defaultdict(list)
    for s in strings:
        q = s["n"]
        if len(q) < 4:
            s["status"] = "short"
            continue
        positions = flow.find(q) or flow.find(q.rstrip(".:;"))
        if positions:
            s["status"] = "verbatim"
            ids = sorted({uid for p in positions[:3] for uid in flow.units_at(p, len(q))})
            s["units"] = ids[:8]
            # a string that runs across a section heading in every place it occurs is a run-on (it carries the
            # next section's text as well as its own)
            first = flow.units_at(positions[0], len(q))[0]
            crossing = [uid for uid in flow.units_at(positions[0], len(q))[1:]
                        if flow.kind_of(uid) == "heading" and not flow.inside(first, uid)]
            if crossing and len(q) >= 80 and all(
                    any(flow.kind_of(u) == "heading" and not flow.inside(flow.units_at(p, len(q))[0], u)
                        for u in flow.units_at(p, len(q))[1:]) for p in positions[:3]):
                s["crosses"] = crossing[:3]
                s["crossesLevel"] = min(flow.level_of(u) for u in crossing)
            if s["rules"] and len(q) >= 40:
                for uid in ids:
                    held_by[uid].append(s["path"])
            continue
        parts = sentences(q)
        found, missing, ids = [], [], set()
        # each sentence's place is the one nearest the sentences before it, so a passage the pack took from one
        # place is not read as stitched across the book; short labels ("Time:") occur everywhere and anchor nothing
        hits, anchor = [], None
        for p in parts:
            positions = flow.find(p) or flow.find(p.rstrip(".:;"))
            if positions:
                found.append(p)
                hits.append((p, positions))
            else:
                missing.append(p)
        long = [(p, positions) for p, positions in hits if len(p) >= 12]
        if long:
            best = None
            for start in long[0][1]:
                chain, anchor, spread = [], start, 0
                for p, positions in long:
                    chosen = min(positions, key=lambda x: abs(x - anchor))
                    spread += abs(chosen - anchor)
                    anchor = chosen
                    chain.append((chosen, len(p)))
                if best is None or spread < best[0]:
                    best = (spread, chain)
            for pos, length in best[1]:
                ids.update(flow.units_at(pos, length))
        elif hits:
            ids.update(flow.units_at(hits[0][1][0], len(hits[0][0])))
        if found and not missing and len(parts) > 1:
            s["status"] = "stitched"
            # stitched across a section heading: the string carries another section's sentences (a run-on)
            order = flow.order_of(ids)
            if order:
                first = flow.units[min(order)]["id"]
                between = [u for u in flow.units[min(order):max(order) + 1]
                           if flow.kind_of(u["id"]) == "heading" and not flow.inside(first, u["id"])]
                if between and len(q) >= 80:
                    s["crosses"] = [u["id"] for u in between][:3]
                    s["crossesLevel"] = min(u.get("level", 9) for u in between)
        elif found:
            s["status"] = "partial"
            s["missing"] = missing
        else:
            nums = re.findall(r"\d+", q)
            holder = flow.unit_with_numbers(nums) if len(nums) >= 2 else None
            if holder:
                s["status"] = "values"
                ids.add(holder)
            else:
                s["status"] = "unmapped"
        s["units"] = sorted(ids)[:8]
    return held_by


def letters(s):
    """Letters and digits only, lower-cased: what survives any reading fault (spaces, hyphens, dashes, line and
    column breaks inside a passage)."""
    s = unicodedata.normalize("NFKC", s).replace("­", "").lower()
    return re.sub(r"[^a-z0-9]", "", s)


def page_check(strings, pages):
    """A pack string the units call not the book's (or partly) whose letters run unbroken through a printed page's
    raw text IS the book's words: the units split it (a column break, a wrapped cell, a page reference). Marked
    `readerSplit`; strings under 20 letters are left alone (too short to prove anything)."""
    if not pages:
        return
    text = "|".join(letters(t) for t in pages)
    for s in strings:
        if not s["rules"] or s.get("status") not in ("unmapped", "partial"):
            continue
        whole = letters(s["text"])
        paras = [letters(x) for x in s["text"].split("\n") if letters(x)]
        if len(whole) >= 20 and whole in text:
            s["status"], s["readerSplit"] = "verbatim", True
            s.pop("missing", None)
        elif len(paras) > 1 and [x for x in paras if len(x) >= 12] and all(x in text for x in paras):
            # a panel entry of several printed paragraphs, every one unbroken on a page (columns put them apart);
            # at least one 12+ letters long, so short labels alone can't prove it
            s["status"], s["readerSplit"] = "stitched", True
            s.pop("missing", None)
        elif s["status"] == "partial" and s.get("missing") and all(
                len(letters(m)) >= 12 and letters(m) in text for m in s["missing"]):
            s["status"], s["readerSplit"] = "stitched", True
            s.pop("missing", None)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("inputs", nargs="+", help="one or more units.json then the pack")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    *unit_files, pack_file = a.inputs
    pack = json.load(open(pack_file, encoding="utf-8"))
    units, books, raw = [], [], []
    for f in unit_files:
        d = json.load(open(f, encoding="utf-8"))
        books.append({"book": d["book"], "file": d["file"]})
        raw.extend(d.get("pageText", {}).values())
        for u in d["units"]:
            u["n"] = norm(u["text"])
            units.append(u)
    strings, entities, names = collect_pack(pack)
    index = Index([s["n"] for s in strings])
    flow = Flow(units)
    held_by = map_reverse(strings, flow)
    page_check(strings, raw)
    map_forward(units, strings, entities, names, index, held_by)
    # the same rules text in two places of the pack
    first = {}
    for s in strings:
        if s["rules"] and len(s["n"]) >= 80:
            if s["n"] in first:
                s["duplicateOf"] = first[s["n"]]
            else:
                first[s["n"]] = s["path"]
    fwd = Counter(u["status"] for u in units)
    rev = Counter(s["status"] for s in strings if s["rules"])
    out = {"pack": pack_file, "packVersion": pack.get("meta", {}).get("version"), "books": books,
           "units": [{k: v for k, v in u.items() if k != "n"} for u in units],
           "packStrings": [{k: v for k, v in s.items() if k != "n"} for s in strings],
           "summary": {"forward": dict(fwd), "reverse": dict(rev)}}
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(units)} units, {len(strings)} pack strings ({sum(s['rules'] for s in strings)} rules) -> {a.out}")
    print("  forward:", ", ".join(f"{k} {v}" for k, v in sorted(fwd.items())))
    print("  reverse (rules strings):", ", ".join(f"{k} {v}" for k, v in sorted(rev.items())))


if __name__ == "__main__":
    main()
