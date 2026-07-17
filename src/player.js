// The player's bicycle: a proper omafiets, third-person camera, arcade physics.
import * as THREE from 'three';
import { collide, clampToWorld, isOverWater } from './city.js';

function buildBike() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: '#1c1c1e' }); // classic Dutch black
  const tireMat = new THREE.MeshLambertMaterial({ color: '#16181a' });
  const skinMat = new THREE.MeshLambertMaterial({ color: '#c8916b' });
  const coatMat = new THREE.MeshLambertMaterial({ color: '#b6521f' }); // orange coat, of course

  // wheel: torus lies in XY, rotate into the YZ (travel) plane, spin the pivot
  const wheelGeo = new THREE.TorusGeometry(0.42, 0.07, 8, 18);
  const makeWheel = (z) => {
    const pivot = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.y = Math.PI / 2;
    pivot.add(tire);
    pivot.position.set(0, 0.42, z);
    return pivot;
  };
  const front = makeWheel(0.75);
  const rear = makeWheel(-0.75);
  g.add(front, rear);
  g.userData.wheels = [front, rear];

  const bar = (len, r = 0.045) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), frameMat);
  const top = bar(1.25); top.rotation.x = Math.PI / 2; top.position.set(0, 0.95, 0);
  const down = bar(1.3); down.rotation.x = Math.PI / 2 - 0.5; down.position.set(0, 0.72, 0.12);
  const seatPost = bar(0.5); seatPost.position.set(0, 1.1, -0.55);
  const headPost = bar(0.7); headPost.rotation.x = -0.25; headPost.position.set(0, 1.05, 0.68);
  const handle = bar(0.7, 0.035); handle.rotation.z = Math.PI / 2; handle.position.set(0, 1.35, 0.62);
  g.add(top, down, seatPost, headPost, handle);

  // rider: torso, head, legs (legs animate)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), coatMat);
  torso.position.set(0, 1.65, -0.25); torso.rotation.x = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), skinMat);
  head.position.set(0, 2.15, -0.12);
  const legGeo = new THREE.CapsuleGeometry(0.09, 0.5, 4, 6);
  const legL = new THREE.Mesh(legGeo, frameMat); legL.position.set(0.18, 1.05, -0.15);
  const legR = new THREE.Mesh(legGeo, frameMat); legR.position.set(-0.18, 1.05, -0.15);
  g.add(torso, head, legL, legR);
  g.userData.legs = [legL, legR];

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = buildBike();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 8);
    this.heading = Math.PI;   // facing -Z... heading 0 = +Z; start facing -Z
    this.speed = 0;
    this.maxSpeed = 14;
    this.speedFactor = 1; // survival effects (hongerklop) scale this
    this.external = false; // true while another system (boat) drives pos/heading
    this.lastSafe = this.pos.clone();
    this.inWater = false;
    this.waterTimer = 0;
    this.camMode = 0; // 0 follow, 1 high orbit
    this.keys = new Set();
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  update(dt, colliders, camera, elapsed) {
    const k = this.keys;
    if (this.external) {
      // another system (the boat) owns pos/heading; we just film it
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.updateCamera(camera, dt);
      return;
    }
    if (this.inWater) {
      // dunked: bob sadly, then respawn on the quay
      this.waterTimer -= dt;
      this.mesh.position.y = -0.7 + Math.sin(elapsed * 6) * 0.1;
      if (this.waterTimer <= 0) {
        this.inWater = false;
        this.pos.copy(this.lastSafe);
        this.speed = 0;
        this.mesh.position.y = 0;
      }
      this.updateCamera(camera, dt);
      return;
    }

    const sprint = k.has('ShiftLeft') || k.has('ShiftRight') ? 1.5 : 1;
    const accel = 16 * sprint;
    if (k.has('KeyW') || k.has('ArrowUp')) this.speed += accel * dt;
    else if (k.has('KeyS') || k.has('ArrowDown')) this.speed -= 22 * dt;
    else this.speed *= Math.pow(0.35, dt); // coast down

    this.speed = Math.max(-4, Math.min(this.maxSpeed * sprint * this.speedFactor, this.speed));

    const steer = 2.2 * Math.min(1, Math.abs(this.speed) / 4);
    if (k.has('KeyA') || k.has('ArrowLeft')) this.heading += steer * dt * Math.sign(this.speed || 1);
    if (k.has('KeyD') || k.has('ArrowRight')) this.heading -= steer * dt * Math.sign(this.speed || 1);

    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const next = this.pos.clone().addScaledVector(dir, this.speed * dt);
    clampToWorld(next);

    const hit = collide(next.x, next.z, 0.6, colliders);
    if (hit) {
      this.speed *= -0.25; // bounce off the gevel
    } else {
      this.pos.copy(next);
    }

    if (isOverWater(this.pos.x, this.pos.z)) {
      this.inWater = true;
      this.waterTimer = 2.2;
      this.onSplash?.();
    } else if (Math.abs(this.speed) > 0.5) {
      this.lastSafe.copy(this.pos);
    }

    // visuals
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = THREE.MathUtils.lerp(
      this.mesh.rotation.z,
      (k.has('KeyA') ? 0.12 : 0) - (k.has('KeyD') ? 0.12 : 0),
      0.15
    );
    const spin = this.speed * dt * 2.4;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    const [l, r] = this.mesh.userData.legs;
    const ped = elapsed * Math.max(1, Math.abs(this.speed)) * 0.8;
    l.position.y = 1.05 + Math.sin(ped) * 0.12;
    r.position.y = 1.05 - Math.sin(ped) * 0.12;

    this.updateCamera(camera, dt);
  }

  updateCamera(camera, dt) {
    // ridingBus is set by Transit while aboard; the bus needs a wider shot
    const back = this.ridingBus ? 17 : this.camMode === 0 ? 9 : 26;
    const up = this.ridingBus ? 8.5 : this.camMode === 0 ? 4.2 : 22;
    const target = new THREE.Vector3(
      this.pos.x - Math.sin(this.heading) * back,
      up,
      this.pos.z - Math.cos(this.heading) * back
    );
    camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
    camera.lookAt(this.pos.x, 1.6, this.pos.z);
  }
}
