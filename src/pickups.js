// Stroopwafels. Golden, spinning, irresistible.
import * as THREE from 'three';
import { WORLD, isOverWater } from './city.js';

let waffleTex = null;
function waffleTexture() {
  if (waffleTex) return waffleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, '#e0a54e');
  grad.addColorStop(0.8, '#c98b3a');
  grad.addColorStop(1, '#9c6425');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // the lattice
  g.strokeStyle = 'rgba(94,58,16,0.6)';
  g.lineWidth = 5;
  for (let i = -128; i < 256; i += 18) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
  }
  waffleTex = new THREE.CanvasTexture(c);
  waffleTex.colorSpace = THREE.SRGBColorSpace;
  return waffleTex;
}

function waffleMesh() {
  const g = new THREE.Group();
  const waffle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20),
    new THREE.MeshLambertMaterial({ map: waffleTexture(), emissive: '#5e3a10', emissiveIntensity: 0.45 })
  );
  waffle.rotation.z = Math.PI / 2;
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.05, 8, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.7 })
  );
  g.add(waffle, glow);
  return g;
}

function randomSpot(rng) {
  for (let tries = 0; tries < 50; tries++) {
    const cz = WORLD.canalZ[Math.floor(rng() * WORLD.canalZ.length)];
    const side = rng() < 0.5 ? -1 : 1;
    const x = -WORLD.blockEdge + rng() * WORLD.blockEdge * 2;
    const z = cz + side * (WORLD.canalHalf + 1.5 + rng() * 7);
    if (!isOverWater(x, z)) return new THREE.Vector3(x, 1.1, z);
  }
  return new THREE.Vector3(0, 1.1, 10);
}

export class Pickups {
  constructor(scene, rng, count = 18) {
    this.scene = scene;
    this.rng = rng;
    this.items = [];
    for (let i = 0; i < count; i++) {
      const mesh = waffleMesh();
      mesh.position.copy(randomSpot(rng));
      scene.add(mesh);
      this.items.push(mesh);
    }
  }

  // returns number collected this frame
  update(dt, elapsed, playerPos) {
    let collected = 0;
    for (const m of this.items) {
      m.rotation.y += dt * 2.5;
      m.position.y = 1.1 + Math.sin(elapsed * 3 + m.position.x) * 0.15;
      if (m.position.distanceTo(playerPos) < 1.6) {
        collected++;
        m.position.copy(randomSpot(this.rng)); // respawn elsewhere
      }
    }
    return collected;
  }
}
