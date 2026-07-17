// Boat rental and canal tours. Drive a little sloop, narrate the city,
// duck under the bridges, and try to moor with dignity.
import * as THREE from 'three';
import { WORLD, nearestCanal } from './city.js';

const TOUR_LINES = [
  '🛥️ "On your left: houses that lean forward on purpose. On your right: a house that leans because it is tired."',
  '🛥️ "The canals are three metres deep: one metre water, one metre mud, one metre bicycles."',
  '🛥️ "That hook on every gable is for hoisting furniture. Or lowering in a piano, once, badly."',
  '🛥️ "We are now passing under a bridge. Please admire it. There are 1,752 more."',
  '🛥️ "The narrowest house in Amsterdam is two metres wide. The rent is not proportional."',
  '🛥️ "If you see a heron, it is the same heron. He gets around."',
  '🛥️ "Houseboats have addresses, postboxes, and better views than your hotel."',
  '🛥️ "And on your right — no, sorry, that is also bicycles."',
];

const DOCKS = [
  { x: -30, canal: 1, side: 1 },   // canal z=-30, north quay
  { x: 95, canal: 2, side: -1 },   // canal z=30, south quay (De Wallen's canal)
  { x: -110, canal: 3, side: 1 },  // canal z=90
];

function buildDock() {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#6b4e2e' });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 3.4), wood);
  deck.position.y = 0.05;
  g.add(deck);
  const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6);
  for (const sx of [-2.7, 2.7]) for (const sz of [-1.4, 1.4]) {
    const p = new THREE.Mesh(postGeo, wood);
    p.position.set(sx, -0.3, sz);
    g.add(p);
  }
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.9, 0.08),
    new THREE.MeshLambertMaterial({ color: '#1f5fa8' })
  );
  sign.position.set(0, 2.2, -1.2);
  const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), wood);
  pole1.position.set(-1.4, 1.1, -1.2);
  const pole2 = pole1.clone(); pole2.position.x = 1.4;
  g.add(sign, pole1, pole2);
  return g;
}

function buildSloop() {
  // a low, open rental sloop — sits flat on the water, fits under bridges
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color: '#27424f' });
  const woodMat = new THREE.MeshLambertMaterial({ color: '#9a7b4f' });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 6.2), hullMat);
  hull.position.y = 0.1;
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.7, 3, 1), hullMat);
  bow.rotation.y = Math.PI;
  bow.position.set(0, 0.1, 3.55);
  bow.scale.z = 1.6;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 5.6), woodMat);
  deck.position.y = 0.5;
  const benchGeo = new THREE.BoxGeometry(1.7, 0.3, 0.5);
  for (const z of [-1.6, -0.4, 0.8]) {
    const b = new THREE.Mesh(benchGeo, woodMat);
    b.position.set(0, 0.75, z);
    g.add(b);
  }
  // little orange pennant, regulation cheerful
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), woodMat);
  mast.position.set(0, 1.0, -2.8);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.3),
    new THREE.MeshLambertMaterial({ color: '#ff8c42', side: THREE.DoubleSide })
  );
  flag.position.set(0.3, 1.35, -2.8);
  g.add(hull, bow, deck, mast, flag);
  g.userData.flag = flag;
  return g;
}

function buildPassenger(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.45, 4, 8),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = 0.45;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 8, 8),
    new THREE.MeshLambertMaterial({ color: '#d9a980' })
  );
  head.position.y = 1.0;
  g.add(body, head);
  return g;
}

export class Boating {
  constructor(scene, rng, toast) {
    this.rng = rng;
    this.toast = toast;
    this.boating = false;
    this.tours = 0;
    this.onTourComplete = null;

    this.docks = DOCKS.map((d) => {
      const cz = WORLD.canalZ[d.canal];
      const z = cz + d.side * (WORLD.canalHalf - 1.2); // platform overhangs the water
      const mesh = buildDock();
      mesh.position.set(d.x, 0.35, z);
      if (d.side === -1) mesh.rotation.y = Math.PI; // sign faces the quay
      scene.add(mesh);
      const boat = buildSloop();
      boat.position.set(d.x + 4.5, -0.55, cz);
      scene.add(boat);
      return { x: d.x, z, canalZ: cz, mesh, boat, boatHome: d.x + 4.5 };
    });

    this.boat = null;        // active boat while driving
    this.heading = Math.PI / 2;
    this.speed = 0;
    this.tourDist = 0;
    this.tourLine = 0;
    this.duckToast = false;

    this.passengers = [];
    for (const c of ['#c4453c', '#3c7dc4', '#e0a33d']) {
      const p = buildPassenger(c);
      p.visible = false;
      scene.add(p);
      this.passengers.push(p);
    }
  }

  nearestDock(pos, radius = 5) {
    for (const d of this.docks) {
      if (Math.hypot(pos.x - d.x, pos.z - d.z) < radius) return d;
    }
    return null;
  }

  interact(player) {
    if (this.boating) {
      // measured from the boat, and generous: mooring is hard enough in real life
      const d = this.nearestDock(this.boat.position, 9);
      if (!d) {
        this.toast('⚓ You can only moor at a rental dock. The canal shrugs.');
        return;
      }
      this.alight(player, d);
      return;
    }
    const dock = this.nearestDock(player.pos);
    if (!dock) return;
    if (!dock.boat) {
      this.toast('⛵ The sloop is moored at another dock. Someone always does this.');
      return;
    }
    this.board(player, dock);
  }

  board(player, dock) {
    this.boating = true;
    this.dock = dock;
    this.boat = dock.boat;
    this.heading = Math.PI / 2; // bow pointing +X down the canal
    this.speed = 0;
    this.tourDist = 0;
    this.tourLine = 0;
    player.external = true;
    player.ridingBus = true; // wide chase camera
    player.mesh.visible = false;
    for (const [i, p] of this.passengers.entries()) {
      p.visible = true;
    }
    this.toast('🛥️ Three tourists climb aboard and put on their audio guides. You are the audio guide.');
  }

  alight(player, dock) {
    this.boating = false;
    const finished = this.tourLine >= 6;
    // park the boat by the dock it was left at (and clear it from its old dock)
    this.boat.position.set(dock.x + 4.5, -0.55, dock.canalZ);
    this.boat.rotation.set(0, 0, 0);
    if (this.dock && this.dock !== dock) this.dock.boat = null;
    dock.boat = this.boat;
    this.boat = null;
    this.dock = null;
    for (const p of this.passengers) p.visible = false;
    player.external = false;
    player.ridingBus = false;
    player.mesh.visible = true;
    player.pos.set(dock.x, 0, dock.z + Math.sign(dock.z - dock.canalZ) * 3.5);
    player.lastSafe.copy(player.pos);
    player.speed = 0;
    if (finished) {
      this.tours++;
      this.toast('👏 Tour complete! The tourists applaud and tip you in exact change.');
      this.onTourComplete?.();
    } else {
      this.toast('⚓ Moored. The tourists file off, mildly narrated.');
    }
  }

  update(dt, player, elapsed) {
    // idle boats bob at their docks
    for (const d of this.docks) {
      if (d.boat && d.boat !== this.boat) {
        d.boat.position.y = -0.55 + Math.sin(elapsed * 1.4 + d.x) * 0.05;
      }
    }
    if (!this.boating) return;

    const k = player.keys;
    const accel = 4.5;
    if (k.has('KeyW') || k.has('ArrowUp')) this.speed += accel * dt;
    else if (k.has('KeyS') || k.has('ArrowDown')) this.speed -= 5 * dt;
    else this.speed *= Math.pow(0.5, dt);
    this.speed = Math.max(-3, Math.min(8, this.speed));

    const steer = 1.4 * Math.min(1, Math.abs(this.speed) / 2.5);
    if (k.has('KeyA') || k.has('ArrowLeft')) this.heading += steer * dt * Math.sign(this.speed || 1);
    if (k.has('KeyD') || k.has('ArrowRight')) this.heading -= steer * dt * Math.sign(this.speed || 1);

    const b = this.boat;
    const nx = b.position.x + Math.sin(this.heading) * this.speed * dt;
    const nz = b.position.z + Math.cos(this.heading) * this.speed * dt;

    // stay in your gracht: clamp to the canal you're on
    const cz = nearestCanal(b.position.z);
    const zLim = WORLD.canalHalf - 1.4;
    const xLim = WORLD.size / 2 - 8;
    b.position.x = Math.max(-xLim, Math.min(xLim, nx));
    const clampedZ = Math.max(cz - zLim, Math.min(cz + zLim, nz));
    if (clampedZ !== nz) this.speed *= Math.pow(0.2, dt); // scraping the quay wall
    b.position.z = clampedZ;

    // duck under bridges
    const underBridge = WORLD.bridgeX.some((bx) => Math.abs(b.position.x - bx) < WORLD.bridgeHalf + 2);
    const targetY = underBridge ? -0.85 : -0.55;
    b.position.y += (targetY - b.position.y) * Math.min(1, dt * 6);
    if (underBridge && !this.duckToast && Math.abs(this.speed) > 1) {
      this.duckToast = true;
      this.toast('🌉 "Bruggetje! Everybody down." Everybody gets down.');
    }
    if (!underBridge) this.duckToast = false;

    b.rotation.y = this.heading;
    b.rotation.z = Math.sin(elapsed * 1.6) * 0.02 + (k.has('KeyA') ? 0.03 : 0) - (k.has('KeyD') ? 0.03 : 0);
    b.userData.flag.rotation.y = Math.sin(elapsed * 3) * 0.4;

    // seat the passengers
    this.passengers.forEach((p, i) => {
      const off = new THREE.Vector3((i % 2 === 0 ? 0.45 : -0.45), 0.55, -1.6 + i * 1.2);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
      p.position.copy(b.position).add(off);
      p.rotation.y = this.heading;
    });

    // the tour: commentary every stretch of canal covered
    this.tourDist += Math.abs(this.speed) * dt;
    if (this.tourLine < TOUR_LINES.length && this.tourDist > 45 * (this.tourLine + 1)) {
      this.toast(TOUR_LINES[this.tourLine % TOUR_LINES.length], 4200);
      this.tourLine++;
      if (this.tourLine === 6) {
        this.toast('🛥️ The tourists look satisfied. Moor at any dock (B) to finish the tour.', 4200);
      }
    }

    // the player rides along (camera + position)
    player.pos.set(b.position.x, 0, b.position.z);
    player.heading = this.heading;
    player.speed = 0;
  }

  dockHint(pos) {
    if (this.boating) {
      return this.nearestDock(this.boat.position, 9) ? 'B — moor the boat' : null;
    }
    const d = this.nearestDock(pos);
    return d && d.boat ? 'B — rent a sloop, give a tour' : null;
  }
}
