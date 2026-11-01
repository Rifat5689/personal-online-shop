from pathlib import Path
import sys
import os
import json
import subprocess
import zipfile
root = Path(__file__).resolve().parent.parent
output = root / 'release' / 'backend.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    commit = os.environ.get('RELEASE_COMMIT') or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    archive.writestr('build-info.json', json.dumps({'commit': commit}))
    for folder in ['src', 'scripts']:
        for file in (root / 'backend' / folder).rglob('*'):
            if file.is_file():
                archive.write(file, file.relative_to(root / 'backend'))
    for name in ['server.js', 'package.json', 'package-lock.json']:
        archive.write(root / 'backend' / name, name)
    if '--with-dependencies' in sys.argv:
        for file in (root / 'backend' / 'node_modules').rglob('*'):
            if file.is_file():
                archive.write(file, file.relative_to(root / 'backend'))
print('Packaged backend without credentials; production dependencies included:', '--with-dependencies' in sys.argv)
