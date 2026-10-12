(function (PopoGame) {
'use strict';
const { SHEET_DATA, FISH_ATLAS, PLACES } = PopoGame;

// Opened straight from the file system, WebGL may not read the paintings from their files, so
// the title and the backgrounds come from src/background-data.js as data URLs. Served over HTTP
// they load from assets/, each only when it is needed, which keeps the first screen quick.
const LOCAL = location.protocol === 'file:';
// Earlier deployments let browsers keep assets/ for a year; the suffix makes sure nobody is
// left drawing an old sheet with new frame data.
const V = '?v=2';

const SOURCES = {
  title: () => PopoGame.TITLE_DATA || `assets/backgrounds/title.webp${V}`,
  play: () => PopoGame.PLAY_DATA || `assets/sprites/play.webp${V}`,
  background: (i) => (PopoGame.BACKGROUND_DATA || [])[i] || `assets/backgrounds/location-${i + 1}.webp${V}`,
  // each background comes with a water mask (white where the surface waves may move it)
  mask: (i) => (PopoGame.WATER_MASKS || [])[i] || `assets/backgrounds/water-${i + 1}.png${V}`,
};

// The art behind Play, with rough sizes in KB that keep the loading bar moving evenly.
const SHEETS = [
  ['fishing', 'popo-fishing.webp', 210],
  ['rowing', 'popo-rowing.webp', 240],
  ['fish', 'fish.webp', 190],
  ['props', 'popo-props.webp', 60],
  ['mishapPoses', 'popo-mishap.webp', 720],
  ['rowCycle', 'popo-row-cycle.webp', 645],
  ['swiftee', 'swiftee.webp', 70],
  ['popoPersonality', 'popo-personality.webp', 1500],
  ['swifteePersonality', 'swiftee-personality.webp', 425],
  ['swifteeFront', 'swiftee-front-personality.webp', 300],
];
const VOICES = ['src/voice-data.js', 520];

const assets = {
  backgrounds: [],
  sheets: {},
  fish: null,
  ready: false, // everything has arrived and Play can start the game
};

const pending = new Map();
const scripts = new Map();

// Decoded as soon as it arrives, so the first frame that draws a big sheet doesn't stall.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      decoded.then(() => resolve(img));
    };
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => {
        scripts.delete(src);
        el.remove();
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(el);
    }));
  }
  return scripts.get(src);
}

// One more go after a short wait, for a phone whose connection drops for a moment.
function retry(load) {
  return load().catch(() => new Promise((r) => setTimeout(r, 1200)).then(load));
}

// Over HTTP an image is fetched, so the loading bar can follow its bytes as they arrive.
async function fetchImage(src, onBytes) {
  if (LOCAL || !window.fetch || !window.ReadableStream) {
    const img = await loadImage(src);
    onBytes(Infinity);
    return img;
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not load ${src}`);
  const size = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    onBytes(value.length, size);
  }
  const url = URL.createObjectURL(new Blob(parts, { type: res.headers.get('content-type') || '' }));
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function preloadBackground(index) {
  if (!pending.has(index)) {
    pending.set(index, Promise.all([retry(() => loadImage(SOURCES.background(index))), retry(() => loadImage(SOURCES.mask(index)))]).then(([img, mask]) => {
      img.waterMask = mask;
      assets.backgrounds[index] = img;
      return img;
    }, (err) => {
      pending.delete(index); // let the next attempt try again
      throw err;
    }));
  }
  return pending.get(index);
}

// First the banner and the Play button, so the title shows while everything else arrives.
async function loadTitle() {
  if (LOCAL) await retry(() => loadScript('src/background-data.js'));
  const [title, play] = await Promise.all([retry(() => loadImage(SOURCES.title())), retry(() => loadImage(SOURCES.play()))]);
  assets.title = title;
  assets.play = play;
}

// Everything else, reporting how much has arrived (0 to 1) as it goes.
async function loadCoreAssets(progress = () => {}) {
  const parts = [...SHEETS.map(([, , kb]) => kb), VOICES[1], 80].map((kb) => ({ want: kb * 1024, got: 0 }));
  const report = () => progress(parts.reduce((sum, p) => sum + Math.min(p.got, p.want), 0) / parts.reduce((sum, p) => sum + p.want, 0));
  const track = (part) => (bytes, size) => {
    if (size) part.want = size;
    part.got = bytes === Infinity ? part.want : part.got + bytes;
    report();
  };
  const done = (part) => (value) => { part.got = part.want; report(); return value; };
  report();
  const loaded = await Promise.all([
    ...SHEETS.map(([, file], i) => retry(() => {
      parts[i].got = 0;
      return fetchImage(`assets/sprites/${file}${V}`, track(parts[i]));
    }).then(done(parts[i]))),
    retry(() => loadScript(VOICES[0])).then(done(parts[SHEETS.length])),
    preloadBackground(PLACES[0].background).then(done(parts[SHEETS.length + 1])),
  ]);
  const got = Object.fromEntries(SHEETS.map(([key], i) => [key, loaded[i]]));
  Object.assign(assets, {
    swifteeFront: got.swifteeFront,
    popoPersonality: got.popoPersonality,
    swifteePersonality: got.swifteePersonality,
    rowCycle: got.rowCycle,
    swiftee: got.swiftee,
    props: got.props,
    mishapPoses: got.mishapPoses,
    sheets: {
      fishing: { img: got.fishing, data: SHEET_DATA.fishing },
      casting: { img: got.fishing, data: SHEET_DATA.fishing },
      rowing: { img: got.rowing, data: SHEET_DATA.rowing },
    },
    fish: { img: got.fish, boxes: FISH_ATLAS.boxes, mouths: FISH_ATLAS.mouths, width: FISH_ATLAS.width, height: FISH_ATLAS.height },
  });
  preloadBackground(PLACES[1].background);
  return loaded[loaded.length - 1];
}

Object.assign(PopoGame, { assets, loadImage, loadScript, preloadBackground, loadTitle, loadCoreAssets });
})(window.PopoGame = window.PopoGame || {});
