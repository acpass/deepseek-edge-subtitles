"""Create an allowlisted, deterministic extension ZIP and checksum file."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    'manifest.json', 'background.js', 'offscreen.html', 'offscreen.js',
    'pcm-worklet.js', 'audio.js', 'api.js', 'content.js', 'transcript.js',
    'popup.html', 'popup.css', 'popup.js', 'LICENSE',
    'README.md', 'README.zh-CN.md', 'PRIVACY.md', 'CONTRIBUTING.md',
    'CHANGELOG.md', '使用说明.txt', 'docs/preview.png',
]
version = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
destination = ROOT / 'dist'
destination.mkdir(exist_ok=True)
archive = destination / f'deepseek-edge-subtitles-v{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
    for filename in sorted(FILES):
        info = zipfile.ZipInfo(f'deepseek-edge-subtitles/{filename}', date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        out.writestr(info, (ROOT / filename).read_bytes())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(destination / 'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n', encoding='utf-8')
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
    assert len(check.namelist()) == len(FILES)
print(f'Created {archive.name} ({archive.stat().st_size} bytes)')
print(f'SHA256 {digest}')
