// Amsterdam Simulator — entry point and game loop.
import * as THREE from 'three';
import { buildCity, inRedLight, NEON_SIGN_MATS } from './city.js';
import { Transit } from './transit.js';
import { buildCuisine, Survival } from './cuisine.js';
import { Wallen } from './wallen.js';
import { Boating } from './boating.js';
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
const { colliders, redlightFronts } = buildCity(scene, rng);
const player = new Player(scene);
const weather = new Weather(scene, rng);
const day = new DayCycle(scene);
const pickups = new Pickups(scene, rng);
const cyclists = spawnCyclists(scene, rng);
const tourists = spawnTourists(scene, rng);
const boats = spawnBoats(scene, rng);
const tram = spawnTram(scene);
const { stalls, toilets } = buildCuisine(scene, rng);
const survival = new Survival();
const wallen = new Wallen(scene, rng, redlightFronts);
let transit, boating; // need `toast`, constructed below

// --- HUD ----------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const stats = { waffles: 0, bells: 0, splashes: 0, kisses: 0 };
let msgTimer = null;
function toast(text, ms = 2600) {
  const el = $('hud-msg');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (el.style.opacity = 0), ms);
}

transit = new Transit(scene, rng, toast);
boating = new Boating(scene, rng, toast);
boating.onTourComplete = () => {
  stats.waffles += 5; // tourists tip in the only currency that matters
  $('s-waffles').textContent = stats.waffles;
  $('s-tours').textContent = boating.tours;
};

survival.onEvent = (type, line) => {
  toast(line, type === 'accident' || type === 'bonk' ? 4200 : 3000);
};
wallen.onKiss = (line) => {
  stats.kisses = wallen.kisses;
  $('s-kisses').textContent = wallen.kisses;
  toast(line, 3000);
};

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
    if (inRedLight(player.pos.x, player.pos.z)) {
      toast(wallen.bellBurst(player.pos), 3000);
    } else if (scattered >= 1) {
      toast(scattered >= 3
        ? `🔔 RING! ${scattered} tourists scatter from the fietspad.`
        : '🔔 Ring! A tourist apologises in four languages while not moving.');
    }
  }
  if (e.code === 'KeyC') player.camMode = 1 - player.camMode;
  if (e.code === 'KeyE' && running && !boating.boating) transit.interact(player);
  if (e.code === 'KeyB' && running && !transit.riding) boating.interact(player);
  if (e.code === 'KeyF' && running && !transit.riding && !boating.boating) {
    const stall = survival.nearestStall(stalls, player.pos);
    if (stall) survival.eat(stall.food);
    else if (survival.hunger < 40) toast('🍽 Nothing to eat here. Follow your nose to a snack cart.');
  }
  if (e.code === 'KeyT' && running && !transit.riding && !boating.boating) {
    if (survival.nearestToilet(toilets, player.pos)) survival.relieve();
    else if (survival.bowels > 70) toast('🚽 No krul in sight. Amsterdam tests you like this.');
  }
});

// --- start & loop --------------------------------------------------------------
let running = false;
$('start-btn').addEventListener('click', () => {
  $('splash').style.display = 'none';
  running = true;
  wallen.muziek.init(); // audio needs a user gesture; De Wallen provides the motive
  toast('🚲 Goedemorgen! Find the glowing stroopwafels.', 3500);
});

let wasInRedLight = false;
let hudClock = 0;
// debug hook for headless verification (see CLAUDE.md)
window.__ams = { player, day, transit, weather, survival, wallen, stalls, toilets, boating };

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (running) {
    player.update(dt, colliders, camera, elapsed);
    transit.update(dt, player);
    boating.update(dt, player, elapsed);
    updateCyclists(cyclists, dt);
    updateTourists(tourists, dt, rng, player.pos);
    updateBoats(boats, dt, elapsed);
    updateTram(tram, dt);

    survival.update(dt, player);
    wallen.update(dt, elapsed, player);

    // survival HUD (throttled to ~4x/sec)
    hudClock -= dt;
    if (hudClock <= 0) {
      hudClock = 0.25;
      const h = $('s-hunger'), b = $('s-bowels');
      h.textContent = `${Math.ceil(survival.hunger)}%`;
      h.style.color = survival.hunger < 25 ? '#ff6b6b' : '';
      b.textContent = `${Math.floor(survival.bowels)}%`;
      b.style.color = survival.bowels > 90 ? '#ff6b6b' : survival.bowels > 70 ? '#ffc06b' : '';
    }

    // contextual hint line: boat > bus > food > toilet > default
    const boatHint = boating.dockHint(player.pos);
    const busHint = boating.boating ? null : transit.boardingHint(player.pos);
    const stall = survival.nearestStall(stalls, player.pos);
    const krul = survival.nearestToilet(toilets, player.pos);
    $('hud-controls').textContent = boatHint
      ? '⛵ ' + boatHint
      : busHint
        ? '🚌 ' + busHint
        : stall
          ? `${stall.food.emoji} F — eat ${stall.food.name}`
          : krul
            ? '🚽 T — use the krul'
            : 'W/S ride · A/D steer · SPACE bell · E bus · B boat · F eat · T toilet · C camera';

    // De Wallen border crossing
    const rl = inRedLight(player.pos.x, player.pos.z);
    if (rl && !wasInRedLight) {
      toast('🌹 Welcome to De Wallen. The three X’s are on the city flag. Honest.', 3200);
    }
    wasInRedLight = rl;

    const got = pickups.update(dt, elapsed, player.pos);
    if (got) {
      stats.waffles += got;
      survival.snack();
      $('s-waffles').textContent = stats.waffles;
      toast('🧇 Stroopwafel! You briefly understand happiness.');
    }
    weather.update(dt, player.pos);
    $('s-time').textContent = day.update(dt, player.pos);

    // neon signs buzz and occasionally give up for a moment
    for (const m of NEON_SIGN_MATS) {
      const p = m.userData.phase;
      m.opacity = Math.sin(elapsed * 1.1 + p * 3.7) > 0.985
        ? 0.12                                    // brief dropout: authentic
        : 0.82 + 0.18 * Math.sin(elapsed * 9 + p);
    }
  } else {
    // idle orbit behind the splash screen
    const t = elapsed * 0.08;
    camera.position.set(Math.sin(t) * 60, 26, Math.cos(t) * 60);
    camera.lookAt(0, 4, 0);
    $('s-time').textContent = day.update(dt, new THREE.Vector3());
    updateBoats(boats, dt, elapsed);
    updateCyclists(cyclists, dt);
    wallen.update(dt, elapsed, player);
  }

  renderer.render(scene, camera);
}
frame();
