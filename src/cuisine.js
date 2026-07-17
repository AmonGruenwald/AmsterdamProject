// Local cuisine and the two great engines of the human condition:
// hunger, and its inevitable consequence. Survival, Amsterdam-style.
import * as THREE from 'three';
import { WORLD } from './city.js';

export const FOODS = [
  {
    sign: 'HARING', emoji: '🐟', name: 'Hollandse Nieuwe',
    hunger: 35, bowels: 15, awning: '#c23b3b',
    line: '🐟 The herring slides down whole. The onions will be with you all day.',
  },
  {
    sign: 'PATAT', emoji: '🍟', name: 'Patat oorlog',
    hunger: 45, bowels: 30, awning: '#d9a441',
    line: '🍟 Patat oorlog: mayo, satay sauce, onions, regret. Perfect.',
  },
  {
    sign: 'FEBO', emoji: '🧆', name: 'Kroket uit de muur',
    hunger: 30, bowels: 35, awning: '#e0b83d',
    line: '🧆 The wall dispenses a kroket of indeterminate age. It is delicious.',
  },
  {
    sign: 'KAAS', emoji: '🧀', name: 'Cheese sample lap',
    hunger: 20, bowels: 10, awning: '#3e7d3e',
    line: '🧀 You do a full lap of the free samples. The cheesemonger knows. You know.',
  },
  {
    sign: 'POFFERTJES', emoji: '🥞', name: 'Poffertjes',
    hunger: 25, bowels: 15, awning: '#8a4b9e',
    line: '🥞 Twelve tiny pancakes under a snowdrift of powdered sugar. Life is good.',
  },
  {
    sign: 'BITTERBALLEN', emoji: '🟤', name: 'Bitterballen',
    hunger: 30, bowels: 25, awning: '#7a4423',
    line: '🟤 The bitterbal is molten inside. You eat the second one anyway. And a third.',
  },
];

// (x placement hint, canal index, side) — resolved against WORLD at build time
const STALL_SPOTS = [
  [-40, 0, -1], [55, 1, -1], [-100, 2, -1], [30, 3, 1], [130, 2, 1], [-140, 3, -1],
];

// krul urinoirs: (bridgeX index, canal index, side)
const KRUL_SPOTS = [
  [1, 1, -1], [2, 2, 1], [3, 0, 1], [4, 3, -1],
];

const textCache = new Map();
function signTexture(text, bg) {
  const key = `${text}:${bg}`;
  if (textCache.has(key)) return textCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#fff8ee';
  g.font = 'bold 34px "Segoe UI", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textCache.set(key, tex);
  return tex;
}

function awningTexture(color) {
  const key = `awn:${color}`;
  if (textCache.has(key)) return textCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? color : '#f2ead8';
    g.fillRect(i * 16, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textCache.set(key, tex);
  return tex;
}

function buildCart(food) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.5, 1.7),
    new THREE.MeshLambertMaterial({ color: '#e8e0d0' })
  );
  body.position.y = 1.05;
  const counterGlow = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.25, 1.5),
    new THREE.MeshLambertMaterial({ color: '#ffd9a0', emissive: '#b07a2a', emissiveIntensity: 0.7 })
  );
  counterGlow.position.y = 1.85;
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.08, 2.3),
    new THREE.MeshLambertMaterial({ map: awningTexture(food.awning) })
  );
  awning.position.y = 2.6;
  awning.rotation.x = 0.12;
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6);
  const postMat = new THREE.MeshLambertMaterial({ color: '#4a423a' });
  for (const sx of [-1.5, 1.5]) for (const sz of [-0.7, 0.7]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(sx, 1.3, sz);
    g.add(p);
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.7),
    new THREE.MeshLambertMaterial({ map: signTexture(food.sign, food.awning), side: THREE.DoubleSide })
  );
  sign.position.set(0, 3.2, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: '#222' });
  for (const sx of [-1.2, 1.2]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, 0.35, 0.85);
    g.add(w);
  }
  g.add(body, counterGlow, awning, sign);
  return g;
}

function buildKrul() {
  // the classic dark-green curled public urinal. An Amsterdam icon. A relief.
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#20402a', side: THREE.DoubleSide });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 2.3, 18, 1, true, 0, Math.PI * 1.55),
    mat
  );
  wall.position.y = 1.35;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 6), mat);
  post.position.set(0, 1.45, 0);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.4),
    new THREE.MeshLambertMaterial({ map: signTexture('KRUL', '#20402a'), side: THREE.DoubleSide })
  );
  sign.position.y = 3.0;
  g.add(wall, post, sign);
  return g;
}

export function buildCuisine(scene, rng) {
  const stalls = [];
  STALL_SPOTS.forEach(([x, ci, side], i) => {
    const food = FOODS[i % FOODS.length];
    const cz = WORLD.canalZ[ci];
    const z = cz + side * 15.5; // the pavement strip between quay road and houses
    const mesh = buildCart(food);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = side > 0 ? Math.PI : 0; // counter faces the road
    scene.add(mesh);
    stalls.push({ mesh, food, x, z });
  });

  const toilets = [];
  for (const [bi, ci, side] of KRUL_SPOTS) {
    const x = WORLD.bridgeX[bi] + 9;
    const z = WORLD.canalZ[ci] + side * 15.5;
    const mesh = buildKrul();
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rng() * Math.PI * 2;
    scene.add(mesh);
    toilets.push({ mesh, x, z });
  }
  return { stalls, toilets };
}

// --- the meters -------------------------------------------------------------

export class Survival {
  constructor() {
    this.hunger = 80;   // 100 = stuffed, 0 = hongerklop
    this.bowels = 10;   // 100 = catastrophe
    this.bonked = false;
    this.busy = 0;      // seconds locked in place (toilet / recovery)
    this.eatCooldown = 0;
    this.meals = 0;
    this.accidents = 0;
    this.onEvent = null; // (type, line) => void
  }

  emit(type, line) { this.onEvent?.(type, line); }

  eat(food) {
    if (this.eatCooldown > 0) return false;
    this.eatCooldown = 2.5;
    this.hunger = Math.min(100, this.hunger + food.hunger);
    this.bowels = Math.min(100, this.bowels + food.bowels);
    this.meals++;
    this.emit('eat', food.line);
    return true;
  }

  snack() { // stroopwafel pickup
    this.hunger = Math.min(100, this.hunger + 8);
    this.bowels = Math.min(100, this.bowels + 4);
  }

  relieve() {
    if (this.busy > 0) return;
    if (this.bowels < 12) {
      this.emit('nothing', '🚽 You stand in the krul out of politeness. Nothing to declare.');
      return;
    }
    this.busy = 2.5;
    this.bowels = 0;
    this._warned70 = this._warned90 = false;
    this.emit('relief', '🚽 The krul delivers. Somewhere, a canal boat guide explains its history.');
  }

  update(dt, player) {
    this.eatCooldown = Math.max(0, this.eatCooldown - dt);
    if (this.busy > 0) {
      this.busy -= dt;
      player.speed = 0;
    }

    const effort = Math.abs(player.speed) > 12 ? 0.75 : 0.45;
    this.hunger = Math.max(0, this.hunger - effort * dt);
    this.bowels = Math.min(100, this.bowels + 0.12 * dt); // time comes for us all

    // hongerklop — the bonk. Legs of pudding.
    if (this.hunger <= 0 && !this.bonked) {
      this.bonked = true;
      player.speedFactor = 0.3;
      this.emit('bonk', '🥴 De hongerklop. Your legs are now bitterballen filling. EAT SOMETHING.');
    }
    if (this.bonked && this.hunger > 20) {
      this.bonked = false;
      player.speedFactor = 1;
      this.emit('recover', '💪 Sugar reaches your legs. You remember how bicycles work.');
    }
    if (!this._warnedHunger && this.hunger < 25 && this.hunger > 0) {
      this._warnedHunger = true;
      this.emit('warn', '🍟 Your stomach growls louder than the tram. Find a snack cart (F).');
    }
    if (this.hunger > 40) this._warnedHunger = false;

    // the other meter
    if (!this._warned70 && this.bowels > 70) {
      this._warned70 = true;
      this.emit('warn', '🚽 A pressure system is developing. Amsterdam has krul urinoirs (T). Use them.');
    }
    if (!this._warned90 && this.bowels > 90) {
      this._warned90 = true;
      this.emit('warn', '🚨 This is no longer a drill. FIND A KRUL. NOW.');
    }
    if (this.bowels >= 100) {
      this.accidents++;
      this.bowels = 15;
      this._warned70 = this._warned90 = false;
      this.busy = 4;
      this.emit('accident',
        '💩 Disaster, behind a parked bakfiets. You tell no one. The heron saw everything.');
    }
  }

  nearestStall(stalls, pos) {
    for (const s of stalls) if (Math.hypot(pos.x - s.x, pos.z - s.z) < 4) return s;
    return null;
  }

  nearestToilet(toilets, pos) {
    for (const t of toilets) if (Math.hypot(pos.x - t.x, pos.z - t.z) < 3) return t;
    return null;
  }
}
