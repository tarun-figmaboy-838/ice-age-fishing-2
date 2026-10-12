# Popo's Trapezium Fishing (part 2)

The post-learning half of Popo's shape fishing. The learner has just studied trapeziums; now Popo
fishes at the frozen lake and the learner catches trapezium fish across five levels (16 catches),
from spotting a trapezium to telling one by its angles. It follows "Trapezium Fishing Game —
Designer & Developer Handoff" and keeps part 1's look, characters, controls and engine.

## Run

The game is plain HTML, CSS and JavaScript (canvas, WebGL for the water, Web Audio; no build
step and no dependencies). Double-click `index.html` to play, or serve the folder over HTTP:

```
python3 -m http.server 8000
# then visit http://localhost:8000/
```

The painted water runs through a per-pixel WebGL pass (waves, refraction, seaweed sway, light
on the sand). The lake background is embedded as a data URL in `src/background-data.js` so the
pass also works when the page is opened straight from the file system; without WebGL the
painting is drawn plainly.

Append `?debug` to the URL to expose `window.popoDebug = { state, game }` for testing.

Append `?dev=1` for a small panel of screen jumps (top left): title, intro, each level, the
angle recall, a right or wrong catch, finishing the current level, the first-time reminder and
the finale. Number keys 1–9 and 0 press the first ten buttons; the backtick key folds the panel
away. Dev mode also exposes `window.popoDebug`.

## Deploy

The folder is a static site. On Vercel, import the GitHub repository and deploy with no build
command; `vercel.json` sets long cache headers for `assets/` and `.vercelignore` leaves the
original artwork and tools out of the deployment.

## Layout

- `index.html`, `src/` – the game. The scripts are classic scripts sharing the `PopoGame`
  namespace, loaded in dependency order from `index.html`. `game.js` orchestrates (levels,
  school of fish, recall card, basket), `sequences.js` holds the timed flows (opening, catch,
  wrong catch, level change, recall, the look at the angles, celebration), `levels.js` holds the
  five levels, every fish body and the story lines, `geometry.js` the trapezium maths and where
  every marking goes, `fish.js` the swimming fish (the art-sheet fish and the vector shape fish),
  `popo.js` renders Popo from the sprite sheets, `water.js` is the WebGL water pass, `effects.js`
  the ambient water, `audio.js` the synthesised sound, `ui.js` the HUD/DOM.
- `asset/` – the untouched source artwork (`asset/trapezium-fish.png` is the fish sheet the
  shape fish are styled on).
- `assets/` – the compressed WebP art the game loads, generated from `asset/`.
- `tools/build-assets.py` – rebuilds `assets/` and `src/sprite-data.js` (needs Pillow).
- `tools/build-voice.py` – records the voice-overs into `src/voice-data.js` (see Voice-overs).
- `tools/build-rowing.py` builds the articulated paddling rig (`src/rowing.js`,
  `src/rowing-data.js`, `assets/sprites/paddling/body.png` and `paddle.png`) from
  `asset/popo-paddling-rig-source.png`; `tools/build-rowing-cycle.py` then pre-renders one
  stroke of it into `assets/sprites/popo-row-cycle.webp` (24 frames), which the game crossfades
  through while Popo rows in at the start.

## Flow

Title → **G0**: Popo rows in to his spot (honk honk, poof, ta-da) and Swiftee flies in from the
lesson: "Great job!" "You know all about trapeziums!" "Now, let's help Popo catch some fish!" →
level 1's fish swim in. The first time on a device, Swiftee adds the reminder ("Use the fishing
rod to aim…" "…and drop the hook on the correct fish.") while a dashed ring circles the hook and
the hand points at a fish to catch; after the first right catch it never shows again
(`localStorage` `popo-fishing-learned`) → Swiftee flies off and fishing starts.

Tap a fish and Popo casts: the hook flies into its mouth. A right fish is reeled up and flips
into the bucket and Popo says the level's line; a wrong one pulls Popo in (the wrong-answer
reaction below), then the instruction shows the level's hint and the narrator reads it. Every
line is the handoff's wording, voiced, and shown word by word in time with the voice, with a boing
on the stressed word; longer lines are split into short comic beats (one quick bubble each, with a
breath between). The bubble grows word by word into its final shape, balanced over its lines. A
bubble stays up after the voice ends long enough for a young reader (at least 0.9 s, about 130 ms
a word). Between levels Popo does a happy dance under a "LEVEL 2!" burst before the next fish swim
in. The tutorial hand taps the middle of the fish, pressing in on each tap with a ripple at the
fingertip.

| Level | Instruction | Catches | Fish in the school | Markings | Right / hint |
| --- | --- | --- | --- | --- | --- |
| 1 | Catch all the trapeziums! | 3 | 4, slow | parallel arrows | "Yes! One pair of parallel sides!" / "Look for parallel sides!" |
| 2 | Catch the scalene trapeziums! | 3 | 4, slow–moderate | arrows, leg lengths ("5 units") | "The legs have different lengths!" / "Check the leg lengths!" |
| 3 | Catch the isosceles trapeziums! | 3 | 4, moderate | arrows, matching or different leg ticks | "Both legs are equal!" / "Are the legs equal?" |
| 4 | Catch the trapeziums with two right angles! | 3 | 5, moderate | arrows, right-angle squares | "Two right angles!" / "Look for two right angles!" |
| 5 | Catch all the trapeziums! | 4 | 5, moderate | two angle arcs and degrees | "Yes!" "70° + 110° = 180°!" "That means a pair of parallel sides!" / "Add the marked angles!", and Popo: "Not a trapezium." "These angles don't add up to 180°!" "Try again!" |

Each level's school holds a couple of fish to catch among distractors; after a catch another
fish to catch swims in while the level needs more, and distractors keep it from thinning out
(`school`, `targets` and `least` in `LEVELS`). Fish swim in briskly from either side, usually
turn back at the edges, and one still to catch is always in sight. Colour never tells a catch
from a distractor.

Before level 5 (once): **G5.1** Swiftee: "Remember," "angles on the same leg of a trapezium…"
"add up to 180°!" A card follows her words: the trapezium on "Remember", the leg lighting up and a
coloured piece popping into the 70° and the 110° corner on "leg", and on "180°" the two pieces fly
out and snap together on a straight line before "70° + 110° = 180°" bounces in. **G5.2**
level 5's fish swim to their places and stop; Swiftee: "Look at the marked angles!"; then
"Step 1: Observe (2 seconds)" with fishing off, and the fish swim on. A right catch in level 5
shows its parallel arrows as it is hooked.

**G6** after the sixteenth catch: the last fish swim off, all sixteen leap one after another
over Popo into his bucket, Popo: "Wow!" "What a catch!", and Swiftee: "You did it!".

Then a cartoon gag, played big: a giant shadow glides under the raft (dun, dun, DUNNN, and the
edges darken), Popo: "Whoa! A giant fish!" while Swiftee flutters to a perch beside him to
watch. He casts and hauls ("Come on, big fish!", YANK! HEAVE!, speed lines, the screen shaking),
and up it bursts in slow motion (SPLOOSH!)... a huge old boot dripping seaweed, with a tin can
stuck on its toe. Swiftee: "Eek!", Popo: "Huh?!", Swiftee: "Good catch, Popo!" They both crack
up ("Ha ha ha!" "Hee hee hee!"), Popo lets go, the boot plops back in (SPLASH!) and Swiftee
flutters back beside him. The end is a Tom and Jerry iris: Swiftee snuggles in beside Popo, the
iris closes on the two of them and glides to the middle of the screen, sized to frame them whole,
where they keep laughing in a warm sunburst under "The End", with a **Next** button. Next
shuts the iris, dispatches a `popo:complete` event (`{ catches: 16, levels: 5 }`, also posted to
a hosting page) and returns to the title.

## Fish geometry

Every trapezium-level fish is an exact polygon (`FISH` in `src/levels.js`), built in units from a
few measurements by `src/geometry.js`: bases, height and leg insets or lengths; the two angles at
the ends of one side; kites and arrowheads. `classify()` measures each body (exclusive
convention: a trapezium has exactly one pair of parallel sides; no parallelogram, rectangle,
square or rhombus appears), and `layoutMarks()` places every arrow, tick, square, arc and label
from the polygon itself, so a label always shows the drawn length or angle. Level 5 uses the
handoff's fish A–F (70+110, 80+80, 65+115, 95+105 shown as 105+95, 75+105, 80+100).

The fish are drawn as vectors every frame in the style of the uploaded fish sheet: its colours,
dots, waves, stripes, diamonds and hearts, gloss, outline, rosy cheek, big eye and smile, with a
swaying tail and fluttering fins. They blink, watch the hook while Popo casts and gasp when
startled or hooked; nothing ever stretches the body. Markings are printed on the fish in its own
palette: white arrows, ticks, right-angle corners and arcs edged in the body's dark tone, a
lighter tint of the body inside each marked angle, and bold white numbers ("5 units", "70°")
beside the side or inside the angle they measure. They turn and mirror with the body while the
numbers stay upright; numbers grow on small screens (`LABEL` in `src/fish.js`), where the whole
fish is also drawn 15% larger, and the face keeps clear of every marking.

## Tests

Python Playwright with its Chromium (`pip install playwright && playwright install chromium`):

- `python3 tests/geometry.py` – every fish's classification, level rule, markings and numbers
  (also turned, mirrored and resized), and at both label sizes that every label sits inside its
  body clear of the face, the other labels and every marking.
- `python3 tests/playthrough.py` – the whole activity through real taps (correct and wrong runs).
- `python3 tests/mishap.py` – the wrong-answer reaction at five layouts and 15/30/60 FPS, every
  level's hint, restart, retries and a following right catch.
- `python3 tests/rowing.py` – the paddling frames and Popo's entrance.
- `python3 tests/asset_alpha.py` – the mishap art's transparency.
- `python3 tests/voice.py` – every line the game can say has a recorded clip.
- `python3 tests/stress.py` – rapid taps, pause/resume, restarts mid-scene, CPU throttling, slow loading.

## Voice-overs

All 42 lines part 2 can say (the story, each level's instruction and hint, Popo's right- and
wrong-catch lines, level 5's sums for each of its trapeziums, and the big-catch gag) are recorded with Kokoro in part 1's
voices; `LINES` in `tools/build-voice.py` lists them, and symbols are read as words ("70° + 110° =
180°" as "70 degrees plus 110 degrees equals 180 degrees"). Each word appears as it is spoken and
the recall card's steps follow the voice. `python3 tests/voice.py` checks that every line the game
can say has its clip. To re-record after changing a line:

```
~/.cache/popo-voice311/bin/python tools/build-voice.py --engine kokoro
```

The narrator, Popo and Swiftee are voiced. Part 1's clips were recorded locally with
Kokoro-82M (Apache-2.0, no account): its Hindi speakers give the narrator a clear Indian
English voice, Popo is a lower, bouncier male voice and Swiftee a sped-up bright one:

```
python3 -m venv ~/.cache/popo-voice311   # Python 3.10+ (e.g. via `uv python install 3.11`)
~/.cache/popo-voice311/bin/pip install kokoro soundfile lameenc
~/.cache/popo-voice311/bin/python tools/build-voice.py --engine kokoro --audition   # samples
~/.cache/popo-voice311/bin/python tools/build-voice.py --engine kokoro              # record
```

They can also be recorded with Gemini text-to-speech, which needs an API key. The clips are recorded
once by `tools/build-voice.py` and shipped as small MP3s inside `src/voice-data.js`, so the API
key never reaches the game. To record or re-record them:

```
echo 'GEMINI_API_KEY=your-key' > .env        # .env is git- and Vercel-ignored
python3 -m pip install --user lameenc
python3 tools/build-voice.py                 # records missing lines; --force re-records all
```

The narrator is a clear Indian English (en-IN) voice; Popo and Swiftee are character voices.
The script finds them in Gemini's voice library (the cast and line list are at the top of it).
To hear the candidates first, record one sample per voice and then choose:

```
python3 tools/build-voice.py --audition          # samples in asset/voice/auditions/
python3 tools/build-voice.py --cast popo=VOICE   # use that voice; only Popo is re-recorded
```

The chosen voices are kept in `asset/voice/cast.json`, so later runs sound the same.
Each clip is keyed by speaker and on-screen text: the words of a line appear as they are spoken,
the music ducks under the voice, and a line without a clip falls back to the synthesized
voice blips. Raw recordings are kept in `asset/voice/`.

## Notes on the supplied art

- Popo's fishing and casting poses come from `asset/popo-fishing-clean.png` (character and rod
  only). His paddling comes from `asset/popo-paddling.png`, which the build cleans of red and
  yellow generation specks and repacks so every figure is whole. Every pose sits on one shared
  raft at the same seat on the deck, so the raft never changes between poses.
- The raft with its bucket and the rod come from `asset/props-new.png`; the build fits them into
  the cells the game registers to. The hint hand is `asset/hint-hand.png`.
- Fish come from the two fish sheets in `asset/`, sliced by grid cell with a margin so no fish
  is cut, then cleaned of stray specks. The second sheet is drawn at twice the scale and is
  halved. Unused cells: an irregular 9-gon, a capsule, a second right triangle, a second
  trapezium and a star. Each used fish's side count was checked by measuring its outline, and
  its smile is measured so the hook lands in its mouth.
- Each background gets a water mask: the surface waves move only open water, so the sky,
  mountains, ice shelves and icebergs stay still. The seaweed sway stops at the plant tips.
- The title banner, "Fishing Frenzy" (`asset/title-banner.png`), and play button (`asset/play-button.png`) are built
  into `assets/` and embedded as data URLs so the canvas can use them from the file system.
- No audio files were supplied; music and effects are synthesised with the Web Audio API.

## Wrong-answer reaction

The existing cast takes about 0.9 seconds, followed by one 4.8-second game-clock reaction
(about 5.7 seconds of motion). Popo says “Whoopsie Doopsie!” (in level 5, the handoff's “Not a
trapezium.” “These angles don't add up to 180°!” “Try again!”) during the seated recovery. Every
wrong catch gets the full fall. Fishing resumes once the motion and a short line are done, or at
most 1.2 s after the motion while longer beats are still being said (they carry on over the
fishing). The wrong fish remains available for retry.

| Reaction time after casting | Beat |
| --- | --- |
| 0–0.40 s | Fish tug, surprised expression, attached rod response |
| 0.40–0.95 s | Brace, anticipation, loss of balance |
| 0.95–1.45 s | Curved airborne fall and rod release |
| 1.45–1.75 s | Water entry; splash fires on measured contact, not a timer |
| 1.75–2.05 s | Brief visible underwater dip and bubbles |
| 2.05–2.75 s | Buoyant resurface, blink, water rings |
| 2.75–4.15 s | Reach, planted-paw pull, belly/feet over the rail, seat recovery |
| 4.15–4.80 s | Sheepish recovery, original idle art and rod grip restored |

`src/sequences.js` owns the time-based path and one-shot events. `src/popo.js` registers
poses by head landmarks, uses short interpolated pose blends, clips above/below the surface,
and pins the climb grip to the raft. The original fishing frame supplies the independent rod;
the shared raft/bucket prop is retained. The original idle frame is used at both ends.
`src/effects.js` draws the splash behind and in front of Popo. Existing synthesized audio
supplies the twang, slide, splash and bubbly recovery; no voiceover assets were supplied.
Input stays locked until recovery, and restart/disposal cancel the sequence and effects.
The clock now rejects failed tween callbacks so cleanup can release the input lock.
The RAF delta cap supports 15 FPS without slowing game time; hidden tabs suspend updates.

### New artwork and rebuild

- `asset/popo-mishap-new.png`: newly generated, subsequently alpha-cleaned Popo-only source.
- `assets/sprites/popo-mishap.png`: lossless 2048×1024 RGBA atlas, eight padded cells.
- `src/mishap-data.js`: generated pose boxes and attachment landmarks.
- `tools/popo-mishap-prompt.txt`: generation prompt and processing provenance.
- `tools/build-mishap.py`: deterministic Canvas packing; requires Python Playwright/Chromium.

Run `python3 tools/build-mishap.py` to repack the cleaned source without further erosion.
`--clean-source` is only for a fresh raw generation; it removes exterior matte/chroma noise
and isolated specks, preserves interior features, and antialiases the boundary before saving.
The old `popo-mishap-poses-v2` files are retained as legacy source and are no longer loaded.

### Verification (9 October 2026)

Run `python3 tests/mishap.py` and `python3 tests/asset_alpha.py`.
Gameplay screenshots and measurements are written to `/tmp/popo-qa`.

Passed in local headless Chromium: desktop 1600×900, laptop 1024×640, tablet 768×1024,
mobile 390×844, reduced-motion 844×390; simulated 15/30/60 FPS; rotation/resize during
animation; pause; 20 repeated taps; three consecutive retries; restart mid-fall; a subsequent
correct collection; all four location waterlines; optional audio failure. A separate actual
RAF run used the keyboard fish target, completed in 6.37 seconds including recovery dialogue, and dispatched each
impact SFX once with a running Web Audio context. Sampled animation frames were visually
reviewed for water clipping, pose continuity, equipment and recovery.

Asset checks passed for RGBA transparency, opaque interiors, fractional-alpha edges,
32-pixel minimum safety gutters (actual minimum 44 pixels), registered landmarks and absence
of saturated exterior red/yellow fringe. JavaScript syntax and `git diff --check` passed.
The project has no package-manager lint command or application compilation step; the new
sprite packing pipeline was run successfully.

Limits: animation uses eight raster key poses with short registered blends, not a skeletal
3D rig. Physical mobile devices, Safari and subjective loudspeaker/headphone playback have
not been validated. The checks above verify sound dispatch/timing, not perceived sound mix.

Files changed for this reaction: `index.html`, `src/assets.js`, `src/clock.js`,
`src/effects.js`, `src/game.js`, `src/popo.js`, `src/sequences.js`, and this README.
Added files are the four artwork/registration/provenance files listed above,
`tools/build-mishap.py`, `tests/mishap.py`, and `tests/asset_alpha.py`.
Existing unrelated working-tree changes were retained; no repository push was made.

Recovery dialogue checks also passed: exact “Whoopsie Doopsie!” text, locked input while
visible, restart during its post-motion hold, and recovery with optional audio unavailable.
The dialogue text is stored in `STORY.wrong` in `src/levels.js`.

## Character personality pack (12 October 2026)

The complete art pack was generated and checked before gameplay integration. Open
`asset/animation-polish/preview.html` directly to review ten looping clips, with pause,
speed and background controls. The 52 source poses cover Popo's idle/blink, talking,
catch celebration, reeling effort, short wobble, finale dance and wet recovery, plus
Swiftee's expressions, teaching gestures and celebration.

- Original built-in image generation outputs and exact prompts:
  `asset/animation-polish/{popo-source.png,swiftee-source.png,prompts.txt}`.
- Runtime transparent atlases: `assets/sprites/popo-personality.png` (36 frames) and
  `assets/sprites/swiftee-personality.png` (16 frames).
- Registration metadata: `src/personality-data.js`. Rebuild with
  `python3 tools/build-personality.py` (Python Playwright and Chromium).
- Preview timing: `asset/animation-polish/clips.js`; gameplay holds and attachment
  positions live in `src/popo.js` and `src/swiftee.js`.

Packing removes exterior generation speckles, retains original source files and aligns
the lower body/feet to a shared anchor at one scale per character. All frames have at
least 18 pixels of transparent clearance. Animation uses timed key poses; loop endpoints
repeat their opening pose, without transparent crossfades between different silhouettes.

Popo now blinks and talks, makes a separate catch celebration, visibly strains while
reeling and dances at completion. The rod rests on the raft during gestures and follows
his grip when fishing. Character hops move independently of the raft. Swiftee talks,
blinks and points at the recall diagram. Existing casting, rowing and full splash art
remain in use. Consecutive mistakes alternate the full splash and a shorter wobble;
a correct catch or new level resets that variation. Wet recovery can be interrupted by
the next cast. All acting uses the game clock and pauses with gameplay; reduced motion
holds quieter reaction poses.

Checks: `python3 tests/personality_assets.py` verifies all sprite bounds, alpha and preview
loops; `python3 tests/personality.py` covers pause, rod/raft registration, repeated short
retries, restart cancellation and a subsequent catch on desktop, mobile and reduced-motion
layouts. Existing `tests/mishap.py`, `tests/rowing.py` and `tests/playthrough.py` exercise
the established sequences. Preview screenshots are written to `/tmp/popo-animation-review`.
