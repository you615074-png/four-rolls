import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { FONT, addGrain, canvas, canvasTexture, cardTexture } from './util.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, dithering: true, ...o });

function shadowed(obj) {
  obj.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return obj;
}

/* ---------- film canister ---------- */

export const CAN = { r: 0.46, h: 1.72 };

function labelTexture(roll) {
  const [c, g] = canvas(2048, 1024);
  g.scale(2, 2);
  const { paper, ink, line } = roll.label;
  g.fillStyle = paper;
  g.fillRect(0, 0, 1024, 512);
  addGrain(g, 2048, 1024, 0.1);
  g.strokeStyle = line;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 22); g.lineTo(1024, 22);
  g.moveTo(0, 490); g.lineTo(1024, 490);
  g.stroke();
  // u = 0.5 faces the viewer; text runs along the height of the can
  g.save();
  g.translate(512, 256);
  g.rotate(Math.PI / 2);
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.font = `italic 128px ${FONT.serif}`;
  g.fillText(roll.name, 0, 34);
  g.font = `500 22px ${FONT.mono}`;
  g.globalAlpha = 0.8;
  g.fillText(`ROLL ${roll.no}  ·  ISO 400  ·  24 EXP`, 0, 96);
  g.restore();
  g.save();
  g.translate(390, 256);
  g.rotate(Math.PI / 2);
  g.fillStyle = ink;
  g.globalAlpha = 0.55;
  g.textAlign = 'center';
  g.font = `500 18px ${FONT.mono}`;
  g.fillText('DEVELOP BEFORE · KEEP COOL', 0, 0);
  g.restore();
  return canvasTexture(c);
}

export function canister(roll) {
  const g = new THREE.Group();
  const { r, h } = CAN;
  const metal = std('#2b211c', { metalness: 0.55, roughness: 0.38 });
  const brass = std('#9d7a4c', { metalness: 0.7, roughness: 0.32 });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h - 0.26, 64, 1, true, Math.PI),
    std('#ffffff', { map: labelTexture(roll), roughness: 0.72 }),
  );
  body.position.y = h / 2;
  g.add(body);
  for (const y of [0.07, h - 0.07]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.14, 64), metal);
    cap.position.y = y;
    g.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.025, 0.012, 8, 64), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y > 1 ? y - 0.075 : y + 0.075;
    g.add(ring);
  }
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 24), metal);
  spool.position.y = h + 0.09;
  g.add(spool);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 24), metal);
  knob.position.y = h + 0.18;
  g.add(knob);
  // a tab on the winding knob, so you can see the spool turn
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.24), metal);
  tab.position.y = 0.045;
  knob.add(tab);
  // the spool and its knob turn inside; the shell, its label and the mouth stay put
  g.userData.spool = [spool, knob];
  // the felt-lipped mouth the film comes out of
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.1, h - 0.4, 0.08), std('#141010'));
  lip.position.set(r - 0.01, h / 2, -0.02);
  g.add(lip);
  return shadowed(g);
}

/* ---------- film strip ---------- */

export const FILM = { pitch: 1.0, height: 1.5, imgW: 0.8, imgH: 1.06 };

let stripTex;
export function stripTexture() {
  if (stripTex) return stripTex;
  const W = 256, H = 384;
  const [c, g] = canvas(W * 2, H * 2);
  g.scale(2, 2);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#b4501d');
  grad.addColorStop(0.5, '#c86428');
  grad.addColorStop(1, '#ab4a1b');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // frame window edge
  const iw = (FILM.imgW / FILM.pitch) * W, ih = (FILM.imgH / FILM.height) * H;
  g.fillStyle = '#5a1f0b';
  g.fillRect((W - iw) / 2 - 3, (H - ih) / 2 - 3, iw + 6, ih + 6);
  // sprocket holes (transparent)
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * 42;
    for (const y of [12, H - 36]) {
      g.clearRect(x, y, 22, 24);
    }
  }
  g.fillStyle = 'rgba(255,214,140,0.75)';
  g.font = `500 11px ${FONT.mono}`;
  g.fillText('ULIAS 400', 18, 58);
  g.fillText('▸ 400', 160, H - 48);
  stripTex = canvasTexture(c);
  return stripTex;
}

export function stripSegment() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(FILM.pitch * 1.002, FILM.height),
    std('#ffffff', { map: stripTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4 }),
  );
  m.castShadow = true;
  return m;
}

/* ---------- pens ---------- */

export function pen(kind) {
  const g = new THREE.Group();
  const spec = {
    red: { body: '#1b1515', cap: '#c8221a', len: 1.5, r: 0.06 },
    white: { body: '#efe9df', cap: '#c8221a', len: 1.45, r: 0.065 },
    pencil: { body: '#d9b13c', cap: '#2b2420', len: 1.6, r: 0.045 },
  }[kind];
  const body = new THREE.Mesh(new THREE.CylinderGeometry(spec.r, spec.r, spec.len, kind === 'pencil' ? 6 : 24), std(spec.body, { roughness: 0.4 }));
  g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(spec.r * 1.06, spec.r * 1.06, spec.len * 0.28, 24), std(spec.cap, { roughness: 0.35 }));
  cap.position.y = spec.len * 0.36;
  g.add(cap);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(spec.r, spec.r * 3.5, kind === 'pencil' ? 6 : 24),
    std(kind === 'pencil' ? '#e9cfa4' : '#1b1515'),
  );
  tip.rotation.x = Math.PI;
  tip.position.y = -spec.len / 2 - spec.r * 1.75;
  g.add(tip);
  return shadowed(g);
}

/* ---------- darkroom ---------- */

export function tray() {
  const g = new THREE.Group();
  const metal = std('#8b8178', { metalness: 0.65, roughness: 0.33 });
  const W = 3.3, D = 2.3, H = 0.32, t = 0.06;
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, 0.06, D, 3, 0.03), metal);
  base.position.y = 0.03;
  g.add(base);
  for (const [w, d, x, z] of [[W, t, 0, D / 2], [W, t, 0, -D / 2], [t, D, W / 2, 0], [t, D, -W / 2, 0]]) {
    const wall = new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 2, 0.025), metal);
    wall.position.set(x, H / 2, z);
    g.add(wall);
  }
  const liquid = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.1, D - 0.1),
    std('#3e2a1c', { roughness: 0.14, metalness: 0.3 }),
  );
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = 0.2;
  liquid.receiveShadow = true;
  g.add(liquid);
  // bamboo tongs with a red tip
  const tongs = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.09), std('#d7b47a'));
  tongs.add(stick);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), std('#c42a1e'));
  tip.position.x = -0.64;
  tongs.add(tip);
  tongs.position.set(1.15, 0.36, 0.95);
  tongs.rotation.set(0, 0.6, -0.12);
  g.add(tongs);
  shadowed(g);
  liquid.castShadow = false;
  return { group: g, liquid, liquidY: 0.21 };
}

export function bottle(text, color = '#1d2a22') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.82, 40), std(color, { roughness: 0.25, metalness: 0.1 }));
  body.position.y = 0.41;
  g.add(body);
  const lab = cardTexture({
    w: 512, h: 160, bg: '#e9dfc7',
    lines: [{ text, font: `italic 64px ${FONT.serif}`, x: 256, y: 104, align: 'center', color: '#2d241c' }],
  });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.32, 40, 1, true, -Math.PI * 0.5, Math.PI), std('#fff', { map: lab, roughness: 0.8 }));
  label.position.y = 0.42;
  g.add(label);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.12, 30), std(color, { roughness: 0.25 }));
  neck.position.y = 0.88;
  g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 30), std('#141212', { roughness: 0.5 }));
  cap.position.y = 1.0;
  g.add(cap);
  const nub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), std('#141212'));
  nub.position.y = 1.1;
  g.add(nub);
  return shadowed(g);
}

export function paperStack(label) {
  const g = new THREE.Group();
  const tex = cardTexture({
    w: 512, h: 384, bg: '#efe4c8',
    lines: [{ text: label, font: `46px ${FONT.hand}`, x: 120, y: 200, color: '#5a4636', rot: -0.06 }],
  });
  const mats = [std('#e6dabd'), std('#e6dabd'), std('#fff', { map: tex, roughness: 0.9 }), std('#e6dabd'), std('#e6dabd'), std('#e6dabd')];
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.86), mats);
  box.position.y = 0.05;
  g.add(box);
  return shadowed(g);
}

export function clothesline(width = 9) {
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, width, 6), std('#7d2a22', { roughness: 0.8 }));
  line.rotation.z = Math.PI / 2;
  return line;
}

export function clip() {
  const g = new THREE.Group();
  const wood = std('#c49a63', { roughness: 0.7 });
  for (const z of [-0.018, 0.018]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.03), wood);
    p.position.z = z;
    g.add(p);
  }
  const spring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), std('#9a9a9a', { metalness: 0.8, roughness: 0.3 }));
  spring.position.y = 0.02;
  spring.rotation.y = Math.PI / 2;
  g.add(spring);
  return shadowed(g);
}

export function loupe() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.42, 1.0, 4, 0.12), std('#3b2b26', { roughness: 0.42, metalness: 0.1 }));
  body.position.y = 0.21;
  g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.16, 40), std('#1a1412', { roughness: 0.3, metalness: 0.4 }));
  barrel.position.y = 0.49;
  g.add(barrel);
  const lensGeo = new THREE.CircleGeometry(0.27, 40);
  lensGeo.rotateX(-Math.PI / 2);
  const lens = new THREE.Mesh(lensGeo, std('#0e0c0b', { roughness: 0.05, metalness: 0.6 }));
  lens.position.y = 0.575;
  g.add(lens);
  shadowed(g);
  return { group: g, lens };
}

export function slideViewer() {
  const g = new THREE.Group();
  const green = std('#1f3a2a', { roughness: 0.38, metalness: 0.15 });
  const brass = std('#b08a52', { roughness: 0.3, metalness: 0.7 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.72, 0.95, 4, 0.12), green);
  body.position.y = 0.98;
  g.add(body);
  const screenW = 1.0, screenH = 1.18, sy = 1.08, sz = 0.48;
  for (const [w, h, x, y] of [
    [screenW + 0.12, 0.06, 0, sy + screenH / 2 + 0.03], [screenW + 0.12, 0.06, 0, sy - screenH / 2 - 0.03],
    [0.06, screenH + 0.12, screenW / 2 + 0.03, sy], [0.06, screenH + 0.12, -screenW / 2 - 0.03, sy],
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), brass);
    b.position.set(x, y, sz);
    g.add(b);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.03), brass);
  plate.position.set(0, 0.3, sz);
  g.add(plate);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.12, 1.0, 2, 0.04), green);
  foot.position.y = 0.06;
  g.add(foot);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH));
  screen.position.set(0, sy, sz + 0.005);
  g.add(screen);
  // lever on the right side with a red knob
  const lever = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12), brass);
  arm.rotation.z = Math.PI / 2;
  arm.position.x = 0.18;
  lever.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), std('#c7231b', { roughness: 0.25, metalness: 0.1 }));
  knob.position.x = 0.38;
  lever.add(knob);
  lever.position.set(0.75, 1.45, 0.2);
  g.add(lever);
  shadowed(g);
  return { group: g, screen, lever };
}

export function lightBox() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(4.6, 0.22, 3.2, 3, 0.06), std('#1b1615', { roughness: 0.5 }));
  frame.position.y = 0.11;
  g.add(frame);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.9), new THREE.MeshBasicMaterial({ color: '#fff8ec', toneMapped: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.225;
  g.add(glow);
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.1), std('#0b0909'));
  sw.position.set(1.8, 0.12, 1.62);
  g.add(sw);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.3, 0.08, -0.8), new THREE.Vector3(-3.0, 0.03, -1.4), new THREE.Vector3(-3.6, 0.03, -2.6), new THREE.Vector3(-3.2, 0.03, -4),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.03, 8), std('#0d0b0b', { roughness: 0.4 }));
  g.add(cable);
  shadowed(g);
  glow.castShadow = false;
  const light = new THREE.PointLight('#fff2dc', 6, 6, 1.6);
  light.position.set(0, 1.1, 0);
  g.add(light);
  return { group: g, topY: 0.226 };
}

export function pushpin(color = '#c3261b') {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), std(color, { roughness: 0.25 }));
  head.position.z = 0.08;
  g.add(head);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), std('#bbb', { metalness: 0.9, roughness: 0.2 }));
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.03;
  g.add(pin);
  return shadowed(g);
}
