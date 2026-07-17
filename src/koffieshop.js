// Koffieshop De Slang — the door between the two Amsterdams.
// Duck inside and the city folds into a 2D arcade snake game (snake.html).
import * as THREE from 'three';

const SHOP_POS = { x: -52, z: 14.5 }; // pavement strip on the De Wallen canal's south quay, west of the district

function neonText(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 56px "Segoe UI", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color;
  for (let i = 0; i < 3; i++) g.fillText(text, 256, 50);
  g.shadowBlur = 0;
  g.fillStyle = '#f2ffe9';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Koffieshop {
  constructor(scene, colliders) {
    const g = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: '#1d3a24' });
    const trim = new THREE.MeshLambertMaterial({ color: '#e8e3d8' });

    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 5.2, 4.4), green);
    body.position.y = 2.6;
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 4.6), trim);
    cornice.position.y = 5.3;

    // big warm window — always glowing, hours are a suggestion
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.2),
      new THREE.MeshLambertMaterial({
        color: '#7ec86a', emissive: '#4a8a2e', emissiveIntensity: 0.8,
      })
    );
    glass.position.set(-1.2, 2.0, 2.21);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 2.6, 0.12),
      new THREE.MeshLambertMaterial({ color: '#10240f' })
    );
    door.position.set(2.2, 1.3, 2.2);

    // the sign: green neon, of course
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 1.2),
      new THREE.MeshBasicMaterial({
        map: neonText('🐍 DE SLANG ☕', '#39d353'), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    sign.position.set(0, 6.1, 2.0);

    // a curl of neon smoke over the roof
    const curl = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.5, 0.09, 48, 8, 2, 3),
      new THREE.MeshLambertMaterial({ color: '#39d353', emissive: '#1f8a34', emissiveIntensity: 1.2 })
    );
    curl.position.set(-2.6, 6.6, 1.6);
    this.curl = curl;

    g.add(body, cornice, glass, door, sign, curl);
    g.position.set(SHOP_POS.x, 0, SHOP_POS.z);
    scene.add(g);
    colliders.push({ x: SHOP_POS.x, z: SHOP_POS.z, hw: 3.7, hd: 2.4 });
  }

  near(pos) {
    return Math.hypot(pos.x - SHOP_POS.x, pos.z - SHOP_POS.z) < 6.5;
  }

  update(elapsed) {
    this.curl.rotation.y = elapsed * 0.6;
    this.curl.position.y = 6.6 + Math.sin(elapsed * 1.2) * 0.12;
  }
}
