// Amsterdam Simulator — entry point and game loop.
import * as THREE from 'three';
import { buildCity, inRedLight } from './city.js';
import { Transit } from './transit.js';
import { Player } from './player.js';
import { Weather, DayCycle } from './weather.js';
import { Pickups } from './pickups.js';
import {
  spawnCyclists, updateCyclists,
  spawnTourists, updateTourists, ringBell,
  spawnBoats, updateBoats,
  spawnTram, updateTram,
} from './npcs.js';

// deterministic-ish rng (mulberry32) so the city is stable per seed
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seed = Number(new URLSearchParams(location.search).get('seed')) || 1275;
const rng = mulberry32(seed);

// --- renderer / scene --------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 5, 20);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- world -------------------------------------------------------------------
const { colliders } = buildCity(scene, rng);
const player = new Player(scene);
const weather = new Weather(scene, rng);
const day = new DayCycle(scene);
const pickups = new Pickups(scene, rng);
const cyclists = spawnCyclists(scene, rng);
const tourists = spawnTourists(scene, rng);
const boats = spawnBoats(scene, rng);
const tram = spawnTram(scene);
let transit; // needs `toast`, constructed below

// --- HUD ----------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const stats = { waffles: 0, bells: 0, splashes: 0 };
let msgTimer = null;
function toast(text, ms = 2600) {
  const el = $('hud-msg');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (el.style.opacity = 0), ms);
}

transit = new Transit(scene, rng, toast);

weather.onChange = (s) => {
  $('s-weather').textContent = `${s.icon} ${s.name}`;
  if (s.name === 'rain') toast('🌧 Echt Amsterdams weer. Keep pedalling.');
  if (s.name === 'sunny') toast('☀️ Sun! Every terrace in the city just filled up.');
};

player.onSplash = () => {
  stats.splashes++;
  $('s-splashes').textContent = stats.splashes;
  toast('💦 SPLASH — the canal accepts your bike, as it accepts all bikes.');
};

addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    stats.bells++;
    $('s-bells').textContent = stats.bells;
    const scattered = ringBell(tourists, player.pos);
    if (scattered >= 3) toast(`🔔 RING! ${scattered} tourists scatter from the fietspad.`);
  }
  if (e.code === 'KeyC') player.camMode = 1 - player.camMode;
  if (e.code === 'KeyE' && running) transit.interact(player);
});

// --- start & loop --------------------------------------------------------------
let running = false;
$('start-btn').addEventListener('click', () => {
  $('splash').style.display = 'none';
  running = true;
  toast('🚲 Goedemorgen! Find the glowing stroopwafels.', 3500);
});

let wasInRedLight = false;
// debug hook for headless verification (see CLAUDE.md)
window.__ams = { player, day, transit, weather };

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (running) {
    player.update(dt, colliders, camera, elapsed);
    transit.update(dt, player);
    updateCyclists(cyclists, dt);
    updateTourists(tourists, dt, rng, player.pos);
    updateBoats(boats, dt, elapsed);
    updateTram(tram, dt);

    // boarding hint when idling next to a stopped bus
    const hint = transit.boardingHint(player.pos);
    $('hud-controls').textContent = hint
      ? '🚌 ' + hint
      : 'W/S ride · A/D steer · SPACE bell · SHIFT sprint · E bus · C camera';

    // De Wallen border crossing
    const rl = inRedLight(player.pos.x, player.pos.z);
    if (rl && !wasInRedLight) {
      toast('🌹 Welcome to De Wallen. The three X’s are on the city flag. Honest.', 3200);
    }
    wasInRedLight = rl;

    const got = pickups.update(dt, elapsed, player.pos);
    if (got) {
      stats.waffles += got;
      $('s-waffles').textContent = stats.waffles;
      toast('🧇 Stroopwafel! You briefly understand happiness.');
    }
    weather.update(dt, player.pos);
    $('s-time').textContent = day.update(dt, player.pos);
  } else {
    // idle orbit behind the splash screen
    const t = elapsed * 0.08;
    camera.position.set(Math.sin(t) * 60, 26, Math.cos(t) * 60);
    camera.lookAt(0, 4, 0);
    $('s-time').textContent = day.update(dt, new THREE.Vector3());
    updateBoats(boats, dt, elapsed);
    updateCyclists(cyclists, dt);
  }

  renderer.render(scene, camera);
}
frame();
