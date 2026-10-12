"""Verify player-facing Swiftee throughout the opening, with pause/restart coverage."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BOOT=(ROOT/'tests/mishap.py').read_text().split("BOOT = '''",1)[1].split("'''",1)[0]
OUT=Path('/tmp/popo-animation-review');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch()
    for label,width,height,reduced in [('desktop',1280,720,False),('mobile',390,844,False),('reduced',844,390,True)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce' if reduced else 'no-preference')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto((ROOT/'index.html').as_uri()+'?debug')
        page.wait_for_function('window.PopoGame.assets.swifteeFront')
        page.evaluate(BOOT)
        page.evaluate('()=>{popoDebug.game.reset();PopoGame.opening(popoDebug.game);}')
        page.evaluate('step(1000)')
        assert page.evaluate('!!popoDebug.game.swiftee && popoDebug.game.swiftee.faceViewer')
        page.screenshot(path=str(OUT/('swiftee-front-'+label+'.png')))
        beat=page.evaluate('popoDebug.game.swiftee.beat')
        page.evaluate('popoDebug.state.paused=true');page.evaluate('step(500)')
        assert page.evaluate('popoDebug.game.swiftee.beat')==beat
        page.evaluate('popoDebug.state.paused=false');page.evaluate('step(1600)')
        assert page.evaluate('popoDebug.game.swiftee.faceViewer && !popoDebug.game.swiftee.spin')
        page.evaluate('popoDebug.game.swiftee.twirl()')
        assert page.evaluate('!popoDebug.game.swiftee.spin'), 'An intro cue must preserve eye contact'
        page.screenshot(path=str(OUT/('swiftee-front-speaking-'+label+'.png')))
        page.evaluate('popoDebug.game.restart()');page.evaluate('step(1000)')
        assert page.evaluate('popoDebug.game.swiftee.faceViewer')
        page.evaluate('''async()=>{for(let i=0;i<500&&popoDebug.state.phase!=='ready';i++)await step(100);}''')
        assert page.evaluate('popoDebug.state.phase==="ready" && !popoDebug.game.swiftee && popoDebug.game.ui.hitsEnabled')
        assert not errors,errors
        print('PASS',label,'front-facing entrance/speech, pause, restart, playable handoff',flush=True)
        page.close()
    browser.close()
