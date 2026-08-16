from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'app' / 'src' / 'components' / 'admin' / 'SuperAdminArtifacts.tsx'
source = path.read_text()

old_open = """  async function openDetail(item: ArtifactItem) {\n    setError('')\n    setMessage('')\n    setRotatedCode('')\n    try {"""
new_open = """  async function openDetail(item: ArtifactItem) {\n    setError('')\n    setMessage('')\n    try {"""

old_button = """<button onClick={() => void openDetail(item)} className=\"rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700\">Gestionar</button>"""
new_button = """<button onClick={() => { setRotatedCode(''); void openDetail(item) }} className=\"rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700\">Gestionar</button>"""

if old_open in source:
    source = source.replace(old_open, new_open, 1)
if old_button in source:
    source = source.replace(old_button, new_button, 1)

path.write_text(source)
print('SuperAdminArtifacts UI finalized.')
