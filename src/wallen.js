// De Wallen, populated. Dancers in the windows, kisses on the breeze,
// and a charm meter for cyclists who slow down to say hi.
// Everything here stays at the silhouette-and-wink level of detail.
import * as THREE from 'three';
import { inRedLight } from './city.js';

const FLIRT_LINES = [
  '💋 A wink from a window. You wobble into the general direction of a bollard.',
  '💋 Someone blows you a kiss. Your bell rings by itself. Traitor.',
  '💋 "Nice bike," says a voice like velvet. It is a very normal bike.',
  '💋 A dancer waves. You wave back with the hand you steer with. Bold.',
  '💋 Applause from a doorway as you pass. For the posture, surely.',
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
  g.userData = { armR, hips, phase: rng() * Math.PI * 2, tempo: 1.6 + rng() * 1.2 };
  return g;
}

export class Wallen {
  constructor(scene, rng, fronts) {
    this.rng = rng;
    this.kisses = 0;
    this.onKiss = null;   // (line) => void
    this.charmTimer = 0;
    this.kissClock = 0;

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
    // dancers dance
    for (const d of this.dancers) {
      const { armR, hips, phase, tempo } = d.userData;
      const t = elapsed * tempo + phase;
      hips.position.x = Math.sin(t) * 0.12;
      d.rotation.z = Math.sin(t) * 0.06;
      armR.rotation.z = -2.4 + Math.sin(t * 2) * 0.25;
      d.position.y = Math.abs(Math.sin(t)) * 0.04;
    }

    // hearts drift up and fade
    for (const h of this.hearts) {
      if (h.life <= 0) continue;
      h.life -= dt;
      h.sprite.position.addScaledVector(h.vel, dt);
      h.sprite.material.opacity = Math.min(1, h.life / 1.2);
      if (h.life <= 0) h.sprite.visible = false;
    }

    if (!inRedLight(player.pos.x, player.pos.z)) { this.charmTimer = 0; return; }

    // ambient kisses from nearby windows
    this.kissClock -= dt;
    const near = this.dancers.filter((d) => d.position.distanceTo(player.pos) < 11);
    if (near.length && this.kissClock <= 0) {
      this.kissClock = 1.1 + this.rng() * 1.6;
      this.spawnHeart(near[Math.floor(this.rng() * near.length)].position);
    }

    // charm: linger (slowly) close to a window and the district notices you
    const admired = this.dancers.some((d) => d.position.distanceTo(player.pos) < 6);
    if (admired && Math.abs(player.speed) < 9) {
      this.charmTimer += dt;
      if (this.charmTimer > 2.5) {
        this.charmTimer = 0;
        this.kisses++;
        this.spawnHeart(player.pos, 0.9);
        this.onKiss?.(FLIRT_LINES[this.kisses % FLIRT_LINES.length]);
      }
    } else {
      this.charmTimer = Math.max(0, this.charmTimer - dt);
    }
  }
}
