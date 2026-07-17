// Public transport: buses with the obnoxious QR ticket scanner.
// The scanner works 50% of the time, which everyone involved considers normal.
import * as THREE from 'three';
import { WORLD } from './city.js';

const ROUTE_X = [-75, 75];             // buses run the two outer N-S roads
const STOP_Z = [-120, -60, 0, 60, 120]; // stops between the canals
const DWELL = 9;                        // seconds a bus waits at a stop
const SCAN_TIME = 1.6;                  // seconds of holding your phone hopefully

const FAIL_LINES = [
  '❌ BEEP. "TICKET NOT RECOGNISED." Try holding it flatter.',
  '❌ BEEP. "ERROR 1017." The scanner and your phone are no longer on speaking terms.',
  '❌ BEEP. The scanner flashes red at your maximum screen brightness.',
  '❌ BEEP. "PLEASE PRESENT TICKET." You are presenting the ticket.',
  '❌ BEEP. It worked for the person before you. It will work for the person after you.',
];

function buildBus() {
  const g = new THREE.Group();
  const blue = new THREE.MeshLambertMaterial({ color: '#1f5fa8' });
  const white = new THREE.MeshLambertMaterial({ color: '#e9e9e9' });
  const glass = new THREE.MeshLambertMaterial({ color: '#8fb6cf', transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 11), white);
  body.position.y = 1.6;
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.62, 1.0, 11.02), blue);
  skirt.position.y = 0.9;
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.8, 9.6), glass);
  windows.position.y = 2.15;
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: '#141414' });
  for (const z of [-3.6, 3.6]) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(s * 1.25, 0.45, z);
    g.add(w);
  }
  g.add(body, skirt, windows);
  return g;
}

function buildStop(x, z, side) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6),
    new THREE.MeshLambertMaterial({ color: '#2a2e33' })
  );
  pole.position.y = 1.6;
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.6, 0.06),
    new THREE.MeshLambertMaterial({ color: '#1f5fa8', emissive: '#0c2a4d', emissiveIntensity: 0.4 })
  );
  sign.position.y = 3.0;
  const shelter = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.1, 1.4),
    new THREE.MeshLambertMaterial({ color: '#3a4148' })
  );
  shelter.position.set(-side * 1.2, 2.5, 0);
  const post1 = pole.clone(); post1.position.set(-side * 2.4, 1.25, -0.5); post1.scale.y = 0.78;
  const post2 = pole.clone(); post2.position.set(-side * 2.4, 1.25, 0.5); post2.scale.y = 0.78;
  g.add(pole, sign, shelter, post1, post2);
  g.position.set(x + side * 5.2, 0, z);
  return g;
}

export class Transit {
  constructor(scene, rng, toast) {
    this.rng = rng;
    this.toast = toast;
    this.buses = [];
    this.riding = null;      // bus the player is on
    this.scanning = 0;       // countdown while "holding phone under scanner"
    this.scanBus = null;
    this.failedScans = 0;
    this.rides = 0;

    for (const x of ROUTE_X) {
      for (const z of STOP_Z) {
        scene.add(buildStop(x, z, 1));
      }
      // two buses per route, opposite directions, offset starts
      for (const [dir, startZ] of [[1, -200], [-1, 200]]) {
        const mesh = buildBus();
        scene.add(mesh);
        this.buses.push({
          mesh, x, z: startZ, dir, speed: 0, maxSpeed: 11,
          nextStop: this.findNextStop(startZ, dir),
          dwell: 0,
        });
      }
    }
  }

  findNextStop(z, dir) {
    const ahead = STOP_Z.filter((s) => (dir > 0 ? s > z + 1 : s < z - 1));
    if (!ahead.length) return null; // run to the end of the road, then turn
    return dir > 0 ? Math.min(...ahead) : Math.max(...ahead);
  }

  nearestBoardableBus(pos) {
    for (const b of this.buses) {
      if (b.dwell <= 0) continue; // only board a stopped bus
      const d = Math.hypot(pos.x - b.mesh.position.x, pos.z - b.mesh.position.z);
      if (d < 6.5) return b;
    }
    return null;
  }

  // called from main.js on KeyE
  interact(player) {
    if (this.riding) {
      this.toast('🛎 Stop requested. The bus will let you out at the next halte.');
      this.riding.dropOff = true;
      return;
    }
    if (this.scanning > 0) return;
    const bus = this.nearestBoardableBus(player.pos);
    if (!bus) return;
    this.scanning = SCAN_TIME;
    this.scanBus = bus;
    this.toast('📱 Hold your phone under the scanner… hold it… keep holding it…', SCAN_TIME * 1000);
  }

  board(bus, player) {
    this.riding = bus;
    this.rides++;
    bus.dropOff = false;
    player.mesh.visible = false;
    player.speed = 0;
    player.ridingBus = true;
    this.toast('✅ BEEP! Ticket accepted. Please move to the back, there is no room at the back.');
  }

  alight(player) {
    const bus = this.riding;
    this.riding = null;
    player.pos.set(bus.mesh.position.x + 4, 0, bus.mesh.position.z);
    player.lastSafe.copy(player.pos);
    player.mesh.visible = true;
    player.ridingBus = false;
    this.toast('🚏 You hop off. The doors sigh shut behind you.');
  }

  update(dt, player) {
    // QR scanning resolution
    if (this.scanning > 0) {
      this.scanning -= dt;
      player.speed = 0; // you cannot scan and pedal
      if (this.scanning <= 0) {
        const bus = this.scanBus;
        this.scanBus = null;
        if (!bus || bus.dwell <= 0.5) {
          this.toast('🚌 The bus leaves mid-scan. The scanner feels nothing.');
        } else if (this.rng() < 0.5) {
          this.board(bus, player);
        } else {
          this.failedScans++;
          this.toast(FAIL_LINES[this.failedScans % FAIL_LINES.length], 3200);
        }
      }
    }

    for (const b of this.buses) {
      if (b.dwell > 0) {
        b.dwell -= dt;
        if (b.dwell <= 0) {
          b.nextStop = this.findNextStop(b.z, b.dir);
          if (this.riding === b && b.dropOff) this.alight(player);
        }
      } else {
        // approach next stop (or the end of the road) and brake smoothly
        const target = b.nextStop ?? b.dir * 210;
        const dist = Math.abs(target - b.z);
        const brakeDist = (b.speed * b.speed) / (2 * 6);
        if (dist <= brakeDist + 0.3) b.speed = Math.max(0, b.speed - 6 * dt);
        else b.speed = Math.min(b.maxSpeed, b.speed + 4 * dt);
        b.z += b.dir * b.speed * dt;
        // arrival = crossing the target, so a bus can never creep past its stop
        const arrived = b.dir > 0 ? b.z >= target - 0.05 : b.z <= target + 0.05;
        if (arrived) {
          b.z = target;
          b.speed = 0;
          if (b.nextStop !== null) {
            b.dwell = DWELL;
          } else {
            b.dir *= -1; // end of the line, turn around
            b.nextStop = this.findNextStop(b.z, b.dir);
          }
        }
      }
      b.mesh.position.set(b.x, 0, b.z);
      b.mesh.rotation.y = b.dir > 0 ? 0 : Math.PI;
    }

    // carry the passenger
    if (this.riding) {
      player.pos.set(this.riding.mesh.position.x, 0, this.riding.mesh.position.z);
      player.heading = this.riding.dir > 0 ? 0 : Math.PI;
    }
  }

  // hint shown near a stopped bus
  boardingHint(pos) {
    if (this.riding || this.scanning > 0) return null;
    return this.nearestBoardableBus(pos) ? 'E — scan your QR ticket to board' : null;
  }
}
