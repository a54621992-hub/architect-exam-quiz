import json

path = r'C:\Users\user\.gemini\antigravity\scratch\architect_law_pwa\explanations\result_114_1.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print('Total questions:', len(data))
for i, q in enumerate(data, 1):
    expected_id = f"114_{i:02d}"
    assert q['id'] == expected_id, f"ID mismatch: {q['id']} vs {expected_id}"
    assert q['law'], f"Empty law in {q['id']}"
    assert q['analysis_key'], f"Empty analysis_key in {q['id']}"
    assert q['explanation'], f"Empty explanation in {q['id']}"

print('All 40 questions verified successfully!')
print('\n--- Sample Q1 ---')
print(json.dumps(data[0], ensure_ascii=False, indent=2))
print('\n--- Sample Q27 (#) ---')
print(json.dumps(data[26], ensure_ascii=False, indent=2))
print('\n--- Sample Q40 ---')
print(json.dumps(data[39], ensure_ascii=False, indent=2))
