"""Voice-over coverage: python3 tests/voice.py.

Lists every line the game can speak (the story, each level's instruction, hint, wrong-catch line
and right-catch beats, with level 5's lines for each of its trapeziums) straight from the game's
own data in headless Chromium, and checks that each has a recorded clip in src/voice-data.js,
that every clip belongs to a line, and that tools/build-voice.py lists exactly those lines.
"""
import importlib.util
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

LINES = r'''() => {
  const { STORY, LEVELS, FISH, ShapeFish, PALETTE } = PopoGame;
  const out = [];
  const add = (who, text) => out.push([who, text]);
  for (const line of Object.values(STORY).flatMap((v) => (typeof v === 'string' ? [] : [].concat(v)))) add(line.who, line.text);
  LEVELS.forEach((level, i) => {
    add('narrator', level.instruction);
    add('narrator', level.hint);
    for (const text of [].concat(level.oops || [])) add('popo', text);
    for (const spec of FISH.filter((f) => f.level === i + 1 && f.correct)) {
      const fish = new ShapeFish(spec, level, { colour: PALETTE[0] });
      for (const text of [].concat(level.right(fish.markedAngles))) add('popo', text);
    }
  });
  const key = (who, text) => `${who}:${text.replace(/\*/g, '').replace(/…/g, '...').replace(/’/g, "'").split(/\s+/).filter(Boolean).join(' ')}`.toLowerCase();
  const keys = [...new Set(out.map(([w, t]) => key(w, t)))];
  return { keys, clips: Object.keys(PopoGame.VOICE_DATA) };
}'''

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto((ROOT / 'index.html').as_uri() + '?debug')
    page.wait_for_function('!!(window.PopoGame && PopoGame.ShapeFish && PopoGame.VOICE_DATA)')
    result = page.evaluate(LINES)
    browser.close()

spec = importlib.util.spec_from_file_location('build_voice', ROOT / 'tools/build-voice.py')
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)
listed = {tool.voice_key(who, text) for who, text, _ in tool.LINES}
spoken, clips = set(result['keys']), set(result['clips'])
problems = [f'no clip: {k}' for k in sorted(spoken - clips)] + [f'clip for no line: {k}' for k in sorted(clips - spoken)]
problems += [f'not in build-voice.py: {k}' for k in sorted(spoken - listed)] + [f'build-voice.py line the game never says: {k}' for k in sorted(listed - spoken)]
for k in sorted(spoken):
    print('voiced' if k in clips else 'MISSING', k)
for p in problems:
    print('FAIL', p)
print(('PASS' if not problems else 'FAIL') + f': {len(spoken)} lines the game can say, {len(clips)} clips')
sys.exit(1 if problems else 0)
