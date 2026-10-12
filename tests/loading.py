"""Loading: python3 tests/loading.py

Checks that every WebP sheet the game loads is pixel for pixel its PNG master, then serves the
game over HTTP on a throttled connection and checks that the title and Play show long before
the rest of the art, that the bar fills as the art arrives, that a tap on Play while loading
starts the game once everything is in, that only the files the game needs are fetched (no PNG
sheets, no embedded backgrounds), and that a file that won't load says so and offers Try again.
"""
import functools
import http.server
import sys
import threading
import time
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
problems = []


def check(ok, what, detail=''):
    print(('PASS ' if ok else 'FAIL ') + what + (f' -- {detail}' if detail else ''), flush=True)
    if not ok:
        problems.append(what)


for name in ['popo-personality', 'popo-mishap', 'swiftee-personality', 'swiftee-front-personality']:
    png, webp = (Image.open(ROOT / 'assets/sprites' / f'{name}.{ext}').convert('RGBA') for ext in ('png', 'webp'))
    check(png.size == webp.size and png.tobytes() == webp.tobytes(), f'{name}.webp matches its PNG (run tools/build-webp.py if not)')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/index.html?debug'

with sync_playwright() as p:
    browser = p.chromium.launch()

    # a slow phone connection: 1.6 Mbit/s, 150 ms
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors, fetched = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'fonts.' not in m.text else None)
    page.on('request', lambda r: fetched.append(r.url))
    cdp = page.context.new_cdp_session(page)
    cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 200000, 'uploadThroughput': 90000})
    t = time.time()
    page.goto(URL, wait_until='commit')
    page.wait_for_function('() => !!document.querySelector("#screen-start.titled")', timeout=60000)
    titled = time.time() - t
    early = page.evaluate('() => ({ play: !document.getElementById("btn-play").disabled, ready: PopoGame.assets.ready, bar: +document.getElementById("loading").getAttribute("aria-valuenow") })')
    check(early['play'] and not early['ready'], f'the title and Play show before the rest of the art ({titled:.1f}s)', str(early))
    page.wait_for_timeout(3000)
    later = int(page.evaluate('() => document.getElementById("loading").getAttribute("aria-valuenow")'))
    check(later > early['bar'], 'the loading bar fills as the art arrives', f'{early["bar"]}% -> {later}%')
    page.click('#btn-play', force=True)
    page.wait_for_timeout(300)
    waiting = page.evaluate('() => ({ phase: popoDebug.state.phase, text: document.getElementById("loading-text").textContent })')
    check(waiting['phase'] == 'intro' and waiting['text'] == 'Get ready…', 'Play while loading waits on the title', str(waiting))
    page.wait_for_function('() => popoDebug.state.phase !== "intro"', timeout=120000)
    ready = time.time() - t
    page.wait_for_timeout(700)  # the bar fades out
    gone = page.evaluate('() => getComputedStyle(document.getElementById("loading")).visibility')
    check(gone == 'hidden', f'the game starts by itself once everything is in ({ready:.1f}s), and the bar goes', gone)
    local = [u for u in fetched if u.startswith('http://127.0.0.1')]
    extra = [u for u in local if 'background-data.js' in u or ('/sprites/' in u and '.png' in u)]
    check(not extra, 'over HTTP no PNG sheets or embedded backgrounds are fetched', ', '.join(extra))
    page.wait_for_function('() => popoDebug.state.phase === "ready"', timeout=120000)
    check(not errors, 'no console errors on a slow connection', '; '.join(errors[:3]))
    page.close()

    # a sheet that never arrives (even on the retry)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.route('**/popo-props.webp*', lambda route: route.abort())
    page.goto(URL)
    page.wait_for_function('() => document.getElementById("loading").classList.contains("failed")', timeout=30000)
    failed = page.evaluate('() => ({ text: document.getElementById("loading-text").textContent, retry: !document.getElementById("btn-retry").hidden, play: document.getElementById("btn-play").disabled })')
    check(failed['retry'] and failed['play'] and failed['text'] == 'Could not load the game.', 'a file that will not load says so and offers Try again', str(failed))
    page.close()
    browser.close()
server.shutdown()

print(('PASS' if not problems else 'FAIL') + ': WebP copies, title first, loading bar, early Play, only needed files, load failure')
sys.exit(1 if problems else 0)
