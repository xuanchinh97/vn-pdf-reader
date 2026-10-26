import re

with open(r'd:\workspace\tools\vn-pdf-reader\src\static\index.html', encoding='utf-8') as f:
    html = f.read()

with open(r'd:\workspace\tools\vn-pdf-reader\src\static\app.js', encoding='utf-8') as f:
    app = f.read()

# 1. Check all els mapping
els_block = re.search(r'const els = \{([\s\S]*?)\};', app)
if els_block:
    ids = re.findall(r'document\.getElementById\(["\'](.*?)["\']\)', els_block.group(1))
    missing_ids = [i for i in ids if f'id="{i}"' not in html and f"id='{i}'" not in html]
    print("Missing IDs from els definition:", missing_ids)

# 2. Check all direct getElementById
all_get_ids = re.findall(r'document\.getElementById\(["\'](.*?)["\']\)', app)
missing_all = [i for i in all_get_ids if f'id="{i}"' not in html and f"id='{i}'" not in html]
print("All missing getElementById IDs:", set(missing_all))
