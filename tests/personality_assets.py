"""Validate the generated pack before gameplay integration; capture the standalone preview."""
import json
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/tmp/popo-animation-review')
OUT.mkdir(exist_ok=True)
raw = (ROOT / 'src/personality-data.js').read_text()
data = json.loads(raw.split('PopoGame.PERSONALITY_DATA = ', 1)[1].rstrip(';\n'))
for actor, count in [('popo', 48), ('swiftee', 16), ('swiftee-front', 12)]:
    im = Image.open(ROOT / 'assets/sprites' / (actor + '-personality.png'))
    assert im.mode == 'RGBA'
    assert len(data[actor]['frames']) == count
    for i, frame in enumerate(data[actor]['frames']):
        x, y, w, h = frame['box']
        alpha = im.crop((x,y,x+w,y+h)).getchannel('A')
        box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
        assert box and min(box[0],box[1],w-box[2],h-box[3]) >= 16, (actor,i,box)
        assert alpha.getextrema() == (0,255), (actor,i)
    print('PASS', actor, count, 'complete RGBA poses with safe gutters', flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width':1280,'height':980})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto((ROOT / 'asset/animation-polish/preview.html').as_uri())
    page.wait_for_function('document.querySelectorAll("canvas").length === 11')
    loops = page.evaluate('''() => Object.values(PopoAnimationClips).map(c => ({
      title:c.title, closed:c.frames[0]===c.frames.at(-1), valid:c.frames.every(f=>
        Number.isInteger(f)&&f>=0&&f<PopoGame.PERSONALITY_DATA[c.actor].frames.length),
      timing:c.frames.length===c.holds.length&&c.holds.every(t=>t>0)
    }))''')
    assert all(c['closed'] and c['valid'] and c['timing'] for c in loops), loops
    page.click('#pause')
    page.screenshot(path=str(OUT / 'personality-pack.png'), full_page=True)
    before = page.evaluate('time')
    page.wait_for_timeout(150)
    assert page.evaluate('time') == before
    page.click('#pause')
    page.wait_for_timeout(150)
    assert page.evaluate('time') > before
    page.click('#background')
    page.screenshot(path=str(OUT / 'personality-dark.png'), full_page=True)
    assert not errors, errors
    print('PASS 11 closed animation loops, preview controls, no browser errors', flush=True)
    browser.close()
