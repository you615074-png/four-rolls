// The shop itself: the front on the street, the glass counter inside, and small things on it.
// A Hong Kong photo-finishing shop at night — neon over the door, mint tiles, a roller
// shutter half down, fluorescent light spilling out.

import * as THREE from 'three';
import { FONT, addGrain, canvas, canvasTexture, glowTexture, rng, softNoise } from './util.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, dithering: true, ...o });
const glow = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });

function shadowed(obj) {
  obj.traverse((m) => {
    if (m.isMesh) m.castShadow = m.receiveShadow = true;
  });
  return obj;
}

/* ---------- surfaces ---------- */

/** Pale green formica with fine flecks: every counter and bench in the shop. */
export function laminateTexture() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#a9c2b6';
  g.fillRect(0, 0, S, S);
  softNoise(g, S, S, 21, 18, 0.2, ['#8fab9e', '#c3d6cc']);
  const r = rng(77);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v > 0.7 ? 'rgba(40,60,52,0.35)' : v > 0.4 ? 'rgba(240,248,242,0.35)' : 'rgba(120,150,138,0.4)';
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  addGrain(g, S, S, 0.1);
  return canvasTexture(c, { repeat: [9, 9] });
}

/** Small square mosaic tiles, the shopfront pillars and the back wall. */
export function mosaicTexture({ base = '#a9d6c6', dark = '#7fb7a5', light = '#cdeee2', grout = '#e9efe9', n = 16, seed = 4 } = {}) {
  const S = 1024;
  const [c, g] = canvas(S, S);
  g.fillStyle = grout;
  g.fillRect(0, 0, S, S);
  const r = rng(seed);
  const cell = S / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = r();
      g.fillStyle = v > 0.86 ? dark : v > 0.72 ? light : base;
      const p = 3;
      g.fillRect(x * cell + p, y * cell + p, cell - p * 2, cell - p * 2);
      // a glaze highlight on each tile
      const gr = g.createLinearGradient(x * cell, y * cell, x * cell + cell, y * cell + cell);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.08)');
      g.fillStyle = gr;
      g.fillRect(x * cell + p, y * cell + p, cell - p * 2, cell - p * 2);
    }
  addGrain(g, S, S, 0.12);
  return canvasTexture(c);
}

/* ---------- the shopfront ---------- */

function neonTexture() {
  const W = 2048, H = 560;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#0d0b0b';
  g.fillRect(0, 0, W, H);
  // the painted board under the tubes
  g.strokeStyle = '#2a2523';
  g.lineWidth = 10;
  g.strokeRect(16, 16, W - 32, H - 32);
  const tube = (text, font, x, y, color, blur, width) => {
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (const [b, a] of [[blur * 2.2, 0.55], [blur, 0.8]]) {
      g.shadowColor = color;
      g.shadowBlur = b;
      g.strokeStyle = color;
      g.globalAlpha = a;
      g.lineWidth = width;
      g.strokeText(text, x, y);
    }
    g.globalAlpha = 1;
    g.shadowBlur = blur * 0.5;
    g.strokeStyle = '#fff4f0';
    g.lineWidth = width * 0.38;
    g.strokeText(text, x, y);
    g.shadowBlur = 0;
  };
  tube('四卷沖印', `900 250px ${FONT.sign}`, W / 2, 230, '#ff3b4f', 26, 12);
  tube('FOUR ROLLS PHOTO', `600 92px ${FONT.cond}`, W / 2 - 220, 452, '#5ff2c8', 16, 6);
  tube('1 HR', `700 92px ${FONT.cond}`, W / 2 + 560, 452, '#ffd23a', 16, 6);
  return canvasTexture(c);
}

function verticalSignTexture() {
  const W = 300, H = 1300;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#ffd43a';
  g.fillRect(0, 0, W, H);
  softNoise(g, W, H, 8, 8, 0.12, ['#fff3b0', '#e3a91e']);
  g.strokeStyle = '#c21d16';
  g.lineWidth = 14;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.fillStyle = '#c21d16';
  g.font = `900 200px ${FONT.sign}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ['影', '相', '沖', '曬'].forEach((ch, i) => g.fillText(ch, W / 2, 175 + i * 255));
  g.fillStyle = '#151413';
  g.font = `600 40px ${FONT.cond}`;
  g.fillText('PHOTO', W / 2, H - 80);
  return canvasTexture(c);
}

function shutterTexture() {
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  for (let y = 0; y < H; y += 16) {
    const gr = g.createLinearGradient(0, y, 0, y + 16);
    gr.addColorStop(0, '#8a8f8e');
    gr.addColorStop(0.45, '#c7cccb');
    gr.addColorStop(0.55, '#a8adac');
    gr.addColorStop(1, '#5d6261');
    g.fillStyle = gr;
    g.fillRect(0, y, W, 16);
  }
  softNoise(g, W, H, 31, 10, 0.3, ['#4d4a44', '#9aa09d', '#6b5a48']);
  addGrain(g, W, H, 0.25);
  return canvasTexture(c, { repeat: [4, 1] });
}

/** What you see through the glass: fluorescent tubes, shelves of film, the counter, photos on the wall. */
function interiorTexture() {
  const W = 1600, H = 1000;
  const [c, g] = canvas(W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#dff3ec');
  bg.addColorStop(0.55, '#bfe0d4');
  bg.addColorStop(1, '#6f9184');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // back wall: small mint tiles
  g.globalAlpha = 0.18;
  for (let y = 120; y < 640; y += 26)
    for (let x = 0; x < W; x += 26) {
      g.strokeStyle = '#3f6c5e';
      g.strokeRect(x, y, 26, 26);
    }
  g.globalAlpha = 1;
  // fluorescent tubes
  for (const x of [260, 760, 1260]) {
    g.shadowColor = '#ffffff';
    g.shadowBlur = 40;
    g.fillStyle = '#ffffff';
    g.fillRect(x, 40, 300, 16);
  }
  g.shadowBlur = 0;
  // photos on the back wall
  const r = rng(12);
  for (let i = 0; i < 26; i++) {
    const x = 60 + (i % 13) * 116 + r() * 20, y = 170 + Math.floor(i / 13) * 150 + r() * 14;
    g.fillStyle = '#f8f4ea';
    g.fillRect(x, y, 86, 110);
    g.fillStyle = `hsl(${r() * 360}, 30%, ${35 + r() * 25}%)`;
    g.fillRect(x + 7, y + 7, 72, 80);
  }
  // shelves of film boxes
  const boxes = ['#f2c12e', '#2e7d4f', '#d23a2c', '#2d4f8f', '#f08a24', '#151413'];
  for (let s = 0; s < 2; s++) {
    const y = 500 + s * 90;
    g.fillStyle = '#6b5240';
    g.fillRect(40, y + 64, W - 80, 10);
    for (let x = 60; x < W - 90; x += 46) {
      g.fillStyle = boxes[Math.floor(r() * boxes.length)];
      g.fillRect(x, y + 8 + r() * 6, 38, 56);
    }
  }
  // the counter in front, glass on top, a lamp-lit sheen
  g.fillStyle = '#2b3a36';
  g.fillRect(0, 770, W, 230);
  g.fillStyle = 'rgba(220,255,240,0.25)';
  g.fillRect(0, 770, W, 12);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = 0; x < W; x += 180) g.fillRect(x + 30, 800, 110, 150);
  addGrain(g, W, H, 0.12);
  return canvasTexture(c);
}

function doorGlassTexture() {
  const W = 1024, H = 1600;
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  // stickers and hand-painted lettering on the glass
  const sticker = (x, y, w, h, bg, lines) => {
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    for (const [text, font, color, dy] of lines) {
      g.fillStyle = color;
      g.font = font;
      g.textAlign = 'center';
      g.fillText(text, x + w / 2, y + dy);
    }
  };
  sticker(120, 560, 360, 150, '#d22a20', [['營業中', `900 76px ${FONT.sign}`, '#fff', 86], ['OPEN', `600 38px ${FONT.cond}`, '#ffd43a', 134]]);
  sticker(560, 560, 340, 150, '#ffd43a', [['1小時沖印', `900 54px ${FONT.sign}`, '#c21d16', 78], ['1-HOUR PROCESSING', `600 26px ${FONT.cond}`, '#151413', 124]]);
  g.font = `900 64px ${FONT.sign}`;
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.textAlign = 'center';
  g.fillText('證件相 · 過膠 · 放大', W / 2, 860);
  g.font = `600 30px ${FONT.cond}`;
  g.fillText('PASSPORT PHOTOS · LAMINATING · ENLARGEMENTS', W / 2, 912);
  // the pull handle
  g.fillStyle = 'rgba(210,215,214,0.95)';
  g.fillRect(W / 2 - 16, 1000, 32, 300);
  return canvasTexture(c);
}

function staffDoorTexture() {
  const W = 400, H = 960;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#4b5754';
  g.fillRect(0, 0, W, H);
  softNoise(g, W, H, 61, 12, 0.35, ['#2f3836', '#68736f', '#5c4637']);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 6;
  g.strokeRect(30, 40, W - 60, H - 80);
  g.fillStyle = '#efe7d4';
  g.fillRect(70, 230, W - 140, 150);
  g.fillStyle = '#c21d16';
  g.font = `900 56px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('店主入口', W / 2, 300);
  g.fillStyle = '#151413';
  g.font = `600 30px ${FONT.cond}`;
  g.fillText('STAFF ONLY', W / 2, 352);
  g.fillStyle = '#b9bdbb';
  g.beginPath();
  g.arc(W - 70, 560, 18, 0, Math.PI * 2);
  g.fill();
  addGrain(g, W, H, 0.2);
  return canvasTexture(c);
}

function sidewalkTexture() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#3b3f40';
  g.fillRect(0, 0, S, S);
  softNoise(g, S, S, 5, 20, 0.5, ['#24282a', '#55595a', '#2e3436']);
  g.strokeStyle = 'rgba(10,12,12,0.6)';
  g.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(0, i * 256); g.lineTo(S, i * 256); g.stroke();
    g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, S); g.stroke();
  }
  addGrain(g, S, S, 0.3);
  return canvasTexture(c, { repeat: [5, 3] });
}

/**
 * The street front. Returns the pickable door, the owner's door, and a light-up hook.
 * Facade sits on z = 0, the street runs towards +z.
 */
export function buildStorefront(stage) {
  const root = new THREE.Group();
  stage.world.add(root);

  const walk = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), std('#ffffff', { map: sidewalkTexture(), roughness: 0.42, metalness: 0.1 }));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, 0, 7);
  walk.receiveShadow = true;
  root.add(walk);
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(26, 0.18, 0.4), std('#7c7f7d', { roughness: 0.8 }));
  kerb.position.set(0, 0.09, 9.6);
  root.add(kerb);

  // the building face: dark plaster above, mosaic pillars either side of the shopfront
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), std('#2a2c2b', { roughness: 0.95 }));
  wall.position.set(0, 7, -0.05);
  wall.receiveShadow = true;
  root.add(wall);
  const tiles = mosaicTexture();
  for (const [x, w] of [[-4.75, 3.5], [4.75, 3.5], [-9.5, 6], [9.5, 6]]) {
    const t = tiles.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 1.4, 3.9 / 1.4);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.9), std('#ffffff', { map: t, roughness: 0.32 }));
    p.position.set(x, 1.95, 0);
    p.receiveShadow = true;
    root.add(p);
  }

  // what's inside, glowing through the glass
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.9), new THREE.MeshBasicMaterial({ map: interiorTexture(), toneMapped: false, color: new THREE.Color(0.95, 1.0, 0.98) }));
  inside.position.set(0, 1.95, -0.9);
  root.add(inside);
  // the side walls of the shop, seen through the glass
  for (const x of [-3.05, 3.05]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.9), std('#1d2321'));
    side.position.set(x + (x < 0 ? -0.05 : 0.05), 1.95, -0.45);
    side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(side);
  }

  // aluminium frame, glass, the door
  const alu = std('#b9bfbd', { metalness: 0.85, roughness: 0.32 });
  const bars = [[0, 3.55, 6.2, 0.12], [0, 0.06, 6.2, 0.12], [-3.04, 1.8, 0.12, 3.6], [3.04, 1.8, 0.12, 3.6], [-1.05, 1.8, 0.1, 3.6], [1.05, 1.8, 0.1, 3.6]];
  for (const [x, y, w, h] of bars) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), alu);
    b.position.set(x, y, 0.04);
    root.add(b);
  }
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe9e0', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
  for (const [x, w] of [[-2.05, 1.95], [2.05, 1.95]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), glass);
    pane.position.set(x, 1.8, 0.02);
    root.add(pane);
  }
  const door = new THREE.Group();
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.36), new THREE.MeshBasicMaterial({ map: doorGlassTexture(), transparent: true, toneMapped: false, depthWrite: false }));
  doorGlass.position.z = 0.01;
  const doorPane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.36), glass.clone());
  door.add(doorPane, doorGlass);
  door.position.set(0, 1.78, 0.03);
  root.add(door);

  // the roller shutter, pulled half way down over the top of the shopfront
  const shutter = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.75), std('#ffffff', { map: shutterTexture(), roughness: 0.45, metalness: 0.6 }));
  shutter.position.set(0, 3.3, 0.1);
  shutter.castShadow = true;
  root.add(shutter);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(6.25, 0.08, 0.16), std('#6b706e', { metalness: 0.8, roughness: 0.3 }));
  lip.position.set(0, 2.92, 0.12);
  root.add(lip);
  const box = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.42, 0.5), std('#3c403f', { metalness: 0.6, roughness: 0.45 }));
  box.position.set(0, 3.88, 0.22);
  root.add(shadowed(box));

  // the neon board
  const board = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.36, 0.22), [
    std('#181614'), std('#181614'), std('#181614'), std('#181614'),
    new THREE.MeshBasicMaterial({ map: neonTexture(), toneMapped: false }), std('#181614'),
  ]);
  board.position.set(0, 5.35, 0.25);
  root.add(board);
  const neonFace = board.material[4];
  const neonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff2f48', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  neonGlow.scale.set(13, 5, 1);
  neonGlow.position.set(0, 5.4, 0.7);
  root.add(neonGlow);
  const red = new THREE.PointLight('#ff3048', 26, 14, 1.6);
  red.position.set(0, 4.6, 2.2);
  root.add(red);

  // the yellow vertical sign on the right pillar
  const vs = new THREE.Mesh(new THREE.BoxGeometry(1.0, 4.3, 0.24), [
    std('#d9a520'), std('#d9a520'), std('#d9a520'), std('#d9a520'),
    new THREE.MeshBasicMaterial({ map: verticalSignTexture(), toneMapped: false, color: new THREE.Color(1.1, 1.05, 0.95) }), std('#d9a520'),
  ]);
  vs.position.set(4.9, 5.0, 0.3);
  root.add(vs);
  const yellow = new THREE.PointLight('#ffcf4a', 6, 7, 1.6);
  yellow.position.set(4.9, 4.2, 1.6);
  root.add(yellow);

  // light falling out of the shop onto the wet pavement
  const pool = (color, x, z, sx, sz, o) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.01, z);
    root.add(m);
    return m;
  };
  pool('#bff5e2', 0, 1.6, 8, 4.5, 0.3);
  const redPool = pool('#ff2c45', 0, 3.4, 12, 6, 0.22);
  pool('#ffc93a', 4.9, 2.2, 3, 3, 0.18);
  const spill = new THREE.PointLight('#d8fff0', 9, 9, 1.4);
  spill.position.set(0, 2.2, 1.2);
  root.add(spill);

  // the owner's side door, on the left pillar
  const staff = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.5), std('#ffffff', { map: staffDoorTexture(), roughness: 0.55, metalness: 0.3 }));
  staff.position.set(-5.35, 1.25, 0.02);
  root.add(staff);

  // a little life: the neon buzzes and now and then a letter stutters
  let flick = 0;
  const tick = (dt, t) => {
    flick -= dt;
    if (flick < -4 - Math.random() * 6) flick = 0.25;
    const k = flick > 0 ? (Math.sin(t * 90) > 0 ? 0.35 : 1) : 1;
    neonFace.color.setScalar(1.15 * k);
    neonGlow.material.opacity = (0.5 + Math.sin(t * 2.3) * 0.03) * k;
    red.intensity = 26 * k;
    redPool.material.opacity = 0.22 * k;
  };
  return { root, door, doorGlass, staff, inside, tick };
}

/* ---------- inside: the glass counter ---------- */

function caseTexture() {
  const W = 2400, H = 1440;
  const [c, g] = canvas(W, H);
  // dark felt at the bottom of the display case
  g.fillStyle = '#1b2421';
  g.fillRect(0, 0, W, H);
  softNoise(g, W, H, 14, 30, 0.35, ['#0f1513', '#2b3834', '#1e2a27']);
  const r = rng(41);
  // boxes of film, in a loose row along the back
  const looks = [
    ['#f2c12e', '#c21d16', 'COLOR 200'], ['#2e7d4f', '#f4efe1', 'PRO 400'], ['#d23a2c', '#fff', 'ISO 400'],
    ['#2d4f8f', '#ffd43a', 'SLIDE 100'], ['#151413', '#f2c12e', 'B&W 400'], ['#f08a24', '#151413', 'GOLD 200'],
  ];
  const filmBox = (x, y, w, h, rot, k) => {
    const [bg, ink, label] = looks[k % looks.length];
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(-w / 2 + 10, -h / 2 + 12, w, h);
    g.fillStyle = bg;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = ink;
    g.fillRect(-w / 2, -h / 2 + h * 0.62, w, h * 0.1);
    g.font = `700 ${Math.round(h * 0.17)}px ${FONT.cond}`;
    g.textAlign = 'center';
    g.fillText(label, 0, -h * 0.08);
    g.font = `500 ${Math.round(h * 0.09)}px ${FONT.cond}`;
    g.fillText('36 EXP · 135', 0, h * 0.42);
    g.restore();
  };
  for (let i = 0; i < 11; i++) filmBox(170 + i * 205 + r() * 30, 170 + r() * 40, 160, 230, (r() - 0.5) * 0.25, i);
  // a couple of old cameras lying on the felt
  const camera = (x, y, rot) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(-190, -88, 400, 200);
    g.fillStyle = '#121212';
    g.fillRect(-200, -100, 400, 190);
    g.fillStyle = '#b8bcbb';
    g.fillRect(-200, -100, 400, 50);
    g.fillStyle = '#2a2a2a';
    for (let k = 0; k < 18; k++) g.fillRect(-196 + k * 22, -40, 12, 120);
    g.beginPath();
    g.fillStyle = '#0b0b0b';
    g.arc(0, 10, 92, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#7d8382';
    g.lineWidth = 10;
    g.stroke();
    g.beginPath();
    g.fillStyle = '#26323a';
    g.arc(0, 10, 54, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(160,200,255,0.25)';
    g.beginPath();
    g.arc(-16, -8, 18, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  camera(380, 900, -0.12);
  camera(2030, 1010, 0.18);
  // price tags on string
  const tag = (x, y, text, rot) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = '#f7f0dc';
    g.beginPath();
    g.moveTo(-60, -34); g.lineTo(60, -34); g.lineTo(80, 0); g.lineTo(60, 34); g.lineTo(-60, 34);
    g.closePath();
    g.fill();
    g.fillStyle = '#c21d16';
    g.font = `700 36px ${FONT.cond}`;
    g.textAlign = 'center';
    g.fillText(text, -6, 13);
    g.restore();
  };
  tag(640, 1010, '$ 88', 0.2);
  tag(1780, 880, '$ 120', -0.15);
  // the price list card under the glass
  g.save();
  g.translate(1210, 820);
  g.rotate(-0.03);
  g.fillStyle = '#f6efdc';
  g.fillRect(-330, -230, 660, 470);
  g.fillStyle = '#d22a20';
  g.fillRect(-330, -230, 660, 96);
  g.fillStyle = '#fff';
  g.font = `900 58px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('沖曬價目', 0, -162);
  g.fillStyle = '#24201c';
  g.font = `500 34px ${FONT.sign}`;
  g.textAlign = 'left';
  const rows = [['沖菲林', '$ 30'], ['4R 相片', '$ 2.5 / 張'], ['5R 放大', '$ 8 / 張'], ['證件相 4張', '$ 50'], ['過膠', '$ 10 起']];
  rows.forEach(([a, b], i) => {
    g.fillText(a, -290, -70 + i * 62);
    g.textAlign = 'right';
    g.fillText(b, 290, -70 + i * 62);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(36,32,28,0.2)';
    g.fillRect(-290, -56 + i * 62, 580, 2);
    g.fillStyle = '#24201c';
  });
  g.restore();
  // old passport photos tucked in a corner
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(2080 + (i % 2) * 120, 520 + Math.floor(i / 2) * 150);
    g.rotate((r() - 0.5) * 0.2);
    g.fillStyle = '#f2efe8';
    g.fillRect(-50, -66, 100, 132);
    g.fillStyle = '#b7c6d4';
    g.fillRect(-42, -58, 84, 110);
    g.fillStyle = '#3a3330';
    g.beginPath();
    g.ellipse(0, -14, 20, 24, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-32, 18, 64, 34);
    g.restore();
  }
  addGrain(g, W, H, 0.18);
  return canvasTexture(c);
}

function reflectionTexture() {
  const W = 1024, H = 512;
  const [c, g] = canvas(W, H);
  // two fluorescent tubes caught in the glass, long and soft
  for (const [y, a] of [[150, 0.9], [360, 0.6]]) {
    const gr = g.createLinearGradient(0, y - 26, 0, y + 26);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(80, y - 26, W - 160, 52);
  }
  const side = g.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.15, 'rgba(0,0,0,0)');
  side.addColorStop(0.85, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

/** The glass display counter. Things on it sit at y = 0. */
export function buildCounter(stage, { x = 0.3, z = 0.3, w = 11, d = 6.4 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std('#ffffff', { map: caseTexture(), roughness: 0.9 }));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = -0.32;
  inside.receiveShadow = true;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: '#d9f2ea', transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.3, depthWrite: false }));
  glass.rotation.x = -Math.PI / 2;
  glass.receiveShadow = true;
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, d * 0.9), new THREE.MeshBasicMaterial({ map: reflectionTexture(), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.003;
  // the shadow catcher: shadows land on the glass, not 30cm below it
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShadowMaterial({ opacity: 0.38 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.001;
  catcher.receiveShadow = true;
  g.add(inside, glass, sheen, catcher);
  // chrome trim round the edge and the case walls going down
  const chrome = std('#c9d0ce', { metalness: 0.95, roughness: 0.22 });
  for (const [px, pz, sx, sz] of [[0, -d / 2, w + 0.16, 0.08], [0, d / 2, w + 0.16, 0.08], [-w / 2, 0, 0.08, d], [w / 2, 0, 0.08, d]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.07, sz), chrome);
    b.position.set(px, 0.0, pz);
    g.add(b);
  }
  const wallMat = std('#0e1312', { roughness: 0.6 });
  for (const [px, pz, sx, sz] of [[0, -d / 2, w, 0.02], [0, d / 2, w, 0.02], [-w / 2, 0, 0.02, d], [w / 2, 0, 0.02, d]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.32, sz), wallMat);
    b.position.set(px, -0.16, pz);
    g.add(b);
  }
  stage.world.add(g);
  return g;
}

/* ---------- things on the counter ---------- */

export function envelope({ to = 'for you' } = {}) {
  const W = 1.7, D = 1.1;
  const [c, g] = canvas(1020, 660);
  g.fillStyle = '#ead9b6';
  g.fillRect(0, 0, 1020, 660);
  softNoise(g, 1020, 660, 3, 10, 0.25, ['#d7c09a', '#f4e8cf']);
  // airmail border
  for (let i = 0; i < 1020 + 660; i += 60) {
    g.fillStyle = (i / 60) % 2 ? '#c21d16' : '#2d4f8f';
    g.save();
    g.beginPath();
    g.rect(0, 0, 1020, 660);
    g.rect(28, 28, 964, 604);
    g.clip('evenodd');
    g.translate(i, 0);
    g.rotate(0.6);
    g.fillRect(0, -400, 30, 1600);
    g.restore();
  }
  g.fillStyle = '#ead9b6';
  g.fillRect(28, 28, 964, 604);
  // a stamp and a postmark
  g.fillStyle = '#f7f1e2';
  g.fillRect(820, 70, 120, 150);
  g.fillStyle = '#d22a20';
  g.fillRect(832, 82, 96, 126);
  g.fillStyle = '#ffd43a';
  g.font = `900 46px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('影', 880, 160);
  g.strokeStyle = 'rgba(30,30,40,0.55)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(780, 160, 62, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#2a2420';
  g.font = `400 96px ${FONT.hand}`;
  g.textAlign = 'left';
  g.fillText(to, 140, 420);
  g.font = `500 26px ${FONT.mono}`;
  g.fillStyle = 'rgba(42,36,32,0.6)';
  g.fillText('c/o FOUR ROLLS PHOTO · TO BE COLLECTED', 140, 520);
  addGrain(g, 1020, 660, 0.15);
  const m = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), [
    std('#e2cfa9'), std('#e2cfa9'), std('#ffffff', { map: canvasTexture(c), roughness: 0.85 }), std('#d8c39b'), std('#e2cfa9'), std('#e2cfa9'),
  ]);
  m.position.y = 0.011;
  return shadowed(m);
}

export function serviceBell() {
  const g = new THREE.Group();
  const chrome = std('#dfe4e2', { metalness: 1, roughness: 0.16 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.09, 40), std('#1d1d1c', { roughness: 0.4 }));
  base.position.y = 0.045;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.33, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), chrome);
  dome.position.y = 0.09;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), chrome);
  knob.position.y = 0.46;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), chrome);
  cap.position.y = 0.53;
  g.add(base, dome, knob, cap);
  g.userData.knob = [knob, cap];
  return shadowed(g);
}

/** The pad of claim tickets, the top one filled in by hand. */
export function ticketPad(name = 'for you', no = '0425') {
  const [c, g] = canvas(600, 820);
  g.fillStyle = '#fbf6e6';
  g.fillRect(0, 0, 600, 820);
  g.fillStyle = '#d22a20';
  g.fillRect(0, 0, 600, 110);
  g.fillStyle = '#fff';
  g.font = `900 52px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('取 件 單', 300, 74);
  g.fillStyle = '#d22a20';
  g.font = `600 30px ${FONT.cond}`;
  g.fillText(`No. ${no}`, 300, 160);
  g.textAlign = 'left';
  g.fillStyle = '#7d6d5d';
  g.font = `500 28px ${FONT.sign}`;
  const rows = ['姓名 NAME', '菲林 ROLLS', '沖曬 PRINTS', '取件 READY'];
  rows.forEach((t, i) => {
    g.fillText(t, 40, 250 + i * 120);
    g.fillStyle = 'rgba(125,109,93,0.4)';
    g.fillRect(40, 270 + i * 120, 520, 2);
    g.fillStyle = '#7d6d5d';
  });
  g.fillStyle = '#1f3a8a';
  g.font = `400 60px ${FONT.hand}`;
  g.fillText(name, 250, 256);
  g.fillText('4 × 24', 250, 376);
  g.fillText('4R', 250, 496);
  g.fillText('tonight', 250, 616);
  addGrain(g, 600, 820, 0.1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.23), [
    std('#efe6cf'), std('#efe6cf'), std('#ffffff', { map: canvasTexture(c), roughness: 0.9 }), std('#e3d9bf'), std('#efe6cf'), std('#efe6cf'),
  ]);
  m.position.y = 0.03;
  return shadowed(m);
}

/** The paper photo wallet the prints go home in. */
export function photoWallet() {
  const [c, g] = canvas(900, 640);
  g.fillStyle = '#f2e9d4';
  g.fillRect(0, 0, 900, 640);
  softNoise(g, 900, 640, 9, 10, 0.2, ['#e1d5b9', '#fbf4e2']);
  g.fillStyle = '#d22a20';
  g.fillRect(0, 0, 900, 150);
  g.fillStyle = '#fff';
  g.font = `900 84px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('四卷沖印', 450, 104);
  g.fillStyle = '#d22a20';
  g.font = `600 40px ${FONT.cond}`;
  g.fillText('FOUR ROLLS PHOTO · 1 HOUR', 450, 222);
  g.fillStyle = '#ffd43a';
  g.fillRect(70, 280, 760, 90);
  g.fillStyle = '#151413';
  g.font = `900 52px ${FONT.sign}`;
  g.fillText('多謝光臨  THANK YOU', 450, 342);
  g.fillStyle = '#7d6d5d';
  g.font = `500 28px ${FONT.mono}`;
  g.fillText('KEEP AWAY FROM SUNLIGHT AND DAMP', 450, 560);
  addGrain(g, 900, 640, 0.12);
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.28), [
    std('#e7dcc2'), std('#e7dcc2'), std('#ffffff', { map: canvasTexture(c), roughness: 0.85 }), std('#ded2b6'), std('#e7dcc2'), std('#e7dcc2'),
  ]);
  m.position.y = 0.04;
  return shadowed(m);
}
