"""The angle recall (G5.1): python3 tests/recall.py

Checks the lesson card's mathematics against the shape itself: each angle's size is the angle
between the two sides that meet at its corner (and the numbers are 70° and 110°), its wedge
spans exactly that angle inside the shape, its number sits on the corner's bisector inside the
shape clear of every side, the highlighted sides meet at the right corners, the arrowed sides
are parallel, the corners are lettered outside them, and the statements read AB ∥ CD and
∠D + ∠A = 70° + 110° = 180°. Then runs the scene and checks its order (the shell opens before the card
rises, the card is in place before Swiftee comes, and each line waits for the drawing before
it), that nothing is left behind after it, and that it survives being run twice, rapid taps,
a restart part way through, and reduced motion. Fails on any browser error.
"""
import math
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (ROOT / 'index.html').as_uri() + '?dev=1'
problems = []


def check(ok, what, detail=''):
    print(('PASS ' if ok else 'FAIL ') + what + (f' -- {detail}' if detail else ''), flush=True)
    if not ok:
        problems.append(what)


GEOMETRY = '''() => { const g = popoDebug.game, G = PopoGame.geometry, r = g.showRecall(); g.recall = null;
  const { px } = r, n = px.length;
  return { px, bases: r.bases, leg: r.leg, corners: PopoGame.RECALL.corners, parallelText: r.parallelText, sumText: r.sumText,
    letters: r.letters.map(l => ({ text: l.text, inside: G.inside(px, l.at) })),
    angles: r.angles.map(a => ({ corner: a.corner, v: a.v, far: a.far, degrees: a.degrees, start: a.piece.start, sweep: a.piece.sweep, at: a.at, hw: a.hw, hh: a.hh,
      labelInside: !!a.at && [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sy]) => G.inside(px, [a.at[0] + sx * a.hw, a.at[1] + sy * a.hh])),
      labelClear: !a.at ? 0 : Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sy]) => px.map((p, i) => G.distanceToSegment([a.at[0] + sx * a.hw, a.at[1] + sy * a.hh], p, px[(i + 1) % n])))),
      wedgeInside: [0.1, 0.5, 0.9].every(f => G.inside(px, [a.v[0] + Math.cos(a.piece.start + a.piece.sweep * f) * 30, a.v[1] + Math.sin(a.piece.start + a.piece.sweep * f) * 30])) })) }; }'''

# every line's start, with the drawing's progress at that moment
LOG = '''() => { const g = popoDebug.game; window.said = []; if (g.logged) return; g.logged = true; const say = g.say.bind(g);
  g.say = (line, token) => { const r = g.recall; said.push({ text: line.text, t: r ? r.t : null, emerge: r ? r.emerge : null, open: r ? r.shell.open : null,
    parallel: r ? r.parallel : null, anglesDone: r ? r.anglesDone : null, sum: r ? r.sum : null }); return say(line, token); }; }'''
JUMP = "() => [...document.querySelectorAll('.dev-panel button')].find(b => b.textContent.includes('Recall')).click()"


def run_recall(page, taps=False):
    page.evaluate(LOG)
    page.evaluate(JUMP)
    page.wait_for_function('() => !!popoDebug.game.recall', timeout=30000)
    if taps:
        for _ in range(40):
            page.mouse.click(700, 500)
            page.wait_for_timeout(120)
    page.wait_for_function('() => popoDebug.state.phase === "observe"', timeout=120000)
    return page.evaluate('() => said')


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL)
    page.wait_for_function('() => PopoGame.assets.ready', timeout=60000)

    geo = page.evaluate(GEOMETRY)
    px, n = geo['px'], len(geo['px'])
    for a in geo['angles']:
        v, c = a['v'], a['corner']
        nb = [px[(c - 1) % n], px[(c + 1) % n]]
        u = [[q[0] - v[0], q[1] - v[1]] for q in nb]
        true = math.degrees(math.acos(max(-1, min(1, (u[0][0] * u[1][0] + u[0][1] * u[1][1]) / (math.hypot(*u[0]) * math.hypot(*u[1]))))))
        check(a['degrees'] == round(true), f'corner {c}: the number is the angle between its two sides', f'{a["degrees"]}° shown, {true:.2f}° measured')
        check(abs(math.degrees(a['sweep']) - true) < 0.01 and a['wedgeInside'], f'corner {c}: the wedge spans exactly that angle, inside the shape')
        bis = [u[0][0] / math.hypot(*u[0]) + u[1][0] / math.hypot(*u[1]), u[0][1] / math.hypot(*u[0]) + u[1][1] / math.hypot(*u[1])]
        to = [a['at'][0] - v[0], a['at'][1] - v[1]]
        off = abs(math.degrees(math.atan2(bis[0] * to[1] - bis[1] * to[0], bis[0] * to[0] + bis[1] * to[1])))
        check(off < 0.5 and a['labelInside'] and a['labelClear'] >= 5 and math.hypot(*to) < 120, f'corner {c}: the number sits on the bisector, inside, clear of the sides, near its corner',
              f'{off:.2f}° off, {a["labelClear"]:.1f}px clear, {math.hypot(*to):.0f}px from the corner')
        check(a['far'] in nb and a['far'] not in geo['leg'], f'corner {c}: its second side is one of its own sides, not the leg')
    check(sorted(a['degrees'] for a in geo['angles']) == [70, 110], 'the angles are 70° and 110°')
    check(geo['parallelText'] == 'AB ∥ CD' and geo['sumText'] == '∠D + ∠A = 70° + 110° = 180°', 'the statements name the sides and angles they show', f'{geo["parallelText"]} / {geo["sumText"]}')
    outside = all(not l['inside'] for l in geo['letters'])
    check(outside and [l['text'] for l in geo['letters']] == ['D', 'C', 'B', 'A'], 'each corner is lettered just outside it')
    check(sorted([px[i] for i in geo['corners']]) == sorted(geo['leg']), 'the highlighted leg joins the two chosen corners')
    d = [[px[(i + 1) % n][0] - px[i][0], px[(i + 1) % n][1] - px[i][1]] for i in geo['bases']]
    check(abs(d[0][0] * d[1][1] - d[0][1] * d[1][0]) < 1e-6 * math.hypot(*d[0]) * math.hypot(*d[1]), 'the arrowed sides are parallel')
    a0, a1 = geo['angles']
    gap = max(abs(a0['at'][0] - a1['at'][0]) - a0['hw'] - a1['hw'], abs(a0['at'][1] - a1['at'][1]) - a0['hh'] - a1['hh'])
    check(gap > 4, 'the two numbers do not overlap', f'{gap:.1f}px apart')

    said = run_recall(page)
    first = said[0]
    check(first['emerge'] == 1 and first['open'] > 0.9, 'the shell opens and the card is in place before Swiftee speaks', str(first))
    by = {s['text'].split()[0].strip('*,'): s for s in said}
    check(by['Remember']['t'] >= by['Remember']['parallel'] + 1, '"Remember," waits for the parallel sides')
    check(by['add']['t'] >= by['add']['anglesDone'], '"add up to 180°!" waits until both angles are drawn')
    check(by['Yay!']['t'] >= by['Yay!']['sum'] + 1.4, '"Yay!" waits until the sum is shown')
    check(page.evaluate('() => popoDebug.game.recall === null'), 'nothing of the recall is left once the fish come')

    said = run_recall(page, taps=True)
    check(len([s for s in said if s['text'].startswith('Look!')]) == 1 and page.evaluate('() => popoDebug.game.recall === null'),
          'a second run with forty rapid taps still plays in order and cleans up')
    page.evaluate(JUMP)
    page.wait_for_function('() => popoDebug.game.recall && popoDebug.game.recall.emerge > 0.5', timeout=30000)
    page.evaluate('() => popoDebug.game.restart()')
    page.wait_for_timeout(300)
    check(page.evaluate('() => popoDebug.game.recall === null'), 'a restart part way through clears the shell, the light and the card')
    check(not errors, 'no browser errors', '; '.join(errors[:3]))
    page.close()

    ctx = browser.new_context(viewport={'width': 1280, 'height': 720}, reduced_motion='reduce')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function('() => PopoGame.assets.ready', timeout=60000)
    run_recall(page)
    check(not errors and page.evaluate('() => popoDebug.game.recall === null'), 'with reduced motion it plays through and cleans up', '; '.join(errors[:3]))
    browser.close()

print(('PASS' if not problems else 'FAIL') + ': recall maths, order, clean-up, repeat, taps, restart, reduced motion')
sys.exit(1 if problems else 0)
