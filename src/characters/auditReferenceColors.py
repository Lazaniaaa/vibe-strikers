"""Read-only audit: feed JSON configs on stdin; confirms every used HEX exists in its source PNG."""
from pathlib import Path
from collections import Counter
from PIL import Image
import json,sys

def colors(value):
    if isinstance(value,str) and value.startswith('#'): return {value}
    if isinstance(value,dict): return set().union(*(colors(v) for v in value.values()))
    if isinstance(value,list): return set().union(*(colors(v) for v in value)) if value else set()
    return set()

missing=[]
for cfg in json.load(sys.stdin):
    if cfg['id']=='reference-01': continue
    p=Path('D:/notdesktop/desktop/reference')/(cfg['id']+'.png')
    try:
        image=Image.open(p).convert('RGB'); image.load()
    except Exception as exc:
        raise SystemExit('UNREADABLE REFERENCE: '+str(p)+' '+str(exc))
    counter=Counter(image.get_flattened_data())
    for color in colors(cfg):
        rgb=tuple(int(color[i:i+2],16) for i in (1,3,5))
        if not counter[rgb]: missing.append((cfg['id'],color))
print('UNSAMPLED_HEX',missing)
sys.exit(1 if missing else 0)
