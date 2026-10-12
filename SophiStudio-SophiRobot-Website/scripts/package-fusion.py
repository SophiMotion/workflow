from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path('public/fusion')
with ZipFile(root/'SophiRobot-Fusion-Export.zip','w',ZIP_DEFLATED) as z:
 for p in (root/'SophiRobotExport').iterdir():
  if p.is_file() and p.suffix in ['.py','.json','.manifest']:z.write(p,p.relative_to(root))
 z.write(root/'README.md','README.md')
with ZipFile(root/'SophiRobot-Fusion-Export.zip') as z:
 assert z.testzip() is None
 print('Fusion helper ZIP checked:',len(z.namelist()),'files')
for p in (root/'SophiRobotExport').glob('*.py'):compile(p.read_text(encoding='utf-8-sig'),str(p),'exec')
print('Fusion Python syntax checked')
