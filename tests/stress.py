"""Robustness checks in headless Chromium: python3 tests/stress.py.

Rapid taps on one fish, pause and resume over and over during a catch, restarts during a catch,
during Swiftee's lines and during the angle recall, a level change and a whole level under 4x CPU
throttling, and loading over a slow network. After each, the game must be in a clean state:
one catch counted once, no stale fish catchable, nothing left over from the cancelled scene, and
no console errors.
"""
import functools
import http.server
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (ROOT / 'index.html').as_uri() + '?dev=1'

SNAP = '''() => { const d = popoDebug, s = d.state, g = d.game;
  return { phase: s.phase, level: s.level, caught: s.collected.length, levelCaught: s.levelCaught, paused: s.paused,
    swiftee: !!g.swiftee, recall: !!g.recall, ring: !!g.hookRing, basket: !!g.basket, mishap: !!g.popo.mishap,
    speech: !document.getElementById('speech').hidden, hits: g.ui.hitsEnabled,
    stale: s.fish.filter(f => !f.gone && f.level !== popoDebug.game.level()).length }; }'''
JUMP = '''(label) => [...document.querySelectorAll('.dev-panel button')].find(b => b.textContent.endsWith(label)).click()'''


def check(ok, what, detail=''):
    print(('PASS ' if ok else 'FAIL ') + what + (f' -- {detail}' if detail else ''), flush=True)
    if not ok:
        raise SystemExit(1)


def until(page, js, timeout=30000):
    page.wait_for_function(js, timeout=timeout)


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL)
    until(page, '() => PopoGame.assets.ready')
    snap = lambda: page.evaluate(SNAP)

    # rapid taps: twenty taps on one fish while it is cast at, reeled and collected
    page.evaluate(JUMP, 'L1')
    until(page, '() => popoDebug.state.fish.some(f => f.correct && !f.offstage && f.x > 200 && f.x < 1450)')
    page.evaluate('''() => { const g = popoDebug.game, f = popoDebug.state.fish.find(f => f.correct && !f.offstage && f.x > 200 && f.x < 1450);
      for (let i = 0; i < 20; i++) g.onFishTap(f, null); }''')
    for _ in range(6):  # pause and resume over and over during the catch
        page.wait_for_timeout(250)
        page.evaluate('() => popoDebug.game.togglePause()')
        page.wait_for_timeout(120)
        page.evaluate('() => popoDebug.game.togglePause()')
    until(page, '() => popoDebug.state.phase === "ready"', 20000)
    s = snap()
    check(s['caught'] == 1 and s['levelCaught'] == 1 and not s['paused'], 'twenty rapid taps and repeated pauses make one catch', str(s))

    # restart in the middle of a catch
    page.evaluate('''() => { const f = popoDebug.state.fish.find(f => f.correct && !f.offstage); if (f) popoDebug.game.onFishTap(f, null); }''')
    page.wait_for_timeout(900)
    page.evaluate('() => popoDebug.game.restart()')
    page.wait_for_timeout(300)
    s = snap()
    check(s['caught'] == 0 and s['phase'] == 'tutorial' and not s['mishap'] and not s['basket'], 'restart during a catch starts clean', str(s))

    # restart while Swiftee is talking in the opening
    until(page, '() => !!popoDebug.game.swiftee && !document.getElementById("speech").hidden', 20000)
    page.evaluate('() => popoDebug.game.restart()')
    page.wait_for_timeout(300)
    s = snap()
    check(not s['swiftee'] and not s['speech'] and not s['ring'], 'restart during dialogue clears Swiftee and the bubble', str(s))

    # restart during the angle recall card
    page.evaluate(JUMP, 'Recall')
    until(page, '() => !!popoDebug.game.recall', 20000)
    page.evaluate('() => popoDebug.game.restart()')
    page.wait_for_timeout(300)
    s = snap()
    check(not s['recall'] and s['level'] == 0 and s['phase'] == 'tutorial', 'restart during the recall clears the card', str(s))

    # a level change and a whole level under 4x CPU throttling
    cdp = page.context.new_cdp_session(page)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    page.evaluate(JUMP, 'L3')
    page.evaluate(JUMP, 'Level done')
    until(page, '() => popoDebug.state.level === 3 && popoDebug.state.phase === "ready"', 30000)
    s = snap()
    check(s['stale'] == 0 and s['levelCaught'] == 0, 'level change under throttling leaves no fish from the old level', str(s))
    for n in range(3):
        until(page, '() => popoDebug.state.phase === "ready" && popoDebug.state.fish.some(f => f.correct && !f.offstage && !f.escaping)', 30000)
        page.evaluate('() => { const f = popoDebug.state.fish.find(f => f.correct && !f.offstage && !f.escaping); popoDebug.game.onFishTap(f, null); }')
        until(page, f'() => popoDebug.state.collected.length >= {n + 1}', 30000)
    until(page, '() => popoDebug.state.level === 4 || popoDebug.state.phase === "recall"', 30000)
    check(page.evaluate('() => popoDebug.state.collected.length') == 3, 'a level played under throttling counts exactly three catches')
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    page.close()

    # loading over a slow network: served over HTTP, every file held back a moment
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    page = browser.new_page(viewport={'width': 1024, 'height': 768})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
    page.route('**/*', lambda route: (time.sleep(0.15), route.continue_()))
    # noted inside the page as soon as the game has set itself up (before any art can arrive)
    page.add_init_script("document.addEventListener('DOMContentLoaded', () => { window.playLocked = document.getElementById('btn-play').disabled; })")
    page.goto(f'http://127.0.0.1:{server.server_address[1]}/index.html?dev=1', wait_until='domcontentloaded')
    check(page.evaluate('() => window.playLocked === true'), 'Play waits while the art is loading')
    until(page, '() => !document.getElementById("btn-play").disabled', 60000)
    page.click('#btn-play', force=True)
    until(page, '() => popoDebug.state.phase === "ready"', 60000)
    check(True, 'a slow load still plays through to fishing')
    check(not errors, 'no console errors', '; '.join(errors[:3]))
    browser.close()
    server.shutdown()
print('PASS: rapid taps, pause/resume, restarts, throttled level change, slow network')
