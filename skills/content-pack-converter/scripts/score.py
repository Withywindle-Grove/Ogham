"""The scorecard: per chapter and overall, how much of the printed book the pack carries, and what it misses
(the scorecard's third step).

Usage: py score.py map.json [--triage triage.json] --out scorecard.md [--max-big 400]

Counts, per chapter: units mapped exactly / by value / partially / unmapped / omitted by triage; pack strings with no
source. Misses are graded:
- big    a missing rule or entry (an unmapped paragraph or list item of six words or more, or with a number), a
         missing or wrong value (an unmapped cell in a row the pack has), a missing row or table, a cut-off text (a
         partial unit whose missing sentences carry a number or eight words or more), invented or paraphrased text
         in a rules field (an unmapped pack string of six words or more, or a partial one missing such a sentence)
- small  a label, a heading, a short unit without a number, a short paraphrase, a cut sentence without a number

triage.json records the decisions for unmapped and partial units so only real misses count; every omission has a
reason a person can check:
  {"units": {"P012.003": {"omit": "example", "reason": "worked example of the rule above"}},
   "paths": [{"prefix": ["Introduction"], "omit": "out-of-scope", "reason": "...", "kinds": ["para", "list"]}],
   (kinds is optional: without it every kind under the prefix is omitted)
   "pages": [{"book": "P", "from": 1, "to": 5, "omit": "out-of-scope", "reason": "contents pages"}],
   "tables": [{"book": "R", "page": 150, "table": "Gem Values", "omit": "duplicate-of R149.010", "reason": "..."}],
   "pack": {"hooks": {"keep": "app logic, not book text"}, "items[3].notes": {"keep": "..."}}}
Omit kinds: art | flavour-box | example | cross-reference | out-of-scope | duplicate-of <unit> | structure | legend.
"""
import argparse
import json
import re
import sys
from collections import Counter, defaultdict

WORDS = lambda s: len(re.findall(r"[A-Za-z0-9’']+", s))  # noqa: E731
MODELLING_NOTE = re.compile(r"\b(the books?|the volumes?|the pack|the app|ruled \d{4}|07 has|the format|the GM uses|our own)\b", re.I)
HAS_DIGIT = lambda s: bool(re.search(r"\d", s))  # noqa: E731


def load_triage(path):
    if not path:
        return {"units": {}, "paths": [], "pages": [], "tables": [], "pack": {}, "duplicates": []}
    t = json.load(open(path, encoding="utf-8"))
    for k, default in (("units", {}), ("paths", []), ("pages", []), ("tables", []), ("pack", {}), ("duplicates", [])):
        t.setdefault(k, default)
    return t


def omission(unit, triage):
    """(omit kind, reason) when triage omits this unit, else None."""
    d = triage["units"].get(unit["id"])
    if d:
        return d.get("omit", "omitted"), d.get("reason", "")
    for p in triage["pages"]:
        if unit["id"][:1] == p.get("book", unit["id"][:1]) and p["from"] <= unit["page"] <= p["to"]:
            return p.get("omit", "out-of-scope"), p.get("reason", "")
    for p in triage["paths"]:
        pre = p["prefix"]
        if "kinds" in p and unit["kind"] not in p["kinds"]:
            continue
        if unit["path"][:len(pre)] == pre:
            return p.get("omit", "out-of-scope"), p.get("reason", "")
    if unit["kind"] == "cell":
        for t in triage["tables"]:
            if unit["id"][:1] == t.get("book", unit["id"][:1]) and unit["page"] == t["page"] \
                    and unit.get("table") == t["table"]:
                return t.get("omit", "omitted"), t.get("reason", "")
    return None


def duplicate_by_design(path, other, triage):
    """triage["duplicates"]: [{"path": regex, "other": regex, "reason"}]: text the pack repeats on purpose (a monster
    group's text on each variant, a general rule as each magic weapon's notes). Only the duplicate flag goes; the
    string is still checked against the book."""
    for d in triage.get("duplicates", []):
        if re.fullmatch(d["path"], path) and re.fullmatch(d.get("other", d["path"]), other):
            return d.get("reason", "by design")
    return None


def pack_kept(path, triage):
    for key, d in triage["pack"].items():
        if path == key or path.startswith(key + ".") or path.startswith(key + "["):
            return d.get("keep", "kept")
    return None


def grade_units(units, triage):
    """Returns (rows, misses): rows = {chapter: Counter}, misses = [(grade, chapter, unit, why)]."""
    rows, misses = defaultdict(Counter), []
    # rows and tables, to grade a wholly missing row or table once
    by_row, by_table = defaultdict(list), defaultdict(list)
    for u in units:
        if u["kind"] == "cell":
            key = (u["id"][:1], u["page"], u.get("table"))
            by_table[key].append(u)
            by_row[key + (u.get("row"),)].append(u)
    table_gone, row_gone, reported = set(), set(), set()
    for key, cells in by_table.items():
        live = [c for c in cells if c["status"] != "blank"]
        if live and all(c["status"] == "unmapped" for c in live):
            table_gone.add(key)
    for key, cells in by_row.items():
        live = [c for c in cells if c["status"] != "blank"]
        if live and all(c["status"] == "unmapped" for c in live):
            row_gone.add(key)

    for u in units:
        chapter = u["path"][0] if u["path"] else "(front matter)"
        r = rows[chapter]
        status = u["status"]
        if status == "blank":
            r["blank"] += 1
            continue
        om = omission(u, triage)
        if om:
            r["omitted"] += 1
            r["omit:" + om[0].split()[0]] += 1
            continue
        r["units"] += 1
        r[status] += 1
        kind, text = u["kind"], u["text"]
        if status in ("exact", "value"):
            continue
        if status == "unmapped":
            if kind == "heading":
                misses.append(("small", chapter, u, "heading not in the pack (structure)"))
            elif kind == "label":
                misses.append(("small", chapter, u, "label not in the pack"))
            elif kind == "cell":
                tkey = (u["id"][:1], u["page"], u.get("table"))
                rkey = tkey + (u.get("row"),)
                if tkey in table_gone:
                    if tkey not in reported:
                        reported.add(tkey)
                        misses.append(("big", chapter, u, f"missing table: {u.get('table')} "
                                       f"({len([c for c in by_table[tkey] if c['status'] != 'blank'])} cells)"))
                    else:
                        r["(in a missing table)"] += 1
                elif rkey in row_gone:
                    if rkey not in reported:
                        reported.add(rkey)
                        misses.append(("big", chapter, u, f"missing row {u.get('row')} of {u.get('table')}"))
                    else:
                        r["(in a missing row)"] += 1
                elif len(text.strip(" .")) <= 2:
                    misses.append(("small", chapter, u, f"tiny cell not found: {u.get('table')} row {u.get('row')} col {u.get('col')}"))
                else:
                    misses.append(("big", chapter, u, f"missing or wrong value: {u.get('table')} row {u.get('row')} "
                                   f"col {u.get('col')} (nearest: {', '.join(u.get('nearest', [])) or 'none'})"))
            elif WORDS(text) >= 6 or (HAS_DIGIT(text) and WORDS(text) >= 4):
                misses.append(("big", chapter, u, "missing rule or entry"))
            else:
                misses.append(("small", chapter, u, "short text not in the pack"))
        elif status == "partial":
            missing = u.get("missing", [])
            bad = [m for m in missing if HAS_DIGIT(m) or WORDS(m) >= 8]
            if bad and u.get("coverage", 0) < 0.9:
                misses.append(("big", chapter, u, "cut-off or run-on: missing " + " | ".join(m[:120] for m in bad)))
            else:
                misses.append(("small", chapter, u, "partly in the pack: missing " + " | ".join(m[:80] for m in missing)))
    for grade, chapter, _, _ in misses:
        rows[chapter][grade] += 1
    return rows, misses


def grade_pack(strings, triage):
    rows, misses = defaultdict(Counter), []
    for s in strings:
        if not s["rules"]:
            continue
        group = s["path"].split(".")[0].split("[")[0]
        r = rows[group]
        kept = pack_kept(s["path"], triage)
        if not kept and s["status"] == "unmapped" and MODELLING_NOTE.search(s["text"]):
            kept = "a modelling note that names the book, the pack, the app or a ruling"
        if kept:
            r["kept"] += 1
            continue
        r["strings"] += 1
        r[s["status"]] += 1
        if s.get("duplicateOf"):
            if duplicate_by_design(s["path"], s["duplicateOf"], triage):
                r["duplicateByDesign"] += 1
            else:
                misses.append(("small", group, s, "duplicate: the same text is at " + s["duplicateOf"]))
        if s["status"] == "unmapped":
            grade = "big" if WORDS(s["text"]) >= 6 else "small"
            misses.append((grade, group, s, "not the book's words (invented or paraphrased)"))
        elif s.get("crosses"):
            grade = "big" if s.get("crossesLevel", 3) <= 2 else "small"
            misses.append((grade, group, s, "run-on or joined across sections: the text crosses a heading (" + ", ".join(s["crosses"]) + ")"))
        elif s["status"] == "partial":
            bad = [m for m in s.get("missing", []) if HAS_DIGIT(m) or WORDS(m) >= 8]
            grade = "big" if bad else "small"
            misses.append((grade, group, s, "a sentence that isn't the book's: " + " | ".join(m[:100] for m in s.get("missing", []))))
    for grade, group, _, _ in misses:
        rows[group][grade] += 1
    return rows, misses


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "–"


def write_scorecard(m, triage, out, max_big):
    units, strings = m["units"], m["packStrings"]
    rows, misses = grade_units(units, triage)
    prow, pmisses = grade_pack(strings, triage)
    tot = Counter()
    for r in rows.values():
        tot.update(r)
    ptot = Counter()
    for r in prow.values():
        ptot.update(r)
    big = [x for x in misses if x[0] == "big"]
    small = [x for x in misses if x[0] == "small"]
    pbig = [x for x in pmisses if x[0] == "big"]
    psmall = [x for x in pmisses if x[0] == "small"]
    mapped = tot["exact"] + tot["value"]
    L = []
    L.append(f"# Scorecard: {m.get('pack')} (version {m.get('packVersion')})\n")
    L.append("Books: " + "; ".join(f"{b['book']} = {b['file']}" for b in m["books"]) + "\n")
    L.append("## The two numbers\n")
    L.append(f"- **Printed units carried: {pct(mapped, tot['units'])}** ({mapped} of {tot['units']} scored units are in the "
             f"pack exactly or as a value; {tot['partial']} partly, {tot['unmapped']} not at all; {tot['omitted']} omitted "
             f"by triage with a reason, {tot['blank']} blank cells not counted)")
    L.append(f"- **Big misses: {len(big)}** (small: {len(small)})")
    L.append(f"- Pack rules strings that are the book's words: {pct(ptot['verbatim'] + ptot['stitched'] + ptot['values'], ptot['strings'])} "
             f"({ptot['verbatim']} verbatim, {ptot['stitched']} stitched from several places, {ptot['values']} a compact form "
             f"of a printed line, {ptot['partial']} partly, {ptot['unmapped']} not the book's; {ptot['kept']} kept by triage "
             f"or modelling notes, {ptot['short']} too short to judge)")
    dbd = sum(r["duplicateByDesign"] for r in prow.values())
    L.append(f"- Pack-side big misses: {len(pbig)} (small: {len(psmall)}; repeated on purpose, by triage: {dbd})\n")
    L.append("## Per chapter (book → pack)\n")
    L.append("| Chapter | Units | Exact | Value | Partial | Unmapped | Omitted | Big | Small |")
    L.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for ch in sorted(rows, key=lambda c: -rows[c]["units"]):
        r = rows[ch]
        L.append(f"| {ch} | {r['units']} | {r['exact']} | {r['value']} | {r['partial']} | {r['unmapped']} | {r['omitted']} | "
                 f"{r['big']} | {r['small']} |")
    L.append(f"| **All** | {tot['units']} | {tot['exact']} | {tot['value']} | {tot['partial']} | {tot['unmapped']} | "
             f"{tot['omitted']} | {len(big)} | {len(small)} |\n")
    om = Counter()
    for k, v in tot.items():
        if k.startswith("omit:"):
            om[k[5:]] = v
    if om:
        L.append("Omitted by triage: " + ", ".join(f"{k} {v}" for k, v in om.most_common()) + "\n")
    L.append("## Per group (pack → book)\n")
    L.append("| Pack group | Rules strings | Verbatim | Stitched | Values | Partial | Not the book's | Kept | Big | Small |")
    L.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for g in sorted(prow, key=lambda g: -prow[g]["strings"]):
        r = prow[g]
        L.append(f"| {g} | {r['strings']} | {r['verbatim']} | {r['stitched']} | {r['values']} | {r['partial']} | {r['unmapped']} | "
                 f"{r['kept']} | {r['big']} | {r['small']} |")
    L.append("")
    L.append(f"## Big misses, book → pack ({len(big)}; first {min(len(big), max_big)})\n")
    by_ch = defaultdict(list)
    for x in big:
        by_ch[x[1]].append(x)
    shown = 0
    for ch in sorted(by_ch, key=lambda c: -len(by_ch[c])):
        L.append(f"### {ch} ({len(by_ch[ch])})\n")
        for _, _, u, why in by_ch[ch]:
            if shown >= max_big:
                break
            shown += 1
            where = " > ".join(u["path"][1:])[:70]
            L.append(f"- `{u['id']}` p{u['page']} {u['kind']} [{where}] {why}: “{u['text'][:160]}”")
        L.append("")
    L.append(f"## Big misses, pack → book ({len(pbig)})\n")
    for _, g, s, why in pbig[:max_big]:
        L.append(f"- `{s['path']}` {why}: “{s['text'][:160]}”")
    L.append("")
    L.append(f"## Small misses ({len(small)} book → pack, {len(psmall)} pack → book): counts per kind\n")
    kinds = Counter((x[2]["kind"], x[3].split(":")[0]) for x in small)
    for (k, why), v in kinds.most_common():
        L.append(f"- {k}: {why}: {v}")
    pk = Counter(x[3].split(":")[0] for x in psmall)
    for why, v in pk.most_common():
        L.append(f"- pack: {why}: {v}")
    L.append("")
    open(out, "w", encoding="utf-8").write("\n".join(L))
    json.dump({"big": [{"id": u["id"], "page": u["page"], "kind": u["kind"], "chapter": ch, "why": why, "text": u["text"]}
                       for _, ch, u, why in big],
               "small": [{"id": u["id"], "page": u["page"], "kind": u["kind"], "chapter": ch, "why": why, "text": u["text"]}
                         for _, ch, u, why in small],
               "packBig": [{"path": s["path"], "why": why, "text": s["text"]} for _, _, s, why in pbig],
               "packSmall": [{"path": s["path"], "why": why, "text": s["text"]} for _, _, s, why in psmall]},
              open(re.sub(r"\.md$", "", out) + "-misses.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    return mapped, tot["units"], len(big), len(small)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("map")
    ap.add_argument("--triage")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-big", type=int, default=400)
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    m = json.load(open(a.map, encoding="utf-8"))
    triage = load_triage(a.triage)
    mapped, scored, big, small = write_scorecard(m, triage, a.out, a.max_big)
    print(f"{a.out}: {mapped}/{scored} units carried ({pct(mapped, scored)}), big misses {big}, small {small}")


if __name__ == "__main__":
    main()
