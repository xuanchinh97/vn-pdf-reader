import re

with open(r'd:\workspace\tools\vn-pdf-reader\src\static\app.js', encoding='utf-8') as f:
    app = f.read()

bind_events = re.search(r'function bindEvents\(\) \{([\s\S]*?)\nfunction ', app).group(1)

accessed = re.findall(r'els\.([a-zA-Z0-9_]+)', bind_events)
with open(r'd:\workspace\tools\vn-pdf-reader\src\static\index.html', encoding='utf-8') as f:
    html = f.read()

missing = []
for a in set(accessed):
    if f'id="{a}"' not in html and f"id='{a}'" not in html:
        missing.append(a)

print("MISSING IN HTML:", missing)
