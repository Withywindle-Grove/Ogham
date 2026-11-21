"""The triage helper: for every unmapped and partial unit not yet triaged, a short list per chapter a reader can
decide quickly (unit text, the nearest pack strings, a proposed decision), and a proposals file to edit into
triage.json.

Usage: py triage_list.py map.json [--triage triage.json] --out triage-list.md [--proposals triage-proposed.json]

Proposed decisions (a person or a model confirms them; nothing is omitted without a reason):
- out-of-scope     the chapter is front or back matter (contents, index, licence, introduction)
- cross-reference  a "see X, pNN" pointer and nothing else
- legend           a table footnote mark line ("* ...", "† ...")
- structure        a heading
- example          a worked example (its heading or text says so)
- fix              the text is close to a pack string (paraphrased) or absent: a real miss to fix
"""
import argparse
import json
import re
import sys
from collections import defaultdict

from score import load_triage, omission

FRONT_MATTER = re.compile(r"contents|index|licen[cs]e|introduction|designation|credits|tome$", re.I)


def word_index(strings):
    idx = defaultdict(set)
    for i, s in enumerate(strings):
        for w in set(re.findall(r"[a-z]{5,}", s["text"].lower())):
            idx[w].add(i)
    return idx


def nearest(unit, strings, idx, k=2):
    words = set(re.findall(r"[a-z]{5,}", unit["text"].lower()))
    if not words:
        return []
    votes = defaultdict(int)
    for w in words:
        for i in idx.get(w, ()):
            votes[i] += 1
    best = sorted(votes.items(), key=lambda kv: (-kv[1], len(strings[kv[0]]["text"])))[:k]
    return [(round(v / len(words), 2), strings[i]["path"], strings[i]["text"]) for i, v in best]


def propose(unit, near):
    chapter = unit["path"][0] if unit["path"] else ""
    text = unit["text"]
    if FRONT_MATTER.search(chapter) or not unit["path"]:
        return "out-of-scope", f"chapter: {chapter or 'front matter'}"
    if unit["kind"] == "heading":
        return "structure", "a heading"
    if re.match(r"^(see|refer to)\b.*\bp\s?\d+", text, re.I) and len(text) < 120:
        return "cross-reference", "a page pointer"
    if re.match(r"^[*†‡]", text):
        return "legend", "a table footnote"
    if re.search(r"\bexample\b", " ".join(unit["path"][-2:]) + " " + text[:40], re.I):
        return "example", "a worked example"
    if near and near[0][0] >= 0.6:
        return "fix", f"paraphrased? nearest {near[0][1]} ({near[0][0]})"
    return "fix", "missing"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("map")
    ap.add_argument("--triage")
    ap.add_argument("--out", required=True)
    ap.add_argument("--proposals")
    ap.add_argument("--max-per-chapter", type=int, default=400)
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    m = json.load(open(a.map, encoding="utf-8"))
    triage = load_triage(a.triage)
    strings = m["packStrings"]
    idx = word_index(strings)
    by_ch, proposals = defaultdict(list), {"units": {}, "paths": [], "pages": [], "tables": [], "pack": {}}
    seen_tables, seen_chapters = set(), set()
    for u in m["units"]:
        if u["status"] not in ("unmapped", "partial") or omission(u, triage):
            continue
        chapter = u["path"][0] if u["path"] else "(front matter)"
        if u["kind"] == "cell":
            key = (u["id"][:1], u["page"], u.get("table"))
            if key in seen_tables:
                continue
            seen_tables.add(key)
        near = nearest(u, strings, idx) if u["kind"] != "cell" else []
        decision, why = propose(u, near)
        by_ch[chapter].append((u, near, decision, why))
        if decision == "out-of-scope":
            if chapter not in seen_chapters:
                seen_chapters.add(chapter)
                proposals["paths"].append({"prefix": [chapter], "omit": "out-of-scope", "reason": why})
        elif decision != "fix":
            proposals["units"][u["id"]] = {"omit": decision, "reason": why}
    L = ["# Triage list\n", "For each unit: id, page, kind, status; its text; the nearest pack strings; a proposed decision. "
         "Confirm or change, then record the omissions in triage.json (see score.py).\n"]
    for ch in sorted(by_ch, key=lambda c: -len(by_ch[c])):
        items = by_ch[ch]
        L.append(f"## {ch} ({len(items)})\n")
        for u, near, decision, why in items[:a.max_per_chapter]:
            extra = ""
            if u["kind"] == "cell":
                extra = f" table “{u.get('table')}” (first unmapped cell shown; row {u.get('row')} col {u.get('col')})"
            L.append(f"- `{u['id']}` p{u['page']} {u['kind']} {u['status']}{extra} → **{decision}** ({why})")
            L.append(f"  - “{u['text'][:220]}”")
            if u.get("missing"):
                L.append(f"  - missing: " + " | ".join(x[:100] for x in u["missing"][:3]))
            for score, path, text in near:
                L.append(f"  - near {score}: `{path}` “{text[:120]}”")
        if len(items) > a.max_per_chapter:
            L.append(f"- … and {len(items) - a.max_per_chapter} more")
        L.append("")
    open(a.out, "w", encoding="utf-8").write("\n".join(L))
    if a.proposals:
        json.dump(proposals, open(a.proposals, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{sum(len(v) for v in by_ch.values())} units to triage in {len(by_ch)} chapters -> {a.out}")


if __name__ == "__main__":
    main()
