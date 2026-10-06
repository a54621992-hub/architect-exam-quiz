import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"C:\Users\user\.gemini\antigravity\scratch\architect_law_pwa"
exp_dir = os.path.join(base_dir, "explanations")
q_json_path = os.path.join(base_dir, "questions.json")
q_js_path = os.path.join(base_dir, "questions.js")

expected_batches = [
    "result_114_1.json", "result_114_2.json",
    "result_113_1.json", "result_113_2.json",
    "result_112_1.json", "result_112_2.json",
    "result_111_1.json", "result_111_2.json",
    "result_110_1.json", "result_110_2.json"
]

missing = [f for f in expected_batches if not os.path.exists(os.path.join(exp_dir, f))]
if missing:
    print(f"Waiting for {len(missing)} batches to complete: {missing}")
    sys.exit(1)

# 讀取所有 400 題的新解析
all_results = {}
for fname in expected_batches:
    p = os.path.join(exp_dir, fname)
    with open(p, encoding='utf-8') as f:
        data = json.load(f)
    print(f"Loaded {fname}: {len(data)} items")
    for item in data:
        all_results[item["id"]] = item

print(f"Total merged explanations: {len(all_results)} / 400")

# 載入現有題庫
with open(q_json_path, encoding='utf-8') as f:
    master_qs = json.load(f)

updated_count = 0
for q in master_qs:
    qid = q["id"]
    if qid in all_results:
        res = all_results[qid]
        q["law"] = res.get("law", q.get("law", "營建法規"))
        q["analysis_key"] = res.get("analysis_key", "")
        q["explanation"] = res.get("explanation", "")
        updated_count += 1

print(f"Updated {updated_count} questions in master database.")

# 寫回 questions.json
with open(q_json_path, "w", encoding="utf-8") as f:
    json.dump(master_qs, f, ensure_ascii=False, indent=2)

# 寫回 questions.js
with open(q_js_path, "w", encoding="utf-8") as f:
    f.write("const RAW_QUESTIONS = " + json.dumps(master_qs, ensure_ascii=False, indent=2) + ";\n")

print("Successfully written to questions.json and questions.js!")
