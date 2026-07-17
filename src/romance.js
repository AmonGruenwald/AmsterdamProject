// Romance: the wholesome, street-level Amsterdam kind. Flirt (R) as you cycle
// and pink hearts rise off the canal; charm enough strangers and a sweetheart
// decides to ride with you, sharing your bike lane and your problems.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// a little 2D heart, pointing up, centred on origin
function heartGeometry() {
  const s = new THREE.Shape();
  const x = 0, y = 0;
  s.moveTo(x, y + 0.5);
  s.bezierCurveTo(x, y + 0.5, x - 0.5, y + 0.9, x - 0.5, y + 0.4);
  s.bezierCurveTo(x - 0.5, y + 0.05, x, y - 0.1, x, y - 0.35);
  s.bezierCurveTo(x, y - 0.1, x + 0.5, y + 0.05, x + 0.5, y + 0.4);
  s.bezierCurveTo(x + 0.5, y + 0.9, x, y + 0.5, x, y + 0.5);
  return new THREE.ShapeGeometry(s);
}

function buildSweetheart() {
  // a cheerful cyclist in an unapologetically pink coat
  const g = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: '#2a2a2e' });
  const coatMat = new THREE.MeshLambertMaterial({ color: '#ff5fa2' });
  const skinMat = new THREE.MeshLambertMaterial({ color: '#e8b48f' });
  const tireMat = new THREE.MeshLambertMaterial({ color: '#161616' });

  const wheelGeo = new THREE.TorusGeometry(0.42, 0.07, 8, 16);
  const wheels = [];
  for (const z of [0.75, -0.75]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(wheelGeo, tireMat);
    t.rotation.y = Math.PI / 2;
    w.add(t); w.position.set(0, 0.42, z);
    g.add(w); wheels.push(w);
  }
  const bar = (len, r = 0.045) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), frameMat);
  const top = bar(1.25); top.rotation.x = Math.PI / 2; top.position.set(0, 0.95, 0);
  const seat = bar(0.5); seat.position.set(0, 1.1, -0.55);
  const head2 = bar(0.7); head2.rotation.x = -0.25; head2.position.set(0, 1.05, 0.68);
  g.add(top, seat, head2);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), coatMat);
  torso.position.set(0, 1.65, -0.25); torso.rotation.x = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), skinMat);
  head.position.set(0, 2.15, -0.12);
  g.add(torso, head);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.wheels = wheels;
  return g;
}

export class Romance {
  constructor(scene) {
    this.scene = scene;
    this.meter = 0;
    this.together = false;
    this.onUnlock = null;

    // pool of rising hearts
    this.hearts = [];
    const geo = heartGeometry();
    for (let i = 0; i < 30; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ff4f97', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      this.hearts.push({ mesh: m, life: 0, max: 1.3, vy: 0, drift: 0 });
    }
    this._hnext = 0;

    this.sweetheart = buildSweetheart();
    this.sweetheart.visible = false;
    scene.add(this.sweetheart);
  }

  burst(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      const h = this.hearts[this._hnext];
      this._hnext = (this._hnext + 1) % this.hearts.length;
      h.mesh.position.set(
        pos.x + (Math.random() * 2 - 1) * 0.8,
        pos.y + 1.4 + Math.random() * 0.5,
        pos.z + (Math.random() * 2 - 1) * 0.8
      );
      const s = 0.3 + Math.random() * 0.35;
      h.mesh.scale.setScalar(s);
      h.mesh.material.opacity = 0.95;
      h.mesh.visible = true;
      h.life = h.max;
      h.vy = 1.1 + Math.random() * 0.8;
      h.drift = (Math.random() * 2 - 1) * 0.6;
    }
  }

  // Flirt from wherever the player is. Returns a deadpan line to toast.
  flirt(player) {
    this.burst(player.pos, 9);
    this.meter++;
    const lines = [
      '💕 You smile at a stranger on the gracht. They smile back. Dangerous.',
      '💕 You held a door. In Amsterdam this is practically a first date.',
      '💕 You split a stroopwafel. Nobody splits a stroopwafel lightly.',
      '💕 You memorised their bike, not their name. It is a start.',
    ];
    if (this.meter === 5 && !this.together) {
      this.together = true;
      this.sweetheart.visible = true;
      this.sweetheart.position.copy(player.pos);
      this.onUnlock?.();
      return '💞 They decide to ride with you. Someone now shares your bike lane — and your problems.';
    }
    if (this.meter > 5) {
      return this.together
        ? '💞 Still going strong. You heard the heron officiates weddings.'
        : lines[(this.meter - 1) % lines.length];
    }
    return lines[(this.meter - 1) % lines.length];
  }

  update(dt, player, camera, elapsed) {
    // hearts rise, drift, billboard to the camera, and fade
    for (const h of this.hearts) {
      if (h.life > 0) {
        h.life -= dt;
        h.mesh.position.y += h.vy * dt;
        h.mesh.position.x += h.drift * dt;
        h.mesh.material.opacity = Math.max(0, h.life / h.max) * 0.95;
        if (camera) h.mesh.quaternion.copy(camera.quaternion);
        if (h.life <= 0) h.mesh.visible = false;
      }
    }
    // the sweetheart rides just off your shoulder
    if (this.together) {
      const off = new THREE.Vector3(2.0, 0, -1.0).applyAxisAngle(UP, player.heading);
      const target = new THREE.Vector3(player.pos.x + off.x, 0, player.pos.z + off.z);
      this.sweetheart.position.lerp(target, Math.min(1, dt * 3));
      this.sweetheart.rotation.y = player.heading;
      const spin = (player.speed || 4) * dt * 2.2;
      for (const w of this.sweetheart.userData.wheels) w.rotation.x += spin;
      // a slow heartbeat of hearts while riding together
      this._beat = (this._beat || 0) - dt;
      if (this._beat <= 0) { this._beat = 2.4; this.burst(this.sweetheart.position, 2); }
    }
  }
}
