import re
from pathlib import Path
for f in ['frontend/src/data/buildings.ts','frontend/src/data/nationalSeed.ts']:
 s=Path(f).read_text()
 print('\n',f)
 for m in re.finditer(r"id:\s*'([^']+)'",s):
   if m.group(1) in ['fengxian','binyang','xiangshan','guyang','shaolin-main-hall','iron-pagoda-main','yingtian-main','qingming-gate']: continue
   print(m.group(1))
