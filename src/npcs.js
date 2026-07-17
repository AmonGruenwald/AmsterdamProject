// The other Amsterdammers: NPC cyclists, wandering tourists, canal boats, one tram.
import * as THREE from 'three';
import { WORLD } from './city.js';

const rand = (rng, a, b) => a + rng() * (b - a);

// --- NPC cyclists: loop along the quay roads --------------------------------

function smallBike(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#17181a' });
  const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 8), new THREE.MeshLambertMaterial({ color }));
  rider.position.y = 1.5;
  const wheelGeo = new THREE.TorusGeometry(0.38, 0.06, 6, 14);
  const w1 = new THREE.Mesh(wheelGeo, mat);
  w1.rotation.y = Math.PI / 2;
  w1.position.set(0, 0.38, 0.6);
  const w2 = w1.clone(); w2.position.z = -0.6;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.3), mat);
  frame.position.y = 0.75;
  g.add(rider, w1, w2, frame);
  return g;
}

const NPC_COLORS = ['#8a6d3b', '#3b6d8a', '#6d8a3b', '#7a4a6d', '#4a4a4a', '#a3552e'];

export function spawnCyclists(scene, rng, count = 26) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const cz = WORLD.canalZ[Math.floor(rng() * WORLD.canalZ.length)];
    const side = rng() < 0.5 ? -1 : 1;
    const z = cz + side * (WORLD.canalHalf + 4.5);
    const mesh = smallBike(NPC_COLORS[i % NPC_COLORS.length]);
    scene.add(mesh);
    list.push({
      mesh, z,
      x: rand(rng, -WORLD.blockEdge, WORLD.blockEdge),
      dir: rng() < 0.5 ? -1 : 1,
      speed: rand(rng, 6, 11),
    });
  }
  return list;
}

export function updateCyclists(list, dt) {
  for (const c of list) {
    c.x += c.dir * c.speed * dt;
    if (c.x > WORLD.blockEdge) { c.x = WORLD.blockEdge; c.dir = -1; }
    if (c.x < -WORLD.blockEdge) { c.x = -WORLD.blockEdge; c.dir = 1; }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

// --- Tourists: wander the quays, scatter when belled ------------------------

const TOURIST_COLORS = ['#c4453c', '#3c7dc4', '#e0a33d', '#7dc43c', '#c43c9e', '#3cc4b8'];

export function spawnTourists(scene, rng, count = 34) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.26, 0.7, 4, 8),
      new THREE.MeshLambertMaterial({ color: TOURIST_COLORS[i % TOURIST_COLORS.length] })
    );
    body.position.y = 0.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8),
      new THREE.MeshLambertMaterial({ color: '#d9a980' }));
    head.position.y = 1.65;
    g.add(body, head);
    const cz = WORLD.canalZ[Math.floor(rng() * WORLD.canalZ.length)];
    const side = rng() < 0.5 ? -1 : 1;
    g.position.set(
      rand(rng, -WORLD.blockEdge, WORLD.blockEdge),
      0,
      cz + side * rand(rng, WORLD.canalHalf + 1.5, WORLD.canalHalf + 8)
    );
    scene.add(g);
    list.push({
      mesh: g,
      angle: rng() * Math.PI * 2,
      timer: rand(rng, 1, 4),
      scatter: 0,
      speed: rand(rng, 0.8, 1.6),
    });
  }
  return list;
}

export function updateTourists(list, dt, rng, playerPos) {
  for (const t of list) {
    t.timer -= dt;
    if (t.timer <= 0) { t.angle = rng() * Math.PI * 2; t.timer = rand(rng, 1.5, 5); }
    const speed = t.scatter > 0 ? 5 : t.speed;
    if (t.scatter > 0) t.scatter -= dt;
    const p = t.mesh.position;
    p.x += Math.sin(t.angle) * speed * dt;
    p.z += Math.cos(t.angle) * speed * dt;
    // keep them off the water and inside the world
    const cz = WORLD.canalZ.reduce((a, b) => Math.abs(p.z - b) < Math.abs(p.z - a) ? b : a);
    if (Math.abs(p.z - cz) < WORLD.canalHalf + 0.8) {
      p.z = cz + Math.sign(p.z - cz || 1) * (WORLD.canalHalf + 0.9);
      t.angle += Math.PI;
    }
    p.x = Math.max(-WORLD.blockEdge, Math.min(WORLD.blockEdge, p.x));
    t.mesh.rotation.y = t.angle;
    // waddle
    t.mesh.position.y = Math.abs(Math.sin(performance.now() / 180 + t.angle * 7)) * 0.05;
  }
}

// Returns number of tourists scattered by a bell ring at playerPos.
export function ringBell(list, playerPos) {
  let scattered = 0;
  for (const t of list) {
    const d = t.mesh.position.distanceTo(playerPos);
    if (d < 8) {
      t.scatter = 1.2;
      const away = Math.atan2(t.mesh.position.x - playerPos.x, t.mesh.position.z - playerPos.z);
      t.angle = away;
      scattered++;
    }
  }
  return scattered;
}

// --- Canal boats: glide up and down the canals -------------------------------

export function spawnBoats(scene, rng, count = 6) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 1, 3),
      new THREE.MeshLambertMaterial({ color: '#2c3e50' }));
    hull.position.y = -0.35;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(8, 1.1, 2.6),
      new THREE.MeshLambertMaterial({ color: '#aac6d8', transparent: true, opacity: 0.85 }));
    cabin.position.y = 0.55;
    g.add(hull, cabin);
    const cz = WORLD.canalZ[i % WORLD.canalZ.length];
    g.position.set(rand(rng, -150, 150), 0, cz + rand(rng, -2, 2));
    scene.add(g);
    list.push({ mesh: g, dir: rng() < 0.5 ? -1 : 1, speed: rand(rng, 3, 5) });
  }
  return list;
}

export function updateBoats(list, dt, elapsed) {
  for (const b of list) {
    const p = b.mesh.position;
    p.x += b.dir * b.speed * dt;
    if (p.x > 200) { p.x = 200; b.dir = -1; }
    if (p.x < -200) { p.x = -200; b.dir = 1; }
    p.y = Math.sin(elapsed * 1.5 + p.x * 0.05) * 0.06 - 0.15;
    b.mesh.rotation.y = b.dir > 0 ? 0 : Math.PI;
    b.mesh.rotation.z = Math.sin(elapsed * 1.2 + p.x * 0.1) * 0.02;
  }
}

// --- One tram, line 2, running the central north-south road ------------------

export function spawnTram(scene) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: '#2a6db5' });
  const white = new THREE.MeshLambertMaterial({ color: '#e8e8e8' });
  for (let i = 0; i < 3; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 7.5), bodyMat);
    car.position.set(0, 1.7, i * 8 - 8);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.9, 7.55), white);
    stripe.position.set(0, 2.3, i * 8 - 8);
    g.add(car, stripe);
  }
  g.position.set(0, 0, -200);
  scene.add(g);
  return { mesh: g, z: -200, dir: 1, speed: 9 };
}

export function updateTram(tram, dt) {
  tram.z += tram.dir * tram.speed * dt;
  if (tram.z > 210) { tram.z = 210; tram.dir = -1; }
  if (tram.z < -210) { tram.z = -210; tram.dir = 1; }
  tram.mesh.position.z = tram.z;
  tram.mesh.rotation.y = tram.dir > 0 ? 0 : Math.PI;
}
