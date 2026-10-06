import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
with open(r'C:\Users\user\.gemini\antigravity\scratch\architect_law_pwa\explanations\batch_110_1.json', encoding='utf-8') as f:
    qs = json.load(f)

start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
end = int(sys.argv[2]) if len(sys.argv) > 2 else len(qs)

for q in qs[start:end]:
    print(f"=== Q{q['q_num']}: {q['id']} (Ans: {q['answer']}) ===")
    print(f"Stem: {q['stem']}")
    for k, v in q['options'].items():
        print(f"  [{k}] {v}")
    print()
