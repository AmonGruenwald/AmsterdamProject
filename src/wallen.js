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
    // A minor, walking low and unhurried
    this.bassline = [55.0, 65.41, 82.41, 73.42, 55.0, 82.41, 98.0, 73.42]; // A1 C2 E2 D2 ...
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

    // a dancer in front of roughly every other establishment
    this.dancers = [];
    fronts.forEach((f, i) => {
      if (i % 2 !== 0) return;
      const d = buildDancer(rng);
      d.position.set(f.x + (rng() - 0.5) * 1.5, 0, f.z + f.n * 0.9);
      d.rotation.y = f.n > 0 ? 0 : Math.PI;
      scene.add(d);
      this.dancers.push(d);
    });

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

  // a bell rung inside the district gets a very different reception
  bellBurst(pos) {
    for (let i = 0; i < 9; i++) this.spawnHeart(pos, 1.4);
    return BELL_LINES[Math.floor(this.rng() * BELL_LINES.length)];
  }

  update(dt, elapsed, player) {
    const inside = inRedLight(player.pos.x, player.pos.z);
    this.muziek.update(dt, inside);

    // dancers dance — and sometimes twirl
    for (const d of this.dancers) {
      const u = d.userData;
      const t = elapsed * u.tempo + u.phase;
      u.hips.position.x = Math.sin(t) * 0.12;
      d.rotation.z = Math.sin(t) * 0.06;
      u.armR.rotation.z = -2.4 + Math.sin(t * 2) * 0.25;
      d.position.y = Math.abs(Math.sin(t)) * 0.04;
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

    // neon reflections breathe on the water
    for (const s of this.shimmer) {
      s.mesh.material.opacity = 0.10 + 0.08 * Math.sin(elapsed * 1.3 + s.phase);
    }

    // hearts drift up and fade
    for (const h of this.hearts) {
      if (h.life <= 0) continue;
      h.life -= dt;
      h.sprite.position.addScaledVector(h.vel, dt);
      h.sprite.material.opacity = Math.min(1, h.life / 1.2);
      if (h.life <= 0) h.sprite.visible = false;
    }

    if (!inside) {
      this.charmTimer = 0;
      if (this.streak > 0) this.streak = 0; // absence resets the romance
      return;
    }

    // ambient kisses from nearby windows — aimed at you, personally
    this.kissClock -= dt;
    const near = this.dancers.filter((d) => d.position.distanceTo(player.pos) < 11);
    if (near.length && this.kissClock <= 0) {
      this.kissClock = 1.1 + this.rng() * 1.6;
      const from = near[Math.floor(this.rng() * near.length)];
      this.spawnHeart(from.position);
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
        for (let i = 0; i < bonus * 2; i++) this.spawnHeart(player.pos, 0.9);
        const line = this.streak >= 3 && this.streak % 2 === 1
          ? STREAK_LINES[Math.min(STREAK_LINES.length - 1, Math.floor(this.streak / 2) - 1)]
          : FLIRT_LINES[this.kisses % FLIRT_LINES.length];
        this.onKiss?.(line);
      }
    } else {
      this.charmTimer = Math.max(0, this.charmTimer - dt);
    }
  }
}
