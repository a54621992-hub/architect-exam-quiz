"""【法規APP推送檢查】推送前驗證題庫資料與單檔版（.prepush-test 呼叫，D204）。

用法：python tests/check_app.py      （在 repo 根目錄或任何位置皆可）
檢查：
1. questions.json 與 questions.js 內容相同；歷屆題 id 不重複、答案在選項內（或 # 一律給分）。
2. nlm_questions.js、flashcards.js 可載入；id 不重複；條文命題答案在選項內。
3. 各 js 與 index_bundle.html 內嵌腳本通過 node --check（防 bundle 換行跳脫 SyntaxError）。
4. index_bundle.html 已含最新 questions.js／nlm_questions.js／flashcards.js／app.js（改題庫忘了跑 bundle.py 會被擋）。
需要 node。任一項失敗 exit 1。
"""
import json
import os
import re
import subprocess
import sys
import tempfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        return fh.read().replace("\r\n", "\n")


def node_eval(name, var):
    """以 node 載入 js 檔，回傳指定常數的 JSON。"""
    code = ("const fs=require('fs');const vm=require('vm');const c={};vm.createContext(c);"
            "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.__x=%s;',c);"
            "process.stdout.write(JSON.stringify(c.__x));" % var)
    r = subprocess.run(["node", "-e", code, os.path.join(ROOT, name)],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        errors.append("%s 載入失敗：%s" % (name, r.stderr.strip()[:300]))
        return []
    return json.loads(r.stdout)


def node_check(path, label):
    r = subprocess.run(["node", "--check", path], capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        errors.append("%s 語法錯誤：%s" % (label, r.stderr.strip()[:300]))


def check_questions(items, label, allow_hash):
    ids = [q.get("id") for q in items]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        errors.append("%s id 重複：%s" % (label, dup[:10]))
    for q in items:
        ans, opts = q.get("answer"), q.get("options") or {}
        if allow_hash and ans == "#":
            continue
        if ans not in opts:
            errors.append("%s %s 答案 %r 不在選項 %s" % (label, q.get("id"), ans, list(opts)))
    print("  %s：%d 題" % (label, len(items)))


print("【法規APP推送檢查】")
qjson = json.loads(read("questions.json"))
qjs = node_eval("questions.js", "RAW_QUESTIONS")
if qjs != qjson:
    errors.append("questions.js 與 questions.json 內容不同（兩檔須同步）")
check_questions(qjson, "歷屆題", True)
check_questions(node_eval("nlm_questions.js", "NLM_QUESTIONS"), "條文命題", False)
fc = node_eval("flashcards.js", "FLASHCARDS")
fc_ids = [c.get("id") for c in fc]
if len(fc_ids) != len(set(fc_ids)):
    errors.append("翻牌卡 id 重複")
print("  翻牌卡：%d 張" % len(fc))

cards = node_eval("core_cards.js", "CORE_CARDS")
past_ids = {"%d-%02d" % (q["year"], q["q_num"]): q for q in qjson}
for c in cards:
    for p in c["points"]:
        src = past_ids.get(p["src"])
        if not src or src.get("analysis_key", "").strip() != p["text"]:
            errors.append("核心記憶卡 %s 的 %s 與題庫不符：請重跑 python build_highfreq.py" % (c["id"], p["src"]))
print("  核心記憶卡：%d 張" % len(cards))

# 版本號四處一致：app.js、version.json、sw.js 快取名、index.html 的 ?v=
ver = re.search(r'const APP_VERSION = "([^"]+)"', read("app.js")).group(1)
if json.loads(read("version.json")).get("version") != ver:
    errors.append("version.json 與 app.js APP_VERSION（%s）不一致" % ver)
if "arch-law-cache-v%s'" % ver not in read("sw.js"):
    errors.append("sw.js CACHE_NAME 不是 v%s" % ver)
for name in ("index.html", "sw.js"):
    other = sorted(set(re.findall(r"\?v=([\w.]+)", read(name))) - {ver})
    if other:
        errors.append("%s 的 ?v= 有非 %s 的版本：%s" % (name, ver, other))
print("  版本：v%s" % ver)

for name in ("questions.js", "nlm_questions.js", "flashcards.js", "core_cards.js", "app.js", "sw.js"):
    node_check(os.path.join(ROOT, name), name)

bundle = read("index_bundle.html")
for name in ("questions.js", "nlm_questions.js", "flashcards.js", "core_cards.js", "app.js"):
    if read(name) not in bundle:
        errors.append("index_bundle.html 未含最新 %s：請先跑 python bundle.py" % name)
scripts = re.findall(r"<script>(.*?)</script>", bundle, re.S)
with tempfile.TemporaryDirectory() as tmp:
    for i, s in enumerate(scripts):
        p = os.path.join(tmp, "bundle_%d.js" % i)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(s)
        node_check(p, "index_bundle.html 第 %d 段腳本" % (i + 1))

if errors:
    print("[FAIL] %d 項：" % len(errors))
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("[PASS] 全部通過")
