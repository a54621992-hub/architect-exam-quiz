import os
import sys

# 避免 Windows PowerShell 下 cp950 編碼報錯
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 自動以腳本所在目錄為工作基礎，支援跨機（私人/公司）自適應運行
current_dir = os.path.dirname(os.path.abspath(__file__))
base_dir = current_dir

# 雲端硬碟同步路徑（若存在則同步寫入）
drive_dir = r"G:\我的雲端硬碟\建築師考試法規\APP"
scratch_dir = r"C:\Users\user\.gemini\antigravity\scratch\architect_law_pwa"

with open(os.path.join(base_dir, "index.html"), encoding="utf-8") as f:
    html = f.read()

with open(os.path.join(base_dir, "styles.css"), encoding="utf-8") as f:
    css = f.read()

with open(os.path.join(base_dir, "questions.js"), encoding="utf-8") as f:
    q_js = f.read()

with open(os.path.join(base_dir, "flashcards.js"), encoding="utf-8") as f:
    fc_js = f.read()

with open(os.path.join(base_dir, "app.js"), encoding="utf-8") as f:
    app_js = f.read()

# 內嵌 css (使用正則相容帶版本號的引用，如 styles.css?v=2.2)
import re
html = re.sub(r'<link rel="stylesheet" href="styles\.css(?:\?v=[^"]*)?">', f"<style>\n{css}\n</style>", html)

# 內嵌 js (相容帶版本號的引用)
bundle_js = f"<script>\n{q_js}\n\n{fc_js}\n\n{app_js}\n</script>"
html = re.sub(r'<script src="questions\.js(?:\?v=[^"]*)?"></script>', "", html)
html = re.sub(r'<script src="flashcards\.js(?:\?v=[^"]*)?"></script>', "", html)
html = re.sub(r'<script src="app\.js(?:\?v=[^"]*)?"></script>', bundle_js, html)

# 寫入目標：首先寫入當前目錄
bundle_path_local = os.path.join(base_dir, "index_bundle.html")
with open(bundle_path_local, "w", encoding="utf-8") as f:
    f.write(html)
print(f"✓ index_bundle.html 已成功輸出至當前目錄: {bundle_path_local} ({os.path.getsize(bundle_path_local)} bytes)")

# 若另一端路徑存在且不同於當前目錄，則同步更新
for target_dir in [drive_dir, scratch_dir]:
    if os.path.isdir(target_dir) and os.path.abspath(target_dir) != os.path.abspath(base_dir):
        target_path = os.path.join(target_dir, "index_bundle.html")
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"✓ 已同步輸出至: {target_path}")
