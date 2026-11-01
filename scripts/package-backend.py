from pathlib import Path
import sys
import os
import json
import subprocess
import tarfile
import io
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
    for name in ['server.js', 'package.json', 'package-lock.json', 'startup.sh']:
        archive.write(root / 'backend' / name, name)
    if '--with-dependencies' in sys.argv:
        dependencies = root / 'release' / 'node_modules.tar.gz'
        with tarfile.open(dependencies, 'w:gz') as bundle:
            if '--dependencies-zip' in sys.argv:
                source_path = sys.argv[sys.argv.index('--dependencies-zip') + 1]
                with zipfile.ZipFile(source_path) as source:
                    for item in source.infolist():
                        if not item.filename.startswith('node_modules/') or item.is_dir():
                            continue
                        data = source.read(item.filename)
                        entry = tarfile.TarInfo(item.filename.removeprefix('node_modules/'))
                        entry.size = len(data)
                        entry.mode = (item.external_attr >> 16) & 0o777 or 0o644
                        bundle.addfile(entry, io.BytesIO(data))
            else:
                bundle.add(root / 'backend' / 'node_modules', arcname='.')
        archive.write(dependencies, 'node_modules.tar.gz', compress_type=zipfile.ZIP_STORED)
        archive.writestr('oryx-manifest.toml', 'OperationId = "personalshop-prebuilt"\n')
print('Packaged backend without credentials; production dependencies included:', '--with-dependencies' in sys.argv)
