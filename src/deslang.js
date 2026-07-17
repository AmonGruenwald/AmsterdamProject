// Inside Koffieshop De Slang: the 2D arcade Amsterdam, fully native.
// Ported from the standalone snake game (formerly snake.html / index.html) —
// same rules, same feel, same secret. The wallet is now THE simulator wallet:
// you walk in with your stroopwafels and you walk out with what's left.
//
// The hidden code works anywhere, anytime — even out on the street.

const GRID = 20;
const BEST_KEY = 'amsterdam-snake-best';
const MUTE_KEY = 'amsterdam-snake-muted';

const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const FLAVOUR = [
  'Straight into the canal. Classic.',
  'You rode into yourself. Even the tourists are impressed.',
  'The bike accepts the wall. The wall does not accept the bike.',
  'A tram would have been kinder.',
  'Ambitious cornering. Poor outcome.',
  'The heron saw the whole thing. The heron says nothing.',
  'You have reached your final destination. It is a canal.',
  "Nine million bikes in this city. This one's in the water.",
  'Somewhere, a rental company is preparing an invoice.',
  'Physics: 1. You: 0. Stroopwafels: still delicious.',
  "The canal files this under 'Tuesday'.",
  'Even the ducks are judging you.',
  "That'll be a €50 fishing-out fee. Pin of contant?",
];

export class DeSlang {
  // opts: { getWallet, setWallet, onExit, onTulipMania }
  constructor(opts) {
    this.opts = opts;
    this.isOpen = false;

    const $ = (id) => document.getElementById(id);
    this.root = $('deslang');
    this.canvas = $('ds-board');
    this.ctx = this.canvas.getContext('2d');
    this.overlay = $('ds-overlay');
    this.shopEl = $('ds-shop');
    this.shopItemsEl = $('ds-shop-items');
    this.shopWalletEl = $('ds-shop-wallet');
    this.pauseBtn = $('ds-pause');
    this.muteBtn = $('ds-mute');
    this.elWallet = $('ds-wallet');
    this.elBest = $('ds-best');
    this.elSpeed = $('ds-speed');
    this.fxBar = $('ds-fx');
    this.toastsEl = $('ds-toasts');
    this.splashHtml = this.overlay.innerHTML; // keep the art for re-entry

    this.best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    this.audio = { ctx: null, master: null, muted: localStorage.getItem(MUTE_KEY) === '1', noise: null };
    this.muteBtn.textContent = this.audio.muted ? '🔇' : '🔊';

    this.particles = [];
    this.glints = [];
    this.shake = { t: 0, max: 1, mag: 0 };
    this.cell = 24;
    this.konami = 0;
    this.tulipMania = false;
    this.fx = { espresso: 0, cake: 0, ghost: 0 };
    this.running = false;
    this.alive = false;
    this._seedGlints();

    this.ITEMS = [
      { emoji: '☕', name: 'Espresso Shot', cost: 3,
        desc: 'Double stroopwafels for 10s. Faster. Wired.',
        apply: () => { this.fx.espresso = 10; this.burst(this.headPx().x, this.headPx().y, { colors: ['#ffcf87', '#c9791f', '#6b3d10'], n: 22, glow: true }); } },
      { emoji: '🍰', name: 'Space Cake', cost: 5,
        desc: 'Time slows for 12s. Everything is fine.',
        apply: () => { this.fx.cake = 12; this.burst(this.headPx().x, this.headPx().y, { colors: ['#ff9ff3', '#a29bfe', '#74b9ff', '#ffeaa7'], n: 28, speed: 70, glow: true }); } },
      { emoji: '👻', name: 'Ghost Bike', cost: 8,
        desc: 'Phase through walls & yourself for 8s.',
        apply: () => { this.fx.ghost = 8; this.burst(this.headPx().x, this.headPx().y, { colors: ['#a9e7ff', '#ffffff', '#8ecbff'], n: 24, glow: true }); } },
      { emoji: '🧹', name: 'Straighten Out', cost: 4,
        desc: 'Trim your tail back to a tidy 3.',
        apply: () => {
          while (this.snake.length > 3) {
            const s = this.snake.pop();
            this.burst(s.x * this.cell + this.cell / 2, s.y * this.cell + this.cell / 2, { colors: ['#f4a340', '#ffbf69'], n: 5, size: 2.5 });
          }
        } },
    ];
    this.TULIP = { emoji: '🌷', name: 'Tulip Bulb', cost: 12, secret: true,
      desc: "Speculative bubble: 2× points for 20s AND phase for 6s. It'll be fine.",
      apply: () => {
        this.fx.espresso = 20; this.fx.ghost = 6;
        this.burst(this.headPx().x, this.headPx().y, { colors: ['#ff6fae', '#ffd36b', '#8affc1', '#a29bfe', '#ff8f8f'], n: 40, speed: 130, glow: true });
        this.addShake(7, 0.4);
        this.toast('🌷 The bubble will never burst');
      } };

    this._wireInput();
    this.reset();
    this.fitCanvas();

    // opt-in dev seam (?dev), preserved from the standalone version
    if (new URLSearchParams(location.search).has('dev')) {
      window.snakeDev = {
        state: () => ({ score: this.score, wallet: this.wallet, eaten: this.eaten,
          alive: this.alive, running: this.running, paused: this.paused, inShop: this.inShop,
          combo: this.combo, comboMult: this.comboMult(), tulipMania: this.tulipMania,
          fx: { ...this.fx }, coffeeshop: this.coffeeshop, snakeLen: this.snake.length,
          particles: this.particles.length }),
        grant: (n) => { this.wallet += n; this.score += n; if (this.score > this.best) this.best = this.score; this.updateHud(); },
        spawnShop: () => this.placeCoffeeshop(),
        konami: (key) => this.konamiKey(key),
        openShop: () => this.openShop(), buy: (i) => this.buy(i), closeShop: () => this.closeShop(),
        start: () => this.start(), unlockSecret: () => this.unlockSecret(), items: this.ITEMS,
      };
    }
  }

  /* ------------- open / close (the door) ------------- */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    // your street stroopwafels come in with you
    this.wallet = this.opts.getWallet();
    this.root.classList.add('open');
    this.overlay.innerHTML = this.splashHtml;
    this.overlay.classList.remove('hidden');
    this.shopEl.classList.add('hidden');
    this.pauseBtn.hidden = true;
    this._wireSplash();
    this.fitCanvas();
    this.updateHud();
    this.draw();
  }

  exit() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.running = false;
    this.inShop = false;
    this.root.classList.remove('open');
    this.opts.setWallet(this.wallet); // and what's left comes back out
    this.opts.onExit?.();
  }

  _wireSplash() {
    const btn = this.overlay.querySelector('#ds-play');
    if (btn) btn.addEventListener('click', () => this.start());
  }

  /* ------------- audio: procedural, no files ------------- */
  initAudio() {
    const a = this.audio;
    if (a.ctx) { if (a.ctx.state === 'suspended') a.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    a.ctx = new AC();
    a.master = a.ctx.createGain();
    a.master.gain.value = a.muted ? 0 : 0.3;
    a.master.connect(a.ctx.destination);
    const len = a.ctx.sampleRate * 0.5;
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    a.noise = buf;
  }

  beep(freq, dur, type = 'square', vol = 0.4, slideTo = null, when = 0) {
    const a = this.audio;
    if (!a.ctx) return;
    const t0 = a.ctx.currentTime + when;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  sSplash() {
    const a = this.audio;
    if (!a.ctx || !a.noise) return;
    const t0 = a.ctx.currentTime;
    const s = a.ctx.createBufferSource(); s.buffer = a.noise;
    const f = a.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1800, t0);
    f.frequency.exponentialRampToValueAtTime(200, t0 + 0.45);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    s.connect(f); f.connect(g); g.connect(a.master);
    s.start(t0); s.stop(t0 + 0.5);
    this.beep(320, 0.4, 'sine', 0.3, 90);
  }
  sEat(combo = 0) { this.beep(520 + Math.min(combo, 8) * 60, 0.09, 'square', 0.35, 900 + Math.min(combo, 8) * 60); }
  sGold() { [784, 1047, 1319].forEach((f, i) => this.beep(f, 0.13, 'triangle', 0.32, null, i * 0.05)); }
  sShop() { this.beep(880, 0.12, 'sine', 0.3); this.beep(1320, 0.18, 'sine', 0.25, null, 0.08); }
  sBuy() { this.beep(660, 0.09, 'triangle', 0.35); this.beep(990, 0.12, 'triangle', 0.3, null, 0.07); }
  sPower() { [523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.12, 'triangle', 0.28, null, i * 0.06)); }
  sSecret() { [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) => this.beep(f, 0.16, 'triangle', 0.3, null, i * 0.09)); }

  toggleMute() {
    const a = this.audio;
    a.muted = !a.muted;
    localStorage.setItem(MUTE_KEY, a.muted ? '1' : '0');
    this.muteBtn.textContent = a.muted ? '🔇' : '🔊';
    if (a.master) a.master.gain.value = a.muted ? 0 : 0.3;
  }

  /* ------------- toasts & shake ------------- */
  toast(text, hold = 1.8) {
    const el = document.createElement('div');
    el.className = 'ds-toast';
    el.style.setProperty('--hold', hold + 's');
    el.textContent = text;
    this.toastsEl.append(el);
    setTimeout(() => el.remove(), (hold + 0.7) * 1000);
    while (this.toastsEl.children.length > 3) this.toastsEl.firstChild.remove();
  }
  addShake(mag, dur = 0.35) {
    const s = this.shake;
    if (mag >= s.mag * (s.t / (s.max || 1))) { s.mag = mag; s.t = dur; s.max = dur; }
  }

  /* ------------- particles ------------- */
  burst(px, py, opts) {
    const n = opts.n || 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 90) * (0.35 + Math.random() * 0.9);
      this.particles.push({
        x: px, y: py,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.lift || 0),
        life: (opts.life || 0.6) * (0.7 + Math.random() * 0.6),
        max: opts.life || 0.6,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.9),
        grav: opts.grav != null ? opts.grav : 260,
        color: opts.colors[(Math.random() * opts.colors.length) | 0],
        glow: !!opts.glow,
      });
    }
  }
  _seedGlints() {
    this.glints = [];
    for (let i = 0; i < 22; i++) {
      this.glints.push({
        x: Math.random(), y: Math.random(),
        vy: -(0.01 + Math.random() * 0.03),
        r: 0.5 + Math.random() * 1.6,
        ph: Math.random() * Math.PI * 2,
      });
    }
  }
  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (const g of this.glints) {
      g.y += g.vy * dt; g.ph += dt * 2;
      if (g.y < -0.02) { g.y = 1.02; g.x = Math.random(); }
    }
  }

  /* ------------- the secret: Tulip Mania ------------- */
  konamiKey(key) {
    key = key.length === 1 ? key.toLowerCase() : key;
    this.konami = (key === KONAMI[this.konami]) ? this.konami + 1 : (key === KONAMI[0] ? 1 : 0);
    if (this.konami === KONAMI.length) { this.konami = 0; this.unlockSecret(); }
  }

  unlockSecret() {
    const firstTime = !this.tulipMania;
    if (firstTime) {
      this.tulipMania = true;
      if (!this.ITEMS.some((it) => it.secret)) this.ITEMS.push(this.TULIP);
    }
    this.initAudio(); this.sSecret();
    this.toast('🌷🌷 TULIP MANIA UNLOCKED 🌷🌷', 3);
    this.toast('Golden hour on the canals · secret item in the koffieshop', 3);
    if (this.running && this.alive) {
      this.wallet += 15; this.score += 15;
      if (this.score > this.best) { this.best = this.score; localStorage.setItem(BEST_KEY, this.best); }
      this.updateHud();
    }
    this.addShake(9, 0.6);
    const px = this.cell * GRID;
    for (let i = 0; i < 90; i++) {
      this.particles.push({
        x: Math.random() * px, y: -Math.random() * px * 0.4,
        vx: (Math.random() * 2 - 1) * 40, vy: 90 + Math.random() * 140,
        life: 1.2 + Math.random() * 1.4, max: 2.6,
        size: 2 + Math.random() * 3, grav: 60,
        color: ['#ff6fae', '#ffd36b', '#8affc1', '#a29bfe', '#ffffff'][(Math.random() * 5) | 0],
        glow: true,
      });
    }
    // ...and the mania escapes into the 3D city
    if (firstTime) this.opts.onTulipMania?.();
    if (!this.isOpen) this.draw?.();
  }

  /* ------------- board & state ------------- */
  fitCanvas() {
    const maxW = Math.min(window.innerWidth - 16, 560);
    const maxH = window.innerHeight - 250;
    const size = Math.max(200, Math.min(maxW, maxH));
    this.cell = Math.floor(size / GRID);
    const px = this.cell * GRID;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = px * dpr; this.canvas.height = px * dpr;
    this.canvas.style.width = px + 'px'; this.canvas.style.height = px + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.snake) this.draw();
  }

  reset() {
    this.snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    this.dir = { x: 1, y: 0 }; this.nextDir = this.dir;
    this.score = 0; this.eaten = 0; this.speed = 1;
    this.combo = 0; this.comboTimer = 0;
    this.acc = 0; this.lastT = 0;
    this.alive = true; this.paused = false; this.inShop = false;
    this.coffeeshop = null; this.food = null;
    this.fx.espresso = this.fx.cake = this.fx.ghost = 0;
    this.shake.t = 0; this.shake.mag = 0;
    this.particles = [];
    this.placeFood();
    this.updateHud();
  }

  headPx() {
    const h = this.snake[0];
    return { x: h.x * this.cell + this.cell / 2, y: h.y * this.cell + this.cell / 2 };
  }

  freeCells() {
    const occ = new Set(this.snake.map((s) => s.y * GRID + s.x));
    if (this.food) occ.add(this.food.y * GRID + this.food.x);
    if (this.coffeeshop) occ.add(this.coffeeshop.y * GRID + this.coffeeshop.x);
    const free = [];
    for (let i = 0; i < GRID * GRID; i++) if (!occ.has(i)) free.push(i);
    return free;
  }

  placeFood() {
    const occ = new Set(this.snake.map((s) => s.y * GRID + s.x));
    if (this.coffeeshop) occ.add(this.coffeeshop.y * GRID + this.coffeeshop.x);
    const free = [];
    for (let i = 0; i < GRID * GRID; i++) if (!occ.has(i)) free.push(i);
    if (!free.length) { this.food = null; this.win(); return; }
    const i = free[(Math.random() * free.length) | 0];
    const golden = Math.random() < (this.tulipMania ? 0.28 : 0.16);
    this.food = { x: i % GRID, y: (i / GRID) | 0, golden };
  }

  placeCoffeeshop() {
    const free = this.freeCells();
    if (!free.length) return;
    const i = free[(Math.random() * free.length) | 0];
    this.coffeeshop = { x: i % GRID, y: (i / GRID) | 0 };
  }

  comboMult() { return 1 + Math.min(4, Math.floor(this.combo / 3)); }

  updateHud() {
    this.elWallet.textContent = this.wallet ?? 0;
    this.elBest.textContent = this.best;
    this.elSpeed.textContent = this.speed;
    const chips = [];
    if (this.comboMult() > 1) chips.push(`<span class="fx-chip fx-combo">🔥 ${this.comboMult()}× combo</span>`);
    if (this.fx.espresso > 0) chips.push(`<span class="fx-chip fx-espresso">☕ 2× ${Math.ceil(this.fx.espresso)}s</span>`);
    if (this.fx.cake > 0) chips.push(`<span class="fx-chip fx-cake">🍰 slow ${Math.ceil(this.fx.cake)}s</span>`);
    if (this.fx.ghost > 0) chips.push(`<span class="fx-chip fx-ghost">👻 ${Math.ceil(this.fx.ghost)}s</span>`);
    if (this.tulipMania) chips.push(`<span class="fx-chip fx-tulip">🌷 mania</span>`);
    this.fxBar.innerHTML = chips.join('');
    // live-mirror the shared wallet to the street HUD
    if (this.isOpen) this.opts.setWallet(this.wallet ?? 0);
  }

  stepInterval() {
    let sps = 6 + Math.min(9, Math.floor(this.score / 3));
    this.speed = 1 + Math.min(9, Math.floor(this.score / 3));
    if (this.fx.espresso > 0) sps += 3;
    let iv = 1000 / sps;
    if (this.fx.cake > 0) iv *= 1.75;
    return iv;
  }

  setDir(d) {
    if (!this.running || this.paused || this.inShop || !this.alive) return;
    if (d.x === -this.dir.x && d.y === -this.dir.y) return;
    this.nextDir = d;
  }

  tick() {
    this.dir = this.nextDir;
    let hx = this.snake[0].x + this.dir.x, hy = this.snake[0].y + this.dir.y;
    const ghosting = this.fx.ghost > 0;

    if (hx < 0 || hy < 0 || hx >= GRID || hy >= GRID) {
      if (ghosting) { hx = (hx + GRID) % GRID; hy = (hy + GRID) % GRID; }
      else return this.gameOver();
    }
    const head = { x: hx, y: hy };
    const hitSelf = this.snake.some((s) => s.x === hx && s.y === hy);
    if (hitSelf && !ghosting) return this.gameOver();

    this.snake.unshift(head);

    const hp = { x: head.x * this.cell + this.cell / 2, y: head.y * this.cell + this.cell / 2 };
    this.particles.push({ x: hp.x, y: hp.y, vx: -this.dir.x * 20, vy: -this.dir.y * 20,
      life: 0.28, max: 0.28, size: this.cell * 0.12, grav: 0,
      color: this.tulipMania ? '#ff9ff3' : '#ffbf69', glow: true });

    if (this.food && head.x === this.food.x && head.y === this.food.y) {
      const golden = !!this.food.golden;
      this.combo++; this.comboTimer = 2.4;
      const base = (this.fx.espresso > 0 ? 2 : 1) * (golden ? 3 : 1) * this.comboMult();
      this.score += base; this.wallet += base; this.eaten++;
      if (this.score > this.best) { this.best = this.score; localStorage.setItem(BEST_KEY, this.best); }
      const cols = golden ? ['#ffe08a', '#ffd23f', '#fff6cf', '#c9791f']
                          : ['#d9a441', '#ffbf69', '#8a5a1e', '#fff3d6'];
      this.burst(hp.x, hp.y, { colors: cols, n: golden ? 30 : 16, size: golden ? 4 : 3, speed: golden ? 130 : 90, glow: true });
      if (golden) { this.sGold(); this.addShake(4, 0.3); this.toast(`✨ Golden stroopwafel · +${base}`, 1.3); }
      else this.sEat(this.combo);
      if (this.comboMult() >= 3 && this.combo % 3 === 0) this.toast(`🔥 ${this.comboMult()}× combo!`, 1.1);
      this.placeFood();
      if (this.eaten % 4 === 0 && !this.coffeeshop) this.placeCoffeeshop();
      this.updateHud();
    } else {
      this.snake.pop();
    }

    if (this.coffeeshop && head.x === this.coffeeshop.x && head.y === this.coffeeshop.y) this.openShop();
  }

  /* ------------- rendering ------------- */
  draw() {
    const ctx = this.ctx, cell = this.cell;
    const px = cell * GRID;
    ctx.clearRect(0, 0, px, px);
    ctx.fillStyle = '#0e2036';
    ctx.fillRect(0, 0, px, px);
    if (this.fx.cake > 0) {
      const g = ctx.createLinearGradient(0, 0, px, px);
      g.addColorStop(0, 'rgba(255,120,220,.08)');
      g.addColorStop(0.5, 'rgba(120,180,255,.08)');
      g.addColorStop(1, 'rgba(255,230,120,.08)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, px, px);
    }
    if (this.tulipMania) {
      const hue = (performance.now() / 40) % 360;
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.05)`;
      ctx.fillRect(0, 0, px, px);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, px); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(px, i * cell); ctx.stroke();
    }
    for (const gl of this.glints) {
      const a = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(gl.ph));
      ctx.fillStyle = this.tulipMania ? `hsla(${(gl.ph * 40) % 360},80%,70%,${a})` : `rgba(150,200,255,${a})`;
      ctx.beginPath(); ctx.arc(gl.x * px, gl.y * px, gl.r, 0, 7); ctx.fill();
    }

    ctx.save();
    if (this.shake.t > 0) {
      const m = this.shake.mag * (this.shake.t / (this.shake.max || 1));
      ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
    }
    this.drawCoffeeshop();
    this.drawFood();
    this.drawSnake();
    this.drawParticles();
    ctx.restore();
  }

  drawFood() {
    if (!this.food) return;
    const ctx = this.ctx, cell = this.cell;
    const cx = this.food.x * cell + cell / 2, cy = this.food.y * cell + cell / 2;
    const r = cell * 0.36;
    const golden = !!this.food.golden;
    ctx.save();
    if (golden) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 140);
      ctx.shadowColor = 'rgba(255,210,80,.95)';
      ctx.shadowBlur = cell * (0.3 + 0.45 * pulse);
    }
    ctx.fillStyle = golden ? '#ffd23f' : '#d9a441';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = golden ? 'rgba(120,80,10,.55)' : 'rgba(90,54,12,.5)';
    ctx.lineWidth = Math.max(1, cell * 0.06);
    for (let a = 0; a < Math.PI; a += Math.PI / 5) {
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    if (golden) {
      const tw = (performance.now() / 200) % (Math.PI * 2);
      ctx.fillStyle = '#fff6cf';
      ctx.beginPath(); ctx.arc(cx + Math.cos(tw) * r * 0.5, cy + Math.sin(tw) * r * 0.5, cell * 0.06, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  drawCoffeeshop() {
    if (!this.coffeeshop) return;
    const ctx = this.ctx, cell = this.cell;
    const x = this.coffeeshop.x * cell, y = this.coffeeshop.y * cell;
    const pad = Math.max(1, cell * 0.1), w = cell - pad * 2;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    ctx.save();
    ctx.shadowColor = 'rgba(120,220,140,.9)';
    ctx.shadowBlur = cell * (0.35 + 0.25 * pulse);
    ctx.fillStyle = '#6b4226';
    this.roundRect(x + pad, y + pad, w, w, cell * 0.2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2ecc71';
    this.roundRect(x + pad, y + pad, w, w * 0.34, cell * 0.16); ctx.fill();
    ctx.fillStyle = `rgba(255,240,200,${0.6 + 0.4 * pulse})`;
    ctx.beginPath(); ctx.arc(x + cell / 2, y + cell * 0.62, cell * 0.14, 0, 7); ctx.fill();
  }

  drawSnake() {
    const ctx = this.ctx, cell = this.cell;
    const ghosting = this.fx.ghost > 0;
    ctx.save();
    if (ghosting) ctx.globalAlpha = 0.55 + 0.25 * Math.sin(performance.now() / 120);
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const s = this.snake[i];
      const t = i / Math.max(1, this.snake.length - 1);
      const pad = Math.max(1, cell * 0.08);
      if (i === 0) {
        ctx.fillStyle = ghosting ? '#cdefff' : '#ffbf69';
      } else if (this.fx.cake > 0 || this.tulipMania) {
        ctx.fillStyle = `hsl(${(i * 24 + performance.now() / 8) % 360}, 80%, 62%)`;
      } else {
        const g = Math.round(196 - t * 70);
        ctx.fillStyle = `rgb(244, ${Math.max(120, g)}, ${Math.round(64 - t * 30)})`;
      }
      this.roundRect(s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
      ctx.fill();
    }
    ctx.restore();
    const h = this.snake[0];
    const hx = h.x * cell + cell / 2, hy = h.y * cell + cell / 2;
    ctx.fillStyle = '#1a1005';
    const off = cell * 0.16, er = Math.max(1, cell * 0.07);
    const ex = this.dir.y !== 0 ? off : this.dir.x * off * 0.6;
    const ey = this.dir.x !== 0 ? off : this.dir.y * off * 0.6;
    ctx.beginPath(); ctx.arc(hx - (this.dir.y ? off : ex), hy - (this.dir.x ? off : ey), er, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + (this.dir.y ? off : ex), hy + (this.dir.x ? off : ey), er, 0, 7); ctx.fill();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = p.size * 3; }
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ------------- loop ------------- */
  frame(t) {
    if (!this.running || !this.isOpen) return;
    if (!this.lastT) this.lastT = t;
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (dt > 0.1) dt = 0.1;

    if (this.alive && !this.paused && !this.inShop) {
      this.fx.espresso = Math.max(0, this.fx.espresso - dt);
      this.fx.cake = Math.max(0, this.fx.cake - dt);
      this.fx.ghost = Math.max(0, this.fx.ghost - dt);
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) { this.combo = 0; this.updateHud(); }
      }
      this.acc += dt * 1000;
      const iv = this.stepInterval();
      while (this.acc >= iv) { this.acc -= iv; this.tick(); if (!this.alive || this.inShop) break; }
      this.updateHud();
    }
    if (this.shake.t > 0) this.shake.t = Math.max(0, this.shake.t - dt);
    this.updateParticles(dt);
    this.draw();
    requestAnimationFrame((t2) => this.frame(t2));
  }

  start() {
    this.initAudio();
    const wallet = this.wallet; // survives resets: it's the street wallet
    this.reset();
    this.wallet = wallet;
    this.updateHud();
    this.running = true;
    this.overlay.classList.add('hidden');
    this.shopEl.classList.add('hidden');
    this.pauseBtn.hidden = false;
    this.pauseBtn.textContent = '⏸ Pause';
    this.lastT = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  togglePause() {
    if (!this.running || !this.alive || this.inShop) return;
    this.paused = !this.paused;
    this.pauseBtn.textContent = this.paused ? '▶ Resume' : '⏸ Pause';
    if (this.paused) this.showOverlay('⏸ Paused', "Take a breath. The canal isn't going anywhere.", 'Resume', false);
    else { this.overlay.classList.add('hidden'); this.lastT = 0; }
  }

  gameOver() {
    this.alive = false; this.running = false; this.inShop = false;
    this.pauseBtn.hidden = true;
    this.burst(this.headPx().x, this.headPx().y, { colors: ['#7ec8ff', '#bfe6ff', '#4a90d9', '#ffffff'], n: 30, speed: 150, life: 0.8, grav: 340, glow: true });
    this.addShake(9, 0.5);
    this.sSplash();
    const msg = FLAVOUR[(Math.random() * FLAVOUR.length) | 0];
    this.showOverlay('🚲💦 Splash', msg, 'Ride again', true);
  }

  win() {
    this.alive = false; this.running = false; this.inShop = false;
    this.pauseBtn.hidden = true;
    this.showOverlay('🧇🏆 Gouden Fiets', 'You filled the entire canal ring with bike. Amsterdam surrenders.', 'Ride again', true);
  }

  showOverlay(title, text, btnLabel, showScore) {
    this.overlay.innerHTML = '';
    const h = document.createElement('h1');
    h.innerHTML = title.replace('Snake', '<span>Snake</span>');
    const p = document.createElement('p'); p.textContent = text;
    this.overlay.append(h, p);
    if (showScore) {
      const sl = document.createElement('p'); sl.className = 'score-line';
      sl.innerHTML = `🧇 <b>${this.wallet}</b> stroopwafels &nbsp;·&nbsp; 🏆 best <b>${this.best}</b>`;
      this.overlay.append(sl);
    }
    const b = document.createElement('button');
    b.className = 'ds-play'; b.textContent = btnLabel;
    b.addEventListener('click', () => { if (title.startsWith('⏸')) this.togglePause(); else this.start(); });
    this.overlay.append(b);
    const out = document.createElement('p');
    out.className = 'hint';
    out.innerHTML = '<a href="#" id="ds-overlay-exit">…or step back outside</a>';
    out.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); this.exit(); });
    this.overlay.append(out);
    this.overlay.classList.remove('hidden');
  }

  /* ------------- shop ------------- */
  openShop() {
    this.inShop = true;
    this.coffeeshop = null;
    this.pauseBtn.hidden = true;
    this.sShop();
    this.renderShop();
    this.shopEl.classList.remove('hidden');
  }
  renderShop() {
    this.shopWalletEl.textContent = this.wallet;
    this.shopItemsEl.innerHTML = '';
    this.ITEMS.forEach((it, idx) => {
      const b = document.createElement('button');
      b.className = 'shop-item';
      b.disabled = this.wallet < it.cost;
      b.innerHTML =
        `<span class="emoji">${it.emoji}</span>` +
        `<span class="txt"><span class="name">${idx + 1}. ${it.name}</span>` +
        `<span class="desc">${it.desc}</span></span>` +
        `<span class="cost">${it.cost} 🧇</span>`;
      b.addEventListener('click', () => this.buy(idx));
      this.shopItemsEl.append(b);
    });
  }
  buy(idx) {
    const it = this.ITEMS[idx];
    if (!it || this.wallet < it.cost || !this.inShop) return;
    this.wallet -= it.cost;
    it.apply();
    this.sBuy(); this.sPower();
    this.closeShop();
    this.updateHud();
  }
  closeShop() {
    this.inShop = false;
    this.shopEl.classList.add('hidden');
    this.pauseBtn.hidden = false;
    this.lastT = 0;
  }

  /* ------------- input ------------- */
  _wireInput() {
    window.addEventListener('keydown', (e) => {
      this.konamiKey(e.key); // the hidden code works anywhere — even on the street
      if (!this.isOpen) return;
      const k = e.key.toLowerCase();
      if (this.inShop) {
        if (k >= '1' && k <= String(this.ITEMS.length)) { e.preventDefault(); this.buy(parseInt(k, 10) - 1); }
        else if (k === 'escape' || k === 'l') this.closeShop();
        return;
      }
      const map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
      if (map[k]) { e.preventDefault(); this.setDir(DIRS[map[k]]); }
      else if (k === 'p') this.togglePause();
      else if (k === 'm') this.toggleMute();
      else if (k === 'escape') this.exit();
      else if ((k === ' ' || k === 'enter') && !this.running) { e.preventDefault(); this.start(); }
    }, { passive: false });

    document.getElementById('ds-pad').addEventListener('click', (e) => {
      const d = e.target.closest('button')?.dataset.dir;
      if (d) this.setDir(DIRS[d]);
    });

    // hidden mobile trigger: rapidly tap the 🧇 counter 7× to bloom the tulips
    let tapCount = 0, tapT = 0;
    document.getElementById('ds-secret-tap').addEventListener('click', () => {
      const now = performance.now();
      tapCount = (now - tapT < 600) ? tapCount + 1 : 1;
      tapT = now;
      if (tapCount >= 7) { tapCount = 0; this.unlockSecret(); }
    });

    let tsx = 0, tsy = 0, touching = false;
    this.canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; tsx = t.clientX; tsy = t.clientY; touching = true;
    }, { passive: true });
    this.canvas.addEventListener('touchend', (e) => {
      if (!touching) return; touching = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - tsx, dy = t.clientY - tsy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) this.setDir(dx > 0 ? DIRS.right : DIRS.left);
      else this.setDir(dy > 0 ? DIRS.down : DIRS.up);
    }, { passive: true });

    this.pauseBtn.addEventListener('click', () => this.togglePause());
    this.muteBtn.addEventListener('click', () => { this.initAudio(); this.toggleMute(); });
    document.getElementById('ds-shop-leave').addEventListener('click', () => this.closeShop());
    document.getElementById('ds-exit').addEventListener('click', () => this.exit());

    if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
      this.root.classList.add('touch');
    }
    window.addEventListener('resize', () => this.fitCanvas());
    window.addEventListener('orientationchange', () => this.fitCanvas());
  }
}
