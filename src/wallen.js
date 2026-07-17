// De Wallen, populated. Dancers in the windows, kisses on the breeze,
// and a charm meter for cyclists who slow down to say hi.
// Everything here stays at the silhouette-and-wink level of detail.
import * as THREE from 'three';
import { inRedLight, REDLIGHT } from './city.js';

const FLIRT_LINES = [
  '💋 A wink from a window. You wobble into the general direction of a bollard.',
  '💋 Someone blows you a kiss. Your bell rings by itself. Traitor.',
  '💋 "Nice bike," says a voice like velvet. It is a very normal bike.',
  '💋 A dancer waves. You wave back with the hand you steer with. Bold.',
  '💋 Applause from a doorway as you pass. For the posture, surely.',
];

const DANCE_KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'];
const DANCE_GLYPH = { ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', ArrowRight: '→' };
const DANCE_BEAT = 0.68; // locked to WallenMuziek's tempo

// the streak escalates; the district has noticed you noticing
const STREAK_LINES = [
  '💘 Two windows are now competing for your attention. Diplomacy is required.',
  '💘 The dancers know you by silhouette now. You have a silhouette reputation.',
  '💘 Someone dims their light as you pass. In this district, that is a love letter.',
  '💞 The whole gracht sways when you cycle by. The neon buzzes in iambic pentameter.',
  '💞 A dancer mouths your name. You never told anyone your name.',
  '👑 The unofficial mayor of De Wallen. Your bell has diplomatic status here.',
];

const BELL_LINES = [
  '🔔💕 You ring your bell in De Wallen. Three windows ring back.',
  '🔔💕 The bell echoes down the canal. Somewhere, a curtain twitches approvingly.',
  '🔔💕 Ringing your bell here is basically flirting. Everyone understood it as such.',
];

let heartTex = null;
function heartTexture() {
  if (heartTex) return heartTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '48px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff5f8f'; g.shadowBlur = 12;
  g.fillText('💗', 32, 36);
  heartTex = new THREE.CanvasTexture(c);
  return heartTex;
}

function buildDancer(rng) {
  // silhouette figure: all suggestion, no anatomy lesson
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#1c060e' });
  const accent = new THREE.MeshLambertMaterial({
    color: '#ff2d6f', emissive: '#ff2d6f', emissiveIntensity: 0.8,
  });

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), mat);
  hips.scale.set(1, 0.75, 0.8);
  hips.position.y = 1.0;
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.5, 8), mat);
  waist.position.y = 1.35;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 10), mat);
  chest.scale.set(1, 0.9, 0.75);
  chest.position.y = 1.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), mat);
  head.position.y = 2.05;
  // long ponytail, for dramatic swishing
  const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.6, 6), mat);
  hair.position.set(0, 1.85, -0.18);
  hair.rotation.x = 0.35;
  const legGeo = new THREE.CylinderGeometry(0.09, 0.05, 1.0, 6);
  const legL = new THREE.Mesh(legGeo, mat); legL.position.set(0.14, 0.5, 0);
  const legR = new THREE.Mesh(legGeo, mat); legR.position.set(-0.14, 0.5, 0);
  const armGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.75, 6);
  const armL = new THREE.Mesh(armGeo, mat);
  armL.position.set(0.34, 1.55, 0); armL.rotation.z = 0.5;
  const armR = new THREE.Mesh(armGeo, mat);
  armR.position.set(-0.36, 1.75, 0); armR.rotation.z = -2.4; // one arm up, obviously
  // a glowing choker, the one point of colour
  const choker = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 12), accent);
  choker.position.y = 1.9;
  choker.rotation.x = Math.PI / 2;

  g.add(hips, waist, chest, head, hair, legL, legR, armL, armR, choker);
  g.userData = {
    armR, hips,
    phase: rng() * Math.PI * 2,
    tempo: 1.6 + rng() * 1.2,
    twirl: 0,               // >0 while spinning
    nextTwirl: 6 + rng() * 14,
  };
  return g;
}

// --- the district's own soundtrack: a slow, low, procedural groove ----------

export class WallenMuziek {
  constructor() {
    this.ctx = null;
    this.gain = null;
    this.nextNote = 0;
    this.step = 0;
    this.level = 0; // 0..1 fade
    this.heat = 0;  // 0..1 — how much the district likes you right now
    // A minor, walking low and unhurried
    this.bassline = [55.0, 65.41, 82.41, 73.42, 55.0, 82.41, 98.0, 73.42]; // A1 C2 E2 D2 ...
    this.leadNotes = [220, 261.63, 329.63, 392, 293.66, 329.63, 261.63, 246.94]; // a lazy pentatonic stroll
  }

  // must be called from a user gesture (the start button)
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      this.gain.connect(lp).connect(this.ctx.destination);
      this.nextNote = this.ctx.currentTime + 0.1;
    } catch { this.ctx = null; }
  }

  schedule(t, freq) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2.01; // lazy detuned octave: instant sleaze
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); o2.connect(g); g.connect(this.gain);
    o.start(t); o.stop(t + 0.6);
    o2.start(t); o2.stop(t + 0.6);
    // the sax-ish lead drifts in when the district is warming to you
    if (this.heat > 0.05 && this.step % 4 === 2) {
      const lf = this.leadNotes[((this.step / 4) | 0) % this.leadNotes.length];
      const lead = ctx.createOscillator();
      lead.type = 'sawtooth';
      lead.frequency.value = lf;
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.2;
      const vibGain = ctx.createGain();
      vibGain.gain.value = 9; // cents of longing
      vib.connect(vibGain).connect(lead.detune);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 2;
      const lg = ctx.createGain();
      const peak = 0.10 * this.heat;
      lg.gain.setValueAtTime(0.0001, t);
      lg.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + 0.14);
      lg.gain.setValueAtTime(Math.max(peak, 0.001), t + 0.45);
      lg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      lead.connect(lp).connect(lg).connect(this.gain);
      lead.start(t); lead.stop(t + 1.2);
      vib.start(t); vib.stop(t + 1.2);
    }
    // brushed hat on the off-beat
    if (this.step % 2 === 1) {
      const len = 0.06;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 6000;
      const hg = ctx.createGain(); hg.gain.value = 0.12;
      src.connect(hp).connect(hg).connect(this.gain);
      src.start(t + 0.28);
    }
  }

  update(dt, inside) {
    if (!this.ctx) return;
    this.level += ((inside ? 1 : 0) - this.level) * Math.min(1, dt * 1.5);
    this.gain.gain.value = this.level * 0.14;
    if (this.level < 0.02) return;
    const BEAT = 0.68; // ~88bpm, unhurried
    while (this.nextNote < this.ctx.currentTime + 0.4) {
      this.schedule(this.nextNote, this.bassline[this.step % this.bassline.length]);
      this.step++;
      this.nextNote += BEAT;
    }
  }

  // 1 on the beat, decaying to 0 — for anything that wants to throb in time
  pulse() {
    if (!this.ctx || this.level < 0.02) return 0;
    const BEAT = 0.68;
    const since = this.ctx.currentTime - (this.nextNote - BEAT);
    return Math.max(0, 1 - since / 0.32);
  }
}

export class Wallen {
  constructor(scene, rng, fronts) {
    this.rng = rng;
    this.kisses = 0;
    this.onKiss = null;   // (line) => void
    this.charmTimer = 0;
    this.kissClock = 0;
    this.streak = 0;      // kisses without leaving the district
    this.muziek = new WallenMuziek();

    // the dance-off
    this.dancing = false;
    this.onDanceEnd = null; // (hits, total) => void
    this.danceEl = document.getElementById('dans');
    this.danceSeqEl = document.getElementById('dans-seq');

    // pink shimmer on the canal water where the neon reflects
    this.shimmer = [];
    for (let i = 0; i < 6; i++) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(10 + rng() * 8, 2.2 + rng() * 1.6),
        new THREE.MeshBasicMaterial({
          color: '#ff4d78', transparent: true, opacity: 0.0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(
        REDLIGHT.x1 + 8 + i * 15 + rng() * 6,
        -0.82,
        REDLIGHT.canal + (rng() - 0.5) * 7
      );
      scene.add(strip);
      this.shimmer.push({ mesh: strip, phase: rng() * Math.PI * 2 });
    }

    // a dancer in front of EVERY establishment now — full occupancy,
    // each with her own style: sway, shimmy, or full diva
    this.dancers = [];
    fronts.forEach((f, i) => {
      const d = buildDancer(rng);
      d.userData.style = i % 3;
      d.position.set(f.x + (rng() - 0.5) * 1.5, 0, f.z + f.n * 0.9);
      d.rotation.y = f.n > 0 ? 0 : Math.PI;
      scene.add(d);
      this.dancers.push(d);
    });

    // seduction progression
    this.verleiding = 0;        // 0..100, the district's opinion of you
    this.sweetheart = false;    // stays for the session once earned
    this.onSweetheart = null;
    this.onGift = null;         // dancers toss stroopwafels at their sweetheart
    this.giftClock = 14;
    this.danceLevel = 0;        // encores get faster and longer
    this.neonPulse = 0;         // 0..1, follows the muziek beat
    this.trailClock = 0;

    // rose petals on the canal breeze
    this.petals = [];
    const petalTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(255,120,160,0.9)';
      g.beginPath();
      g.ellipse(16, 16, 10, 6, 0.7, 0, Math.PI * 2);
      g.fill();
      return new THREE.CanvasTexture(c);
    })();
    for (let i = 0; i < 32; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: petalTex, transparent: true, opacity: 0, depthWrite: false,
      }));
      s.scale.set(0.32, 0.32, 1);
      scene.add(s);
      this.petals.push({ sprite: s, life: 0, phase: rng() * 10 });
    }
    this.petalClock = 0;

    // floating hearts pool
    this.hearts = [];
    const mat = () => new THREE.SpriteMaterial({
      map: heartTexture(), transparent: true, opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 36; i++) {
      const s = new THREE.Sprite(mat());
      s.scale.set(0.6, 0.6, 1);
      s.visible = false;
      scene.add(s);
      this.hearts.push({ sprite: s, life: 0, vel: new THREE.Vector3() });
    }
  }

  spawnHeart(pos, spread = 0.6) {
    const h = this.hearts.find((h2) => h2.life <= 0);
    if (!h) return;
    h.life = 1.8;
    h.sprite.visible = true;
    h.sprite.position.set(
      pos.x + (this.rng() - 0.5) * spread * 2,
      pos.y + 1.6,
      pos.z + (this.rng() - 0.5) * spread * 2
    );
    h.vel.set((this.rng() - 0.5) * 0.4, 0.9 + this.rng() * 0.6, (this.rng() - 0.5) * 0.4);
    h.sprite.scale.setScalar(0.45 + this.rng() * 0.4);
  }

  /* ---- the dance-off: match the beat, charm the gracht ---- */

  nearestDancer(pos, radius = 6) {
    let best = null, bd = radius;
    for (const d of this.dancers) {
      const dist = d.position.distanceTo(pos);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  canDance(player) {
    return !this.dancing
      && inRedLight(player.pos.x, player.pos.z)
      && Math.abs(player.speed) < 3
      && !!this.nearestDancer(player.pos);
  }

  startDance(player) {
    if (!this.canDance(player)) return false;
    this.dancing = true;
    this.dancePartner = this.nearestDancer(player.pos);
    // encores: the band plays faster, the sequence grows, the stakes rise
    const lvl = Math.min(3, this.danceLevel);
    this.danceBeatDur = DANCE_BEAT * [1, 0.82, 0.68, 0.56][lvl];
    const len = 8 + lvl * 2;
    this.danceSeq = Array.from({ length: len }, () => DANCE_KEYS[Math.floor(this.rng() * 4)]);
    this.danceIdx = -1;          // -1 = lead-in bar
    this.danceTimer = this.danceBeatDur * 2; // two beats to find the rhythm
    this.danceHits = 0;
    this.danceHitThis = false;
    this.muziek.init();
    // render the sequence strip
    this.danceSeqEl.innerHTML = this.danceSeq
      .map((k, i) => `<span class="dans-key" data-i="${i}">${DANCE_GLYPH[k]}</span>`)
      .join('');
    this.danceEl.classList.add('open');
    return true;
  }

  danceInput(code) {
    if (!this.dancing || this.danceIdx < 0 || this.danceIdx >= this.danceSeq.length) return;
    if (this.danceHitThis) return;
    if (code === this.danceSeq[this.danceIdx]) {
      this.danceHitThis = true;
      this.danceHits++;
      this._danceKeyEl(this.danceIdx)?.classList.add('hit');
      if (this.dancePartner) this.spawnHeart(this.dancePartner.position, 0.5);
    } else {
      this.danceHitThis = true; // a wrong step is still a step
      this._danceKeyEl(this.danceIdx)?.classList.add('miss');
    }
  }

  _danceKeyEl(i) { return this.danceSeqEl.querySelector(`[data-i="${i}"]`); }

  _danceTick(player) {
    // close out the previous beat
    if (this.danceIdx >= 0 && !this.danceHitThis) {
      this._danceKeyEl(this.danceIdx)?.classList.add('miss');
    }
    this.danceIdx++;
    this.danceHitThis = false;
    if (this.danceIdx >= this.danceSeq.length) {
      // finished — hold the strip a moment, then report
      this.dancing = false;
      const hits = this.danceHits;
      setTimeout(() => this.danceEl.classList.remove('open'), 900);
      if (this.dancePartner) {
        this.dancePartner.userData.twirl = 0.95;
        this.dancePartner.userData.baseY = this.dancePartner.rotation.y;
      }
      const lvl = this.danceLevel;
      if (hits >= this.danceSeq.length - 1) this.danceLevel = Math.min(3, this.danceLevel + 1);
      else if (hits < this.danceSeq.length / 2) this.danceLevel = 0; // the band cools off
      if (hits >= this.danceSeq.length - 2) this.streak++;
      this.verleiding = Math.min(100, this.verleiding + hits * 2.5);
      this.onDanceEnd?.(hits, this.danceSeq.length, lvl);
      return;
    }
    this.danceSeqEl.querySelectorAll('.dans-key').forEach((el) => el.classList.remove('active'));
    this._danceKeyEl(this.danceIdx)?.classList.add('active');
  }

  // a bell rung inside the district gets a very different reception
  bellBurst(pos) {
    for (let i = 0; i < 9; i++) this.spawnHeart(pos, 1.4);
    return BELL_LINES[Math.floor(this.rng() * BELL_LINES.length)];
  }

  update(dt, elapsed, player) {
    const inside = inRedLight(player.pos.x, player.pos.z);
    this.muziek.update(dt, inside || this.dancing);

    // dance-off beat clock
    if (this.dancing) {
      player.speed = 0; // you cannot dance and pedal
      this.danceTimer -= dt;
      if (this.danceTimer <= 0) {
        this.danceTimer += this.danceBeatDur;
        this._danceTick(player);
      }
      // the partner really commits
      if (this.dancePartner) {
        const u = this.dancePartner.userData;
        u.hips.position.x = Math.sin(elapsed * 4.6) * 0.2;
      }
    }

    // dancers dance — each in her own style — and sometimes twirl
    for (const d of this.dancers) {
      const u = d.userData;
      const t = elapsed * u.tempo + u.phase;
      if (u.style === 1) {          // shimmy: quick hips, feet planted
        u.hips.position.x = Math.sin(t * 2.6) * 0.09;
        d.rotation.z = Math.sin(t * 2.6) * 0.03;
        u.armR.rotation.z = -2.4 + Math.sin(t * 5.2) * 0.15;
        d.position.y = 0;
      } else if (u.style === 2) {   // diva: slow, enormous, unbothered
        u.hips.position.x = Math.sin(t * 0.6) * 0.2;
        d.rotation.z = Math.sin(t * 0.6) * 0.09;
        u.armR.rotation.z = -2.4 + Math.sin(t * 0.6) * 0.5;
        d.position.y = Math.abs(Math.sin(t * 0.6)) * 0.06;
      } else {                      // classic sway
        u.hips.position.x = Math.sin(t) * 0.12;
        d.rotation.z = Math.sin(t) * 0.06;
        u.armR.rotation.z = -2.4 + Math.sin(t * 2) * 0.25;
        d.position.y = Math.abs(Math.sin(t)) * 0.04;
      }
      if (u.twirl > 0) {
        u.twirl -= dt;
        d.rotation.y += dt * 7; // a full, unhurried spin
        if (u.twirl <= 0) d.rotation.y = u.baseY;
      } else {
        u.nextTwirl -= dt;
        if (u.nextTwirl <= 0 && d.position.distanceTo(player.pos) < 16) {
          u.twirl = 0.95;
          u.baseY = d.rotation.y;
          u.nextTwirl = 8 + this.rng() * 16;
        }
      }
    }

    // neon reflections breathe on the water — harder, on the beat
    this.neonPulse = this.muziek.pulse();
    for (const s of this.shimmer) {
      s.mesh.material.opacity = 0.10 + 0.08 * Math.sin(elapsed * 1.3 + s.phase)
        + this.neonPulse * 0.07;
    }

    // rose petals drift wherever the district owns the air
    for (const p of this.petals) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const s = p.sprite;
      s.position.y -= dt * 0.9;
      s.position.x += Math.sin(elapsed * 1.8 + p.phase) * dt * 0.7;
      s.material.opacity = Math.min(0.85, p.life / 1.5);
      s.material.rotation += dt * (0.8 + Math.sin(p.phase));
      if (s.position.y < 0.05 || p.life <= 0) { p.life = 0; s.material.opacity = 0; }
    }

    // hearts drift up and fade
    for (const h of this.hearts) {
      if (h.life <= 0) continue;
      h.life -= dt;
      h.sprite.position.addScaledVector(h.vel, dt);
      h.sprite.material.opacity = Math.min(1, h.life / 1.2);
      if (h.life <= 0) h.sprite.visible = false;
    }

    // the district warms to you: streaks, dancing, and sweetheart status feed the band
    this.muziek.heat = this.sweetheart ? 1
      : this.dancing ? 0.9
        : Math.min(1, this.streak * 0.25 + this.verleiding / 200);

    if (!inside) {
      this.charmTimer = 0;
      if (this.streak > 0) this.streak = 0; // absence resets the romance
      this.verleiding = Math.max(this.sweetheart ? 40 : 0, this.verleiding - dt * 0.8);
      return;
    }

    // petals fall while you're in the district
    this.petalClock -= dt;
    if (this.petalClock <= 0) {
      this.petalClock = 0.35;
      const p = this.petals.find((p2) => p2.life <= 0);
      if (p) {
        p.life = 5;
        p.sprite.position.set(
          player.pos.x + (this.rng() - 0.5) * 26,
          7 + this.rng() * 5,
          player.pos.z + (this.rng() - 0.5) * 18
        );
      }
    }

    // your bike is smitten: a faint heart trail while riding through
    this.trailClock -= dt;
    if (this.trailClock <= 0 && Math.abs(player.speed) > 3) {
      this.trailClock = 0.4;
      this.spawnHeart(player.pos, 0.4);
    }

    // sweetheart perk: the windows occasionally tip their favourite cyclist
    if (this.sweetheart) {
      this.giftClock -= dt;
      if (this.giftClock <= 0) {
        this.giftClock = 16 + this.rng() * 14;
        const near = this.nearestDancer(player.pos, 14);
        if (near) {
          for (let i = 0; i < 4; i++) this.spawnHeart(near.position, 0.7);
          this.onGift?.();
        }
      }
    }

    // ambient kisses from nearby windows — aimed at you, personally
    this.kissClock -= dt;
    const near = this.dancers.filter((d) => d.position.distanceTo(player.pos) < 11);
    if (near.length && this.kissClock <= 0) {
      this.kissClock = 1.1 + this.rng() * 1.6;
      const from = near[Math.floor(this.rng() * near.length)];
      this.spawnHeart(from.position);
      this.verleiding = Math.min(100, this.verleiding + 1);
      // the newest heart drifts toward the player instead of straight up
      const h = this.hearts.find((h2) => h2.life > 1.7);
      if (h) {
        h.vel.set(
          (player.pos.x - from.position.x) * 0.22,
          1.0,
          (player.pos.z - from.position.z) * 0.22
        );
      }
    }

    // charm: linger (slowly) close to a window and the district notices you.
    // Stay in the district and the kisses compound.
    const admired = this.dancers.some((d) => d.position.distanceTo(player.pos) < 6);
    if (admired && Math.abs(player.speed) < 9) {
      this.charmTimer += dt;
      if (this.charmTimer > 2.5) {
        this.charmTimer = 0;
        this.streak++;
        const bonus = Math.min(3, 1 + Math.floor(this.streak / 3)); // streaks pay out
        this.kisses += bonus;
        this.verleiding = Math.min(100, this.verleiding + 6);
        for (let i = 0; i < bonus * 2; i++) this.spawnHeart(player.pos, 0.9);
        const line = this.streak >= 3 && this.streak % 2 === 1
          ? STREAK_LINES[Math.min(STREAK_LINES.length - 1, Math.floor(this.streak / 2) - 1)]
          : FLIRT_LINES[this.kisses % FLIRT_LINES.length];
        this.onKiss?.(line);
      }
    } else {
      this.charmTimer = Math.max(0, this.charmTimer - dt);
    }

    // 100% verleiding: the district makes it official
    if (!this.sweetheart && this.verleiding >= 100) {
      this.sweetheart = true;
      for (let i = 0; i < 14; i++) this.spawnHeart(player.pos, 1.6);
      this.onSweetheart?.();
    }
  }
}
