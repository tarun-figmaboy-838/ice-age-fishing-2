(function (PopoGame) {
'use strict';

const $ = (id) => document.getElementById(id);

class UI {
  constructor() {
    this.el = {
      hud: $('hud'), hits: $('hits'), hand: $('hand'), start: $('screen-start'), loading: $('loading'), loadingText: $('loading-text'), retry: $('btn-retry'), play: $('btn-play'),
      instruction: $('instruction'), instructionText: $('instruction-text'), next: $('btn-next'),
      sound: $('btn-sound'), pause: $('btn-pause'),
      pauseOverlay: $('overlay-pause'), resume: $('btn-resume'), restart: $('btn-restart'),
      rotate: $('rotate-hint'), scene: $('scene'), speech: $('speech'),
    };
    this.handlers = {};
    this.hitButtons = new Map();
    this.scale = 1;
    this.hitsEnabled = false;
    const h = (name) => (e) => { e.preventDefault(); this.emit(name); };
    this.el.play.addEventListener('click', h('play'));
    this.el.play.addEventListener('pointerenter', () => this.emit('playHover', true));
    this.el.play.addEventListener('pointerleave', () => this.emit('playHover', false));
    this.el.play.addEventListener('pointerdown', () => this.emit('playPress'));
    this.el.sound.addEventListener('click', h('sound'));
    this.el.pause.addEventListener('click', h('pause'));
    this.el.resume.addEventListener('click', h('resume'));
    this.el.restart.addEventListener('click', h('restart'));
    this.el.next.addEventListener('click', h('next'));
    this.el.retry.addEventListener('click', () => location.reload());
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }

  emit(name, ...args) {
    if (this.handlers[name]) this.handlers[name](...args);
  }

  // A story line: Popo's or Swiftee's speech bubble, anchored at a stage point. The whole line is
  // laid out once, balanced over its lines, and each line break is pinned there; then the bubble
  // starts small and grows word by word into exactly that shape, with no empty space ahead.
  showLine(who, words) {
    this.hideLines();
    const el = this.el.speech;
    const line = el.querySelector('.line');
    line.innerHTML = '';
    this.wordEls = words.map((w, i) => {
      const span = document.createElement('span');
      span.className = w.em ? 'w em' : 'w';
      span.textContent = i < words.length - 1 ? `${w.text} ` : w.text;
      line.appendChild(span);
      return span;
    });
    el.classList.toggle('swiftee', who === 'swiftee');
    el.hidden = false;
    el.classList.add('measuring');
    // a word's middle, not its top: the bigger stressed words sit higher in the same line
    const mids = this.wordEls.map((span) => span.offsetTop + span.offsetHeight / 2);
    const em = parseFloat(getComputedStyle(el).fontSize);
    this.speechBox = { w: el.offsetWidth, h: el.offsetHeight, em };
    el.classList.remove('measuring');
    this.breaks = this.wordEls.map((span, i) => {
      if (!i || mids[i] - mids[i - 1] < em * 0.6) return null;
      const br = document.createElement('br');
      line.insertBefore(br, span);
      return br;
    });
    el.classList.remove('pop', 'bump');
    void el.offsetWidth;
    el.classList.add('pop');
    this.el.hud.classList.add('talking');
    this.lineEl = el;
  }

  revealWord(i, bump) {
    const span = this.wordEls && this.wordEls[i];
    if (span) span.classList.add('in');
    if (this.breaks && this.breaks[i]) this.breaks[i].classList.add('in');
    if (bump && this.lineEl) {
      this.el.speech.classList.remove('pop', 'bump');
      void this.el.speech.offsetWidth;
      this.el.speech.classList.add('bump');
    }
  }

  placePlay(x, y, r) {
    const k = this.scale;
    const s = this.el.play.style;
    s.transform = `translate(${((x - r) * k).toFixed(1)}px, ${((y - r) * k).toFixed(1)}px)`;
    s.width = s.height = `${(2 * r * k).toFixed(1)}px`;
  }

  // (x, y) is where the tail points. The bubble sits above and to the right of it, so it's
  // nudged down or left when it would run off the top or right of the stage.
  placeSpeech(x, y) {
    const b = this.speechBox || { w: 0, h: 0, em: 0 };
    const width = this.el.hits.clientWidth;
    const left = Math.min(x * this.scale, width - b.w + 0.6 * b.em - 4);
    const top = Math.max(y * this.scale, b.h + 14); // clear of the top edge, even as it pops
    this.el.speech.style.left = `${left.toFixed(1)}px`;
    this.el.speech.style.top = `${top.toFixed(1)}px`;
  }

  hideLines() {
    this.el.speech.hidden = true;
    this.el.hud.classList.remove('talking');
    this.lineEl = null;
    this.wordEls = null;
    this.breaks = null;
  }


  setScale(scale) {
    this.scale = scale;
  }

  toStage(clientX, clientY) {
    const r = this.el.hits.getBoundingClientRect();
    return { x: (clientX - r.left) / this.scale, y: (clientY - r.top) / this.scale };
  }

  // The loading bar, from 0 to 1.
  setLoading(k) {
    const pct = Math.round(Math.max(0, Math.min(1, k)) * 100);
    this.el.loading.style.setProperty('--p', pct / 100);
    this.el.loading.setAttribute('aria-valuenow', pct);
  }

  // The banner is up: Play can be pressed, and the bar moves down out of its way.
  showTitle() {
    this.el.start.classList.add('titled');
    this.el.start.parentElement.classList.remove('booting');
    this.el.play.disabled = false;
  }

  // Play was pressed before everything arrived.
  waitForLoad() {
    this.el.loading.classList.add('waiting');
    this.el.loadingText.textContent = 'Get ready…';
  }

  loaded() {
    this.el.loading.classList.add('done');
  }

  loadFailed() {
    this.el.loading.classList.add('failed');
    this.el.loadingText.textContent = 'Could not load the game.';
    this.el.retry.hidden = false;
    this.el.play.disabled = true;
  }

  hideStart() {
    this.el.start.classList.add('fade-out');
    setTimeout(() => { this.el.start.hidden = true; }, 500);
  }

  showStart() {
    this.el.start.hidden = false;
    this.el.start.classList.remove('fade-out');
    this.el.hud.hidden = true;
  }

  showHud() {
    this.el.hud.hidden = false;
  }


  // *word* is highlighted (what to look for). The panel gives a little boing on every change.
  setInstruction(text) {
    const el = this.el.instructionText;
    this.el.instruction.classList.toggle('empty', !text);
    if (text === this.instructionShown) return;
    this.instructionShown = text;
    el.textContent = '';
    text.split(/(\*[^*]+\*)/).forEach((part) => {
      if (!part) return;
      if (part.startsWith('*')) {
        const b = document.createElement('b');
        b.className = 'hl';
        b.textContent = part.slice(1, -1);
        el.appendChild(b);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
    if (!text) return;
    this.el.instruction.classList.remove('say', 'pulse');
    void this.el.instruction.offsetWidth;
    this.el.instruction.classList.add('say');
  }


  pulseTarget() {
    this.el.instruction.classList.remove('pulse', 'say');
    void this.el.instruction.offsetWidth;
    this.el.instruction.classList.add('pulse');
  }

  setSound(muted) {
    this.el.sound.setAttribute('aria-pressed', String(!muted));
    this.el.sound.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
    this.el.sound.classList.toggle('muted', muted);
  }

  showPause(show) {
    this.el.pauseOverlay.hidden = !show;
    if (show) this.el.resume.focus();
  }

  // --- fish hit targets -------------------------------------------------
  setHitsEnabled(on) {
    this.hitsEnabled = on;
    this.el.hits.classList.toggle('enabled', on);
  }

  syncHits(fishList) {
    const alive = new Set();
    for (const fish of fishList) {
      if (fish.gone || fish.offstage) continue;
      alive.add(fish);
      let btn = this.hitButtons.get(fish);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fish-hit';
        btn.setAttribute('aria-label', fish.label);
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.emit('fishTap', fish, this.toStage(e.clientX, e.clientY)); });
        btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.emit('fishTap', fish, null); } });
        this.el.hits.appendChild(btn);
        this.hitButtons.set(fish, btn);
      }
      const r = fish.hitRect();
      const k = this.scale;
      btn.style.transform = `translate(${(r.x * k).toFixed(1)}px, ${(r.y * k).toFixed(1)}px)`;
      btn.style.width = `${Math.max(44, r.w * k).toFixed(1)}px`;
      btn.style.height = `${Math.max(44, r.h * k).toFixed(1)}px`;
    }
    for (const [fish, btn] of this.hitButtons) {
      if (!alive.has(fish)) { btn.remove(); this.hitButtons.delete(fish); }
    }
  }

  clearHits() {
    for (const btn of this.hitButtons.values()) btn.remove();
    this.hitButtons.clear();
  }

  // --- tutorial hand --------------------------------------------------------
  showHand() { this.el.hand.hidden = false; }
  hideHand() { this.el.hand.hidden = true; }
  moveHand(x, y) {
    this.el.hand.style.transform = `translate(${(x * this.scale).toFixed(1)}px, ${(y * this.scale).toFixed(1)}px)`;
  }

  // --- Next, at the end ------------------------------------------------------
  showNext() {
    this.el.next.hidden = false;
    this.el.next.focus({ preventScroll: true });
  }

  hideNext() {
    this.el.next.hidden = true;
  }

  showRotateHint(show) {
    this.el.rotate.hidden = !show;
  }
}

Object.assign(PopoGame, { UI });
})(window.PopoGame = window.PopoGame || {});
