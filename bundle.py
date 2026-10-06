import os

base_dir = r"C:\Users\user\.gemini\antigravity\scratch\architect_law_pwa"
drive_dir = r"G:\我的雲端硬碟\建築師考試法規\APP"

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

# 內嵌 css
import re
html = re.sub(r'<link rel="stylesheet" href="styles\.css(?:\?v=[^"]*)?">', f"<style>\n{css}\n</style>", html)

# 內嵌 js
bundle_js = f"<script>\n{q_js}\n\n{fc_js}\n\n{app_js}\n</script>"
html = re.sub(r'<script src="questions\.js(?:\?v=[^"]*)?"></script>', "", html)
html = re.sub(r'<script src="flashcards\.js(?:\?v=[^"]*)?"></script>', "", html)
html = re.sub(r'<script src="app\.js(?:\?v=[^"]*)?"></script>', bundle_js, html)

bundle_path_scratch = os.path.join(base_dir, "index_bundle.html")
bundle_path_drive = os.path.join(drive_dir, "index_bundle.html")

with open(bundle_path_scratch, "w", encoding="utf-8") as f:
    f.write(html)

with open(bundle_path_drive, "w", encoding="utf-8") as f:
    f.write(html)

print("index_bundle.html created successfully in scratch and drive!")
print("File size:", os.path.getsize(bundle_path_scratch), "bytes")
