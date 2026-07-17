// Stroopwafels. Golden, spinning, irresistible.
import * as THREE from 'three';
import { WORLD, isOverWater } from './city.js';

function waffleMesh() {
  const g = new THREE.Group();
  const waffle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20),
    new THREE.MeshLambertMaterial({ color: '#c98b3a', emissive: '#5e3a10', emissiveIntensity: 0.5 })
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
