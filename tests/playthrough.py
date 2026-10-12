"""End-to-end playthrough in headless Chromium: python3 tests/playthrough.py [correct|wrong|both].

Plays the whole trapezium activity through real taps: the opening and the first-time reminder,
five levels of 3, 3, 3, 3 and 4 catches (16 in all), the angle recall and the two-second look
before level 5, the celebration, the big-catch gag and the end, and Next. Checks that the counts are exact, that a wrong
catch never counts, that level 5's four catches are the four distinct trapeziums A, C, E and F,
that fishing is off during the look, that pause freezes the game, that Next tells the
hosting page and returns to the title, and that playing again skips the reminder. In `wrong`
mode a distractor is tapped (and recovered from) in every level first. Fails on any console error.
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (ROOT / 'index.html').as_uri() + '?debug'
CATCHES = [3, 3, 3, 3, 4]

STATE = '''() => { const d = window.popoDebug, s = d.state, g = d.game;
  return { phase: s.phase, level: s.level, caught: s.collected.length, levelCaught: s.levelCaught, paused: s.paused,
           card: !document.getElementById('btn-next').hidden, start: !document.getElementById('screen-start').hidden,
           hand: !document.getElementById('hand').hidden, handFish: g.handFish ? !g.handFish.offstage : null,
           hits: g.ui.hitsEnabled, swiftee: !!g.swiftee }; }'''

# the client point of a fish to tap: an in-view catch (right) or distractor (wrong), well inside the stage
PICK = '''(right) => { const d = window.popoDebug, s = d.state, g = d.game, k = g.stage.scale;
  const c = document.getElementById('stage').getBoundingClientRect();
  const f = s.fish.find(f => !f.gone && !f.offstage && !f.escaping && f.x > 140 && f.x < 1530 && f.correct === right);
  return f ? [f.x * k + c.left, f.y * k + c.top] : null; }'''


def check(ok, what, detail=''):
    print(('PASS ' if ok else 'FAIL ') + what + (f' -- {detail}' if detail else ''), flush=True)
    if not ok:
        raise SystemExit(1)


def state(page):
    return page.evaluate(STATE)


def wait_for(page, cond, timeout=60, soft=False):
    end = time.time() + timeout
    while time.time() < end:
        st = state(page)
        if cond(st):
            return st
        page.wait_for_timeout(100)
    if soft:
        return None
    raise SystemExit(f'FAIL timed out waiting; last state {state(page)}')


def tap_fish(page, right, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        point = page.evaluate(PICK, right)
        if point:
            page.mouse.click(*point)
            return True
        page.wait_for_timeout(100)
    return False


def play(mode):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto(URL)
        page.evaluate("() => { try { localStorage.removeItem('popo-fishing-learned'); } catch (e) {} }")
        page.evaluate("() => { window.completed = []; window.addEventListener('popo:complete', (e) => completed.push(e.detail)); }")
        page.wait_for_function('() => !document.getElementById("btn-play").disabled', timeout=30000)
        page.click('#btn-play', force=True)
        st = wait_for(page, lambda s: s['swiftee'] and s['phase'] == 'tutorial', 20)
        check(True, f'{mode}: Swiftee flies in for the opening')
        st = wait_for(page, lambda s: s['hand'], 40)
        check(not st['hits'], f'{mode}: the first-time reminder points at a fish before fishing starts')
        st = wait_for(page, lambda s: s['phase'] == 'ready', 30)
        check(st['hand'] and st['handFish'] and not st['swiftee'], f'{mode}: fishing starts with the hand on a fish in view, Swiftee gone')

        # pause freezes the game clock
        page.evaluate('() => window.popoDebug.game.togglePause()')
        before = page.evaluate('() => PopoGame.clock.time')
        page.wait_for_timeout(600)
        check(page.evaluate('() => PopoGame.clock.time') == before, f'{mode}: pause freezes the game')
        page.evaluate('() => window.popoDebug.game.togglePause()')

        level_wrong = set()
        seen_observe = False
        while True:
            st = wait_for(page, lambda s: s['phase'] in ('ready', 'observe', 'complete') or s['card'], 120)
            if st['card'] or st['phase'] == 'complete':
                break
            if st['phase'] == 'observe':
                # the two-second look: fish hold still and can't be caught
                xs = page.evaluate('() => popoDebug.state.fish.map(f => f.x)')
                page.wait_for_timeout(400)
                st2 = state(page)
                if st2['phase'] == 'observe':
                    still = page.evaluate('(xs) => popoDebug.state.fish.every((f, i) => f.frozen === true || Math.abs(f.x - xs[i]) < 400)', xs)
                    check(not st2['hits'] and still, f'{mode}: level 5 fish hold still with fishing off while the learner looks')
                    seen_observe = True
                wait_for(page, lambda s: s['phase'] == 'ready', 30)
                continue
            level, before = st['level'], st['caught']
            if mode == 'wrong' and level not in level_wrong:
                check(tap_fish(page, False), f'{mode}: found a wrong fish in level {level + 1}')
                if wait_for(page, lambda s: s['phase'] != 'ready', 3, soft=True):  # else the tap missed a moving fish
                    level_wrong.add(level)
                    wait_for(page, lambda s: s['phase'] == 'ready', 30)
                    check(state(page)['caught'] == before, f'{mode}: a wrong catch in level {level + 1} does not count')
                continue
            if not tap_fish(page, True):
                raise SystemExit(f'FAIL {mode}: no fish to catch in view; {state(page)}')
            if wait_for(page, lambda s: s['phase'] != 'ready', 3, soft=True):
                st = wait_for(page, lambda s: s['caught'] > before, 30)
                check(st['caught'] == before + 1, f'{mode}: one catch counts once (level {level + 1}, {st["levelCaught"]}/{CATCHES[level]})')

        st = wait_for(page, lambda s: s['card'], 60)
        check(st['caught'] == sum(CATCHES), f'{mode}: exactly {sum(CATCHES)} catches complete the activity', str(st['caught']))
        per_level = page.evaluate('() => [1, 2, 3, 4, 5].map(l => popoDebug.state.collected.filter(f => f.spec.level === l).length)')
        check(per_level == CATCHES, f'{mode}: catches per level are 3, 3, 3, 3 and 4', str(per_level))
        l5 = page.evaluate("() => popoDebug.state.collected.filter(f => f.spec.level === 5).map(f => f.spec.id).sort().join('')")
        check(l5 == 'ACEF', f'{mode}: level 5 needed the four distinct trapeziums A, C, E and F', l5)
        check(page.evaluate('() => popoDebug.state.collected.every(f => f.correct)'), f'{mode}: only right fish were collected')
        check(seen_observe, f'{mode}: the two-second look ran before level 5')
        if mode == 'wrong':
            check(len(level_wrong) == 5, f'{mode}: a wrong fish was tapped (and recovered from) in every level')

        page.evaluate('() => window.popoDebug.game.togglePause()')
        page.evaluate('() => window.popoDebug.game.next()')
        check(state(page)['card'], f'{mode}: Next waits while paused')
        page.evaluate('() => window.popoDebug.game.togglePause()')
        page.click('#btn-next')
        st = wait_for(page, lambda s: s['phase'] == 'intro' and s['start'], 10)
        detail = page.evaluate('() => window.completed')
        check(not st['card'] and detail == [{'catches': 16, 'levels': 5}], f'{mode}: Next closes the iris, tells the hosting page and returns to the title', str(detail))
        page.click('#btn-play', force=True)
        st = wait_for(page, lambda s: s['phase'] == 'ready', 40)
        check(st['caught'] == 0 and not st['hand'], f'{mode}: playing again starts fresh, without the reminder')
        check(not errors, f'{mode}: no console errors', '; '.join(errors[:3]))
        browser.close()


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'both'
    for m in (['correct', 'wrong'] if mode == 'both' else [mode]):
        play(m)
