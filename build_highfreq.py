"""【高頻篩選】自 questions_all.json（110～114 年 400 題全集）篩出高頻考題並產生核心記憶卡。

用法：python -X utf8 build_highfreq.py          （產生 questions.json、questions.js、core_cards.js）
      python -X utf8 build_highfreq.py --report （只印統計，不寫檔）

高頻定義：同一「法規＋條號（節、點）」在 110～114 年被 2 題以上引用（依各題 law 欄位解析）。
- 題目的 law 欄位只要有一個條號屬高頻，該題即保留。
- 核心記憶卡：每個高頻條號一張，內容逐字取自該條各題的 analysis_key（不另行改寫），並標出處題號。
- 條文命題（nlm_questions_all.js）與翻牌卡（flashcards_all.js）：只留條號屬高頻者；新修法專題與標註「修正」的卡全留。
改完須再跑 python bundle.py。
"""
import collections
import json
import os
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.abspath(__file__))
MIN_HITS = 2

ART = re.compile(r"第\s*([\d.]+)\s*(條|節|點)(?:\s*之\s*(\d+))?|§\s*([\d.]+(?:-\d+)?)")
SUB = re.compile(r"第[\d一二三四五六七八九十]+[項款目]|至|但書|前段|後段|附表[一二三四五六七八九十\d]*")
PAREN = re.compile(r"[（(][^）)]*[）)]?")
NAME_PREFIX = re.compile(r"^(及|與|暨|或|對比|原|依|行政院公共工程委員會)+")


def parse_law(law):
    """回傳 [(法規名, 條號)]；沒寫條號的法規回傳 (法規名, '')。"""
    keys, name, pos = [], "", 0
    for m in ART.finditer(law):
        between = law[pos:m.start()]
        pos = m.end()
        quoted = re.findall(r"《([^》]+)》", between)
        if quoted:
            name = quoted[-1]
        else:
            cand = re.sub(r"[、，,；;：:\s／/]", "", SUB.sub("", PAREN.sub("", between)))
            cand = NAME_PREFIX.sub("", cand)
            if len(cand) >= 3 and re.search(r"[法則例準編範點約]$", cand):
                name = cand
        if m.group(4):
            art = "§" + m.group(4)
        else:
            art = ("§" if m.group(2) == "條" else "") + m.group(1) + ("-" + m.group(3) if m.group(3) else "")
        if name:
            keys.append((re.sub(r"\s", "", name), art))
    if not keys:
        bare = re.sub(r"[《》\s]", "", PAREN.sub("", law))
        if bare:
            keys.append((bare, ""))
    return list(dict.fromkeys(keys))


ALIAS = [
    ("建築技術規則建築設計施工編", ("建築技術規則建築設計施工編", "建築技術規則施工編", "建築設計施工編")),
    ("建築物無障礙設施設計規範", ("無障礙設施設計規範", "無障礙設計規範")),
    ("都市危險及老舊建築物加速重建條例", ("危老條例",)),
    ("公共工程施工品質管理作業要點", ("公共工程品管要點",)),
    ("機關委託技術服務廠商評選及計費辦法", ("技服辦法",)),
]
LOOSE_NUM = re.compile(r"(\d+(?:\.\d+)*(?:-\d+)?)(?![\d.]*[項款目年月日])")


def canon(name):
    for full, alts in ALIAS:
        if any(a in name for a in alts):
            return full
    return name


def parse_loose(law):
    """條文命題與翻牌卡的 law 欄位寫法不一（§79、第79條、304.1、簡稱），寬鬆解析成 {(法規全名, 條號)}。"""
    s = PAREN.sub("", law)
    s = re.sub(r"第\s*(\d+)\s*條之\s*(\d+)", r"\1-\2", s)
    keys, name, pos = set(), "", 0
    for m in LOOSE_NUM.finditer(s):
        cand = re.sub(r"[^一-鿿]", "", SUB.sub("", s[pos:m.start()]))
        cand = re.sub(r"[第之及與或至]+$", "", NAME_PREFIX.sub("", cand))
        pos = m.end()
        if cand == "施行細則" and name:
            name = name + "施行細則"
        elif len(cand) >= 3:
            name = canon(cand)
        if name:
            keys.add((name, m.group(1)))
    return keys


def is_high(law, high_keys):
    """條號相同即高頻；無障礙規範另接受同節上下層（如 206.3.2 對 206.3）。"""
    for name, art in parse_loose(law):
        for hname, hart in high_keys:
            if name != hname:
                continue
            if art == hart:
                return True
            if "規範" in name and (art.startswith(hart + ".") or hart.startswith(art + ".")):
                return True
    return False


def load_js_array(name):
    """讀 `const X = [ ... ];` 形式的 js 檔，回傳 (檔頭至 '[' 之前的文字, 陣列)。"""
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        text = fh.read()
    start = text.index("[", text.index("const "))
    return text[:start], json.loads(text[start:text.rindex("]") + 1])


def write_js_array(name, head, items):
    with open(os.path.join(ROOT, name), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(head + json.dumps(items, ensure_ascii=False, indent=2) + ";\n")


def main():
    with open(os.path.join(ROOT, "questions_all.json"), encoding="utf-8") as fh:
        allq = json.load(fh)

    by_key = collections.defaultdict(list)
    for q in allq:
        for k in parse_law(q.get("law") or ""):
            by_key[k].append(q)
    high = {k: v for k, v in by_key.items() if len(v) >= MIN_HITS}
    keep_ids = {q["id"] for v in high.values() for q in v}
    kept = [q for q in allq if q["id"] in keep_ids]

    cards = []
    for (name, art), qs in high.items():
        cat = collections.Counter((q["cat_id"], q["cat_name"]) for q in qs).most_common(1)[0][0]
        points, seen = [], set()
        for q in sorted(qs, key=lambda x: (-x["year"], x["q_num"])):
            text = (q.get("analysis_key") or "").strip()
            if text and text not in seen:
                seen.add(text)
                points.append({"src": "%d-%02d" % (q["year"], q["q_num"]), "text": text})
        if not points:
            continue
        cards.append({
            "law": name + (" " + art if art else ""),
            "cat_id": cat[0], "cat_name": cat[1],
            "hits": len(qs),
            "years": sorted({q["year"] for q in qs}, reverse=True),
            "points": points,
        })
    cards.sort(key=lambda c: (c["cat_id"], -c["hits"], c["law"]))
    for i, c in enumerate(cards, 1):
        c["id"] = "K%03d" % i

    print("【高頻篩選】")
    print("  全集 %d 題；條號 %d 個，其中高頻（≥%d 題）%d 個" % (len(allq), len(by_key), MIN_HITS, len(high)))
    print("  保留 %d 題；核心記憶卡 %d 張" % (len(kept), len(cards)))
    print("  各年保留：", dict(sorted(collections.Counter(q["year"] for q in kept).items())))
    print("  各專題卡數：", dict(sorted(collections.Counter(c["cat_name"] for c in cards).items())))

    # 條文命題與翻牌卡：只留條號屬高頻者；新修法專題（q_num >= 201）全留
    high_keys = {(canon(n), a.lstrip("§")) for n, a in high}
    nlm_head, nlm_all = load_js_array("nlm_questions_all.js")
    nlm_kept = [q for q in nlm_all if q["q_num"] >= 201 or is_high(q.get("law") or "", high_keys)]
    fc_head, fc_all = load_js_array("flashcards_all.js")
    fc_kept = [c for c in fc_all if "修正" in (c.get("law") or "") or is_high(c.get("law") or "", high_keys)]
    print("  條文命題 %d → %d 題（含新修法 %d 題）；翻牌卡 %d → %d 張" % (
        len(nlm_all), len(nlm_kept), sum(q["q_num"] >= 201 for q in nlm_kept), len(fc_all), len(fc_kept)))

    if "--report" in sys.argv:
        print("  保留條文命題：", "、".join("%s %s" % (q["id"], q["law"]) for q in nlm_kept if q["q_num"] < 201))
        print("  保留翻牌卡：", "、".join("%s %s" % (c["id"], c["law"]) for c in fc_kept))
        print("  刪除翻牌卡：", "、".join("%s %s" % (c["id"], c["law"]) for c in fc_all if c not in fc_kept))
        for c in cards:
            print("  %s %s｜%d 題｜%s" % (c["id"], c["law"], c["hits"], "、".join(p["src"] for p in c["points"])))
        noart = [q["id"] + " " + q["law"] for q in allq if all(a == "" for _, a in parse_law(q.get("law") or ""))]
        print("  無條號題 %d：" % len(noart), noart)
        return

    dump = json.dumps(kept, ensure_ascii=False, indent=2)
    with open(os.path.join(ROOT, "questions.json"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(dump + "\n")
    with open(os.path.join(ROOT, "questions.js"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("const RAW_QUESTIONS = " + dump + ";\n")
    with open(os.path.join(ROOT, "core_cards.js"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("// 核心記憶卡：由 build_highfreq.py 自 questions_all.json 產生，勿手改\n")
        fh.write("const CORE_CARDS = " + json.dumps(cards, ensure_ascii=False, indent=2) + ";\n")
    write_js_array("nlm_questions.js", nlm_head, nlm_kept)
    write_js_array("flashcards.js", fc_head, fc_kept)
    print("  已寫入 questions.json、questions.js、core_cards.js、nlm_questions.js、flashcards.js")


if __name__ == "__main__":
    main()
