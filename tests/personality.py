"""Animation integration: short retry, cancellation, pause, reduced motion and rod contact."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BOOT = (ROOT/'tests/mishap.py').read_text().split("BOOT = '''",1)[1].split("'''",1)[0]
OUT = Path('/tmp/popo-animation-review')
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name,width,height,fps,reduced in [('desktop',1280,720,60,False),('mobile',390,844,15,False),('reduced',844,390,30,True)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce' if reduced else 'no-preference')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto((ROOT/'index.html').as_uri()+'?debug')
        page.wait_for_function('window.PopoGame.assets.popoPersonality && window.PopoGame.assets.swifteePersonality')
        page.evaluate(BOOT)
        # Every emotion advances on the game clock and leaves the raft anchor in place.
        for clip in ['idle','catch','dance','wobble','wet']:
            page.evaluate('clip=>{const p=popoDebug.game.popo;popoDebug.state.idleTime=0;qa.anchor={...p.anchor};p.act(clip);}',clip)
            page.evaluate('step(350)')
            before=page.evaluate('popoDebug.game.popo.acting.t')
            page.evaluate('popoDebug.state.paused=true');page.evaluate('step(500)')
            assert page.evaluate('popoDebug.game.popo.acting.t')==before
            page.evaluate('popoDebug.state.paused=false')
            assert page.evaluate('JSON.stringify(popoDebug.game.popo.anchor)===JSON.stringify(qa.anchor)')
            # with the rod set down on the deck the hook rests by its tip instead of hanging into the water
            assert page.evaluate('''()=>{const p=popoDebug.game.popo,t=p.rodTip(),h=p.hookPosition();
              return [t.x,t.y,h.x,h.y].every(Number.isFinite)&&Math.abs(h.y-t.y-p.line.length*(1-p.rodParked())-6*p.rodParked())<3;}''')
            if name=='desktop':page.screenshot(path=str(OUT/('integrated-'+clip+'.png')))
            page.evaluate('([ms,fps])=>step(ms,fps)',[1700,fps])
            assert page.evaluate('!popoDebug.game.popo.acting')
        # Every mistake, the first and an immediate retry alike, gets the full fall, and taps during it
        # are ignored.
        page.evaluate('popoDebug.game.onFishTap(wrong())');page.evaluate('([ms,fps])=>step(ms,fps)',[6600,fps])
        assert page.evaluate('popoDebug.state.phase==="ready"')
        page.evaluate('''()=>{qa.fish=wrong();popoDebug.game.onFishTap(qa.fish);qa.token=popoDebug.state.token;}''')
        page.evaluate('step(1500)')
        assert page.evaluate('!!popoDebug.game.popo.mishap && !popoDebug.game.ui.hitsEnabled')
        page.evaluate('for(let i=0;i<20;i++)popoDebug.game.onFishTap(qa.fish)')
        assert page.evaluate('popoDebug.state.token===qa.token')
        page.evaluate('([ms,fps])=>step(ms,fps)',[5100,fps])
        assert page.evaluate('popoDebug.state.phase==="ready" && popoDebug.state.collected.length===0 && !qa.fish.gone && !qa.fish.frozen')
        # Restart during a reaction cancels the fall, the dialogue and any acting.
        page.evaluate('popoDebug.game.onFishTap(wrong())');page.evaluate('step(1500)')
        page.evaluate('popoDebug.game.restart()');page.evaluate('step(50)')
        assert page.evaluate('!popoDebug.game.popo.acting && !popoDebug.game.popo.mishap && !popoDebug.state.selectedFish')
        page.evaluate(BOOT)
        page.evaluate('popoDebug.game.onFishTap(right())');page.evaluate('step(6000)')
        assert page.evaluate('popoDebug.state.collected.length===1')
        assert not errors,errors
        print('PASS',name,'clock/anchors, full fall on every retry, cancellation, subsequent catch',flush=True)
        page.close()
    browser.close()
