"""Phones: python3 tests/phones.py

On phone-sized touch screens (and a Mac window for comparison) checks that the whole game keeps
the same proportions as on a computer (no part of the HUD or the bubbles grows on a small
screen), that a phone held upright shows the game turned sideways and filling the screen, that a
tap on a fish catches it and a tap on Pause pauses in both orientations, and that Pause keeps a
44px tap area however small it is drawn.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEVICES = [
    ('mac 1440x900', dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)),
    ('iPhone landscape', dict(viewport={'width': 844, 'height': 390}, device_scale_factor=3, is_mobile=True, has_touch=True)),
    ('iPhone upright', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)),
    ('iPhone SE landscape', dict(viewport={'width': 667, 'height': 375}, device_scale_factor=2, is_mobile=True, has_touch=True)),
    ('Android landscape', dict(viewport={'width': 915, 'height': 412}, device_scale_factor=2.6, is_mobile=True, has_touch=True)),
]
# where a catchable fish is on the screen (turned back by hand when the game is on its side)
FISH = '''() => { const st = popoDebug.game.stage, k = st.scale, el = document.getElementById('stage');
  const f = popoDebug.state.fish.find(f => f.correct && !f.offstage && !f.escaping && f.x > 250 && f.x < 1400 && f.y > 450);
  if (!f) return null;
  if (st.rotated) return [innerWidth - (el.offsetTop + f.y * k), el.offsetLeft + f.x * k];
  const r = el.getBoundingClientRect();
  return [r.left + f.x * k, r.top + f.y * k]; }'''
LAYOUT = '''() => { const st = popoDebug.game.stage, el = document.getElementById('stage'), b = document.getElementById('btn-pause');
  const r = el.getBoundingClientRect(), p = b.getBoundingClientRect(), after = getComputedStyle(b, '::after');
  return { rotated: st.rotated, em: parseFloat(getComputedStyle(el).fontSize), scale: st.scale,
           cover: Math.max(r.width / innerWidth, r.height / innerHeight), hint: !document.getElementById('rotate-hint').hidden,
           pause: Math.min(p.width, p.height) / st.scale, tap: Math.min(p.width, p.height) - 2 * parseFloat(after.top) }; }'''
problems = []


def check(ok, what, detail=''):
    print(('PASS ' if ok else 'FAIL ') + what + (f' -- {detail}' if detail else ''), flush=True)
    if not ok:
        problems.append(what)


with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, opts in DEVICES:
        ctx = browser.new_context(**opts)
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto((ROOT / 'index.html').as_uri() + '?dev=1')
        page.wait_for_function('() => PopoGame.assets.ready', timeout=60000)
        page.evaluate("() => [...document.querySelectorAll('.dev-panel button')].find(b => b.textContent.trim().endsWith('L1')).click()")
        page.wait_for_function('() => popoDebug.state.phase === "ready"', timeout=30000)
        lay = page.evaluate(LAYOUT)
        check(abs(lay['em'] - lay['scale'] * 10) < 0.01 and abs(lay['pause'] - 56) < 1, f'{name}: same proportions as on a computer', f'1em = {lay["em"]:.2f}px at scale {lay["scale"]:.3f}')
        upright = opts['viewport']['height'] > opts['viewport']['width']
        check(lay['rotated'] == upright and not lay['hint'] and lay['cover'] > 0.99, f'{name}: fills the screen edge to edge one way' + (' turned sideways' if upright else ''), str(lay))
        check(lay['tap'] >= 43.9, f'{name}: Pause has a 44px tap area', f'{lay["tap"]:.1f}px')
        tap = page.mouse.click if not opts.get('has_touch') else page.touchscreen.tap
        point = None
        for _ in range(100):
            point = page.evaluate(FISH)
            if point:
                break
            page.wait_for_timeout(100)
        tap(*point)
        page.wait_for_function('() => popoDebug.state.collected.length === 1', timeout=15000)
        page.wait_for_function('() => popoDebug.state.phase === "ready"', timeout=15000)
        pause = page.evaluate("() => { const r = document.getElementById('btn-pause').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
        tap(*pause)
        check(page.evaluate('() => popoDebug.state.paused'), f'{name}: a tap on a fish catches it and a tap on Pause pauses')
        check(not errors, f'{name}: no errors', '; '.join(errors[:2]))
        ctx.close()
    browser.close()
print(('PASS' if not problems else 'FAIL') + ': same proportions, fills phones (sideways when upright), taps, 44px Pause')
sys.exit(1 if problems else 0)
