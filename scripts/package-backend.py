from pathlib import Path
import zipfile
root = Path(__file__).resolve().parent.parent
output = root / 'release' / 'backend.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for folder in ['src', 'scripts']:
        for file in (root / 'backend' / folder).rglob('*'):
            if file.is_file():
                archive.write(file, file.relative_to(root / 'backend'))
    for name in ['server.js', 'package.json', 'package-lock.json']:
        archive.write(root / 'backend' / name, name)
print('Packaged backend source without credentials or local dependencies.')
