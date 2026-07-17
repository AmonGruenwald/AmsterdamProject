// Dutch weather and a day/night cycle. The rain is not optional for long.
import * as THREE from 'three';

const STATES = [
  { name: 'sunny', icon: '☀️', rain: 0 },
  { name: 'cloudy', icon: '☁️', rain: 0 },
  { name: 'drizzle', icon: '🌦', rain: 400 },
  { name: 'rain', icon: '🌧', rain: 1400 },
];
// Amsterdam-calibrated transition table (indices into STATES)
const NEXT = [
  [0, 1, 1, 1],   // sunny -> mostly cloudy
  [0, 1, 2, 2],   // cloudy -> often drizzle
  [1, 2, 2, 3],   // drizzle lingers
  [2, 2, 3, 1],   // rain eases to drizzle
];

export class Weather {
  constructor(scene, rng) {
    this.rng = rng;
    this.state = 1; // begin cloudy, obviously
    this.timer = 20;

    const geo = new THREE.BufferGeometry();
    this.count = 1400;
    const pos = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = (rng() - 0.5) * 160;
      pos[i * 3 + 1] = rng() * 40;
      pos[i * 3 + 2] = (rng() - 0.5) * 160;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#9db4c8', size: 0.14, transparent: true, opacity: 0.7,
    }));
    this.rain.visible = false;
    scene.add(this.rain);
  }

  get info() { return STATES[this.state]; }

  update(dt, center) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.state = NEXT[this.state][Math.floor(this.rng() * 4)];
      this.timer = 15 + this.rng() * 25;
      this.rain.visible = STATES[this.state].rain > 0;
      this.onChange?.(STATES[this.state]);
    }
    if (this.rain.visible) {
      const active = STATES[this.state].rain;
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < this.count; i++) {
        if (i > active) continue;
        let y = pos.getY(i) - dt * 28;
        if (y < 0) y = 40;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      this.rain.position.set(center.x, 0, center.z);
    }
  }
}

// --- day/night --------------------------------------------------------------

export class DayCycle {
  constructor(scene) {
    // A full in-game day (08:00 → 08:00) takes 20 real minutes; start mid-morning.
    this.dayLength = 1200;
    this.t = 0.08;

    this.sun = new THREE.DirectionalLight('#fff2dd', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 130;
    Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 400 });
    this.hemi = new THREE.HemisphereLight('#cfe4f5', '#3a3630', 0.9);
    scene.add(this.sun, this.sun.target, this.hemi);
    this.scene = scene;

    this.skyDay = new THREE.Color('#a8c8e0');
    this.skyEve = new THREE.Color('#d98e5f');
    this.skyNight = new THREE.Color('#0d1420');
    scene.background = this.skyDay.clone();
    scene.fog = new THREE.Fog(scene.background, 90, 340);
  }

  // returns "HH:MM" for the HUD
  update(dt, center) {
    this.t = (this.t + dt / this.dayLength) % 1;
    const hours = (8 + this.t * 24) % 24;

    // sun elevation: peaks near 13:00, gone by night
    const sunUp = Math.sin(((hours - 6) / 15) * Math.PI); // >0 roughly 06:00–21:00
    const elev = Math.max(-0.25, sunUp);
    const az = ((hours - 6) / 15) * Math.PI;
    this.sun.position.set(
      center.x + Math.cos(az) * 120,
      20 + Math.max(0, elev) * 140,
      center.z + 60
    );
    this.sun.target.position.set(center.x, 0, center.z);
    this.sun.intensity = Math.max(0.02, elev) * 2.4;
    this.hemi.intensity = 0.25 + Math.max(0, elev) * 0.75;

    // sky: day -> evening -> night blend
    const sky = new THREE.Color();
    if (elev > 0.25) sky.copy(this.skyDay);
    else if (elev > 0) sky.lerpColors(this.skyEve, this.skyDay, elev / 0.25);
    else sky.lerpColors(this.skyNight, this.skyEve, Math.max(0, 1 + elev / 0.25));
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);

    const h = Math.floor(hours), m = Math.floor((hours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
