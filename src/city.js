// Procedural Amsterdam: canals, quays, bridges, and rows of leaning canal houses.
import * as THREE from 'three';

export const WORLD = {
  size: 480,                    // ground extent (centered on origin)
  canalZ: [-90, -30, 30, 90],   // canal centerlines, parallel to the X axis
  canalHalf: 7,                 // canal half-width
  bridgeX: [-150, -75, 0, 75, 150], // north-south roads (bridges cross canals here)
  bridgeHalf: 5,                // bridge half-width along X
  houseRowOffset: 18,           // distance from canal center to house fronts
  blockEdge: 170,               // houses span x in [-blockEdge, blockEdge]
};

const PALETTE = ['#7a3b2e', '#5d4037', '#2e3d33', '#3e2f2a', '#233140', '#6b4423', '#8c5a3c', '#31363b'];

// De Wallen: the stretch of the canal-30 quarter that glows after dark.
export const REDLIGHT = { x1: 20, x2: 110, z1: 4, z2: 56, canal: 30 };

// The inner city, where the koffieshop density approaches saturation.
export const KOFFIE_ZONE = { x: 130, rows: [-48, -12, 12, 48] };

const KOFFIE_NAMES = [
  'DE GROENE REIGER', 'SPACE KAAS', 'DE DUBBELE WAFEL', 'PARADISE 020',
  'DE SLAPENDE TULP', 'HET ZACHTE GRAS', 'COFFEESHOP RELAX', 'DE HOGE BRUG',
  'GREEN LIGHT DISTRICT', 'DE TRAGE TRAM', 'WOLKENVELD', 'DE BLIJE FIETS',
  'MELLOW MOLEN', 'DE VERGETEN SLEUTEL', 'CLOUD NEGEN', 'HET DERDE WIEL',
];

export function inRedLight(x, z) {
  return x > REDLIGHT.x1 && x < REDLIGHT.x2 && z > REDLIGHT.z1 && z < REDLIGHT.z2;
}

function drawSilhouette(g, x, y, w, h) {
  // a figure in the window: one hand on hip, lit from behind. Tasteful. Ish.
  g.fillStyle = 'rgba(10,4,8,0.92)';
  g.beginPath();
  g.arc(x + w / 2, y + h * 0.18, w * 0.16, 0, Math.PI * 2); // head
  g.fill();
  g.beginPath();
  g.moveTo(x + w * 0.36, y + h * 0.30);
  g.bezierCurveTo(x + w * 0.18, y + h * 0.48, x + w * 0.42, y + h * 0.58, x + w * 0.34, y + h * 0.78);
  g.lineTo(x + w * 0.34, y + h);
  g.lineTo(x + w * 0.62, y + h);
  g.bezierCurveTo(x + w * 0.58, y + h * 0.70, x + w * 0.80, y + h * 0.52, x + w * 0.62, y + h * 0.32);
  g.closePath();
  g.fill();
}

const facadeCache = new Map();
function facadeTexture(color, floors, redlight = false, variant = 0) {
  const key = `${color}:${floors}:${redlight}:${variant}`;
  if (facadeCache.has(key)) return facadeCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64 * floors;
  const g = c.getContext('2d');
  g.fillStyle = redlight ? '#241018' : color;
  g.fillRect(0, 0, c.width, c.height);
  // subtle brick coursing
  g.strokeStyle = 'rgba(0,0,0,0.15)';
  for (let y = 0; y < c.height; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  // tall white-framed windows, the Amsterdam way
  for (let f = 0; f < floors; f++) {
    for (let wx = 0; wx < 3; wx++) {
      const x = 14 + wx * 38, y = 10 + f * 64;
      if (redlight) {
        // red-lit frames, velvet glow, and — in the ground-floor windows — company
        g.fillStyle = '#ff2445';
        g.fillRect(x - 4, y - 4, 32, 48);
        const grad = g.createRadialGradient(x + 12, y + 22, 4, x + 12, y + 22, 30);
        grad.addColorStop(0, '#ff8ba0');
        grad.addColorStop(0.55, '#e0355c');
        grad.addColorStop(1, '#6e1028');
        g.fillStyle = grad;
        g.fillRect(x, y, 24, 40);
        const groundFloor = f === floors - 1; // canvas y grows downward; last row is street level
        if (groundFloor && (wx + variant) % 2 === 0) {
          drawSilhouette(g, x, y, 24, 40);
        } else if ((wx * 3 + f + variant) % 4 === 0) {
          // drawn velvet curtain: someone is on a break
          g.fillStyle = '#8e1030';
          g.fillRect(x, y, 24, 40);
          g.strokeStyle = 'rgba(0,0,0,0.35)';
          for (let cx2 = x + 3; cx2 < x + 24; cx2 += 5) {
            g.beginPath(); g.moveTo(cx2, y); g.lineTo(cx2, y + 40); g.stroke();
          }
        }
      } else {
        g.fillStyle = '#e8e3d8';
        g.fillRect(x - 3, y - 3, 30, 46);
        g.fillStyle = f === floors - 1 && wx === 1 ? '#1a2530' : '#141c26';
        g.fillRect(x, y, 24, 40);
        g.strokeStyle = '#e8e3d8'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + 12, y); g.lineTo(x + 12, y + 40);
        g.moveTo(x, y + 20); g.lineTo(x + 24, y + 20); g.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  facadeCache.set(key, tex);
  return tex;
}

const NEON_TEXTS = ['♥♥♥', 'XXX', 'CABARET', 'LIVE', 'MOULIN ROOD', 'PARADISO', 'ROSSE', 'OH LÀ LÀ'];
const NEON_COLORS = ['#ff2d6f', '#ff3b30', '#ff6ad5', '#ff8c42'];

// sign materials, collected so main.js can make them buzz and flicker
export const NEON_SIGN_MATS = [];

const neonCache = new Map();
function neonTexture(text, color) {
  const key = `${text}:${color}`;
  if (neonCache.has(key)) return neonCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 40px "Segoe UI", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 22;
  g.fillStyle = color;
  for (let i = 0; i < 3; i++) g.fillText(text, 128, 34); // stacked passes = glow
  g.shadowBlur = 0;
  g.fillStyle = '#fff0f5';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  neonCache.set(key, tex);
  return tex;
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,80,110,0.9)');
  grad.addColorStop(0.5, 'rgba(255,30,70,0.35)');
  grad.addColorStop(1, 'rgba(255,30,70,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function makeHouse(rng, width, depth, redlight = false, koffie = false) {
  const floors = 3 + Math.floor(rng() * 3);        // 3–5 floors
  const height = floors * 3.2;
  const color = redlight ? '#241018' : PALETTE[Math.floor(rng() * PALETTE.length)];
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const variant = Math.floor(rng() * 4);
  const faceMat = redlight
    ? new THREE.MeshLambertMaterial({
        map: facadeTexture(color, floors, true, variant),
        emissive: '#e0355c', emissiveIntensity: 0.55,
        emissiveMap: facadeTexture(color, floors, true, variant),
      })
    : new THREE.MeshLambertMaterial({ map: facadeTexture(color, floors) });
  // face the +Z side with windows; other sides plain
  const mats = [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat];
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats);
  body.position.y = height / 2;
  group.add(body);

  // gable: stepped (trapgevel) or pointed
  const gh = 2.6;
  if (rng() < 0.5) {
    for (let i = 0; i < 3; i++) {
      const w = width * (1 - (i + 1) * 0.28);
      const step = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.8), gh / 3, depth), bodyMat);
      step.position.y = height + gh / 6 + i * (gh / 3);
      group.add(step);
    }
  } else {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, gh); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    const gable = new THREE.Mesh(geo, bodyMat);
    gable.position.set(0, height, -depth / 2);
    group.add(gable);
  }
  // cornice trim — white normally, neon red in De Wallen
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.15, 0.35, depth + 0.15),
    redlight
      ? new THREE.MeshLambertMaterial({ color: '#ff2445', emissive: '#ff2445', emissiveIntensity: 0.9 })
      : new THREE.MeshLambertMaterial({ color: '#e8e3d8' })
  );
  trim.position.y = height + 0.05;
  group.add(trim);

  if (redlight) {
    // red lamp over the door + soft glow
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshLambertMaterial({ color: '#ff2445', emissive: '#ff2445', emissiveIntensity: 1.6 })
    );
    lamp.position.set(0, 3.4, depth / 2 + 0.3);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    glow.scale.set(4.5, 4.5, 1);
    glow.position.copy(lamp.position);
    group.add(lamp, glow);

    // a neon sign on most establishments
    if (rng() < 0.7) {
      const text = NEON_TEXTS[Math.floor(rng() * NEON_TEXTS.length)];
      const colorN = NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)];
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(width - 0.6, 4.6), 1.15),
        new THREE.MeshBasicMaterial({
          map: neonTexture(text, colorN), transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        })
      );
      sign.position.set(0, 5.4 + rng() * 3, depth / 2 + 0.25);
      sign.material.userData.phase = rng() * 20; // per-sign flicker offset
      NEON_SIGN_MATS.push(sign.material);
      group.add(sign);
    }
  }

  if (koffie) {
    // ground floor converted to a koffieshop: green neon name, warm haze window
    const name = KOFFIE_NAMES[Math.floor(rng() * KOFFIE_NAMES.length)];
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(width - 0.4, 5.2), 0.7),
      new THREE.MeshBasicMaterial({
        map: neonTexture(name, rng() < 0.3 ? '#a4f79b' : '#39d353'), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    sign.position.set(0, 3.6, depth / 2 + 0.22);
    sign.material.userData.phase = rng() * 20;
    NEON_SIGN_MATS.push(sign.material);
    const window_ = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(width - 1.2, 3.4), 1.9),
      new THREE.MeshLambertMaterial({
        color: '#9fdc8a', emissive: '#3f7a2c', emissiveIntensity: 0.7,
        transparent: true, opacity: 0.92,
      })
    );
    window_.position.set(0, 1.4, depth / 2 + 0.16);
    group.add(sign, window_);
  }

  // the famous forward lean
  group.rotation.x = (rng() - 0.35) * 0.03;
  return { group, height };
}

export function buildCity(scene, rng) {
  const W = WORLD;
  const colliders = []; // {x, z, hw, hd} AABBs (houses, trees)
  const redlightFronts = []; // {x, z, n} facade positions in De Wallen (n = outward normal sign on Z)
  const koffieshopFronts = []; // {x, z, n} inner-city koffieshop doors

  // Ground: brick-toned pavement
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W.size, W.size),
    new THREE.MeshLambertMaterial({ color: '#4e4a45' })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads (slightly lighter strips) along quays and N-S
  const roadMat = new THREE.MeshLambertMaterial({ color: '#5c574f' });
  for (const cz of W.canalZ) {
    for (const side of [-1, 1]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(W.size, 7), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, cz + side * (W.canalHalf + 4.5));
      scene.add(road);
    }
  }
  for (const bx of W.bridgeX) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, W.size), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(bx, 0.01, 0);
    scene.add(road);
  }

  // Canals: sunken water + quay walls
  const waterMat = new THREE.MeshLambertMaterial({ color: '#1d3a35', transparent: true, opacity: 0.92 });
  const quayMat = new THREE.MeshLambertMaterial({ color: '#3a3631' });
  const waters = [];
  for (const cz of W.canalZ) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W.size, W.canalHalf * 2), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.9, cz);
    scene.add(water);
    waters.push(water);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(W.size, 1.2, 0.6), quayMat);
      wall.position.set(0, -0.55, cz + side * (W.canalHalf + 0.3));
      scene.add(wall);
    }
  }

  // Bridges: deck + brick arches + white railings
  const deckMat = new THREE.MeshLambertMaterial({ color: '#6b5a4a' });
  const railMat = new THREE.MeshLambertMaterial({ color: '#dad5c9' });
  for (const bx of W.bridgeX) {
    for (const cz of W.canalZ) {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W.bridgeHalf * 2, 0.5, W.canalHalf * 2 + 2), deckMat);
      deck.position.set(bx, 0.1, cz);
      scene.add(deck);
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, W.canalHalf * 2 + 2), railMat);
        rail.position.set(bx + side * (W.bridgeHalf - 0.2), 0.85, cz);
        scene.add(rail);
      }
    }
  }

  // Canal houses: rows facing each canal from both sides
  for (const cz of W.canalZ) {
    for (const side of [-1, 1]) {
      const rowZ = cz + side * W.houseRowOffset;
      let x = -W.blockEdge;
      while (x < W.blockEdge) {
        const width = 5.5 + rng() * 3;
        const cx = x + width / 2;
        x += width + 0.4;
        // leave gaps at the N-S roads
        if (W.bridgeX.some((bx) => Math.abs(cx - bx) < 7 + width / 2)) continue;
        const depth = 10 + rng() * 3;
        const redlight = cz === REDLIGHT.canal && cx > REDLIGHT.x1 && cx < REDLIGHT.x2;
        if (redlight) redlightFronts.push({ x: cx, z: rowZ, n: -side });
        // the inner city: almost every remaining building is a koffieshop
        const koffie = !redlight
          && KOFFIE_ZONE.rows.includes(rowZ)
          && Math.abs(cx) < KOFFIE_ZONE.x
          && rng() < 0.85;
        if (koffie) koffieshopFronts.push({ x: cx, z: rowZ, n: -side });
        const { group } = makeHouse(rng, width, depth, redlight, koffie);
        group.position.set(cx, 0, rowZ + side * depth / 2);
        // windows face the canal
        if (side === 1) group.rotation.y = Math.PI;
        scene.add(group);
        colliders.push({ x: cx, z: rowZ + side * depth / 2, hw: width / 2 + 0.3, hd: depth / 2 + 0.3 });
      }
    }
  }

  // Trees and lampposts along the quays
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#4a3826' });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#3d5c35' });
  const poleMat = new THREE.MeshLambertMaterial({ color: '#20242a' });
  for (const cz of W.canalZ) {
    for (const side of [-1, 1]) {
      for (let x = -W.blockEdge; x <= W.blockEdge; x += 22) {
        if (W.bridgeX.some((bx) => Math.abs(x - bx) < 8)) continue;
        const z = cz + side * (W.canalHalf + 1.6);
        if ((x / 22 + side) % 2 === 0) {
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3.4, 6), trunkMat);
          trunk.position.y = 1.7;
          const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + rng(), 1), leafMat);
          crown.position.y = 4.6;
          crown.scale.y = 1.25;
          tree.add(trunk, crown);
          tree.position.set(x + rng() * 3, 0, z);
          scene.add(tree);
          colliders.push({ x: tree.position.x, z, hw: 0.5, hd: 0.5 });
        } else {
          const lamp = new THREE.Group();
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.6, 6), poleMat);
          pole.position.y = 2.3;
          const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 8, 8),
            new THREE.MeshLambertMaterial({ color: '#ffd9a0', emissive: '#c98c3a', emissiveIntensity: 0.6 })
          );
          head.position.y = 4.6;
          lamp.add(pole, head);
          lamp.position.set(x, 0, z);
          scene.add(lamp);
        }
      }
    }
  }

  // De Wallen dressing: red string lights along the quays and a warm wash of light
  const bulbMat = new THREE.MeshLambertMaterial({ color: '#ff2445', emissive: '#ff2445', emissiveIntensity: 1.4 });
  const bulbGeo = new THREE.SphereGeometry(0.09, 6, 6);
  for (const side of [-1, 1]) {
    const z = REDLIGHT.canal + side * (W.canalHalf + 0.4);
    for (let x = REDLIGHT.x1; x <= REDLIGHT.x2; x += 2.5) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x, 1.1 + Math.sin(x * 1.7) * 0.15, z);
      scene.add(bulb);
    }
  }
  for (const [lx, lz] of [[40, 42], [65, 18], [90, 42]]) {
    const light = new THREE.PointLight('#ff3558', 14, 36, 1.8);
    light.position.set(lx, 5, lz);
    scene.add(light);
  }

  // Westerkerk-ish tower as a landmark at the city center north
  const tower = new THREE.Group();
  const towerBody = new THREE.Mesh(new THREE.BoxGeometry(8, 46, 8), new THREE.MeshLambertMaterial({ color: '#6e5b45' }));
  towerBody.position.y = 23;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(5.5, 16, 4), new THREE.MeshLambertMaterial({ color: '#2b5f8a' }));
  spire.position.y = 54; spire.rotation.y = Math.PI / 4;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 8), new THREE.MeshLambertMaterial({ color: '#e0b83d', emissive: '#7a5c10' }));
  crown.position.y = 63;
  tower.add(towerBody, spire, crown);
  tower.position.set(37, 0, -60);
  scene.add(tower);
  colliders.push({ x: 37, z: -60, hw: 4.5, hd: 4.5 });

  return { colliders, waters, redlightFronts, koffieshopFronts };
}

// --- spatial queries -------------------------------------------------------

export function nearestCanal(z) {
  let best = WORLD.canalZ[0];
  for (const cz of WORLD.canalZ) if (Math.abs(z - cz) < Math.abs(z - best)) best = cz;
  return best;
}

export function isOverWater(x, z) {
  const inCanal = WORLD.canalZ.some((cz) => Math.abs(z - cz) < WORLD.canalHalf);
  if (!inCanal) return false;
  const onBridge = WORLD.bridgeX.some((bx) => Math.abs(x - bx) < WORLD.bridgeHalf);
  return !onBridge;
}

export function collide(x, z, radius, colliders) {
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) < c.hw + radius && Math.abs(dz) < c.hd + radius) return c;
  }
  return null;
}

export function clampToWorld(v) {
  const lim = WORLD.size / 2 - 4;
  v.x = Math.max(-lim, Math.min(lim, v.x));
  v.z = Math.max(-lim, Math.min(lim, v.z));
  return v;
}
