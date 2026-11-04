// A desk at home, late: walnut top, one warm lamp, and a parcel that came in the post.
// Everything here is drawn on canvases; nothing is loaded from disk.

import * as THREE from 'three';
import { FONT, addGrain, canvas, canvasTexture, glowTexture, rng, softNoise } from './util.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, dithering: true, ...o });

export function shadowed(obj) {
  obj.traverse((m) => {
    if (m.isMesh) m.castShadow = m.receiveShadow = true;
  });
  return obj;
}

/* ---------- surfaces ---------- */

/** Oiled walnut planks with long grain. The table every scene sits on. */
export function walnutTexture() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  const r = rng(31);
  const planks = 4;
  const ph = S / planks;
  for (let p = 0; p < planks; p++) {
    const tone = ['#4f3727', '#583e2b', '#4a3324', '#553a29'][p];
    g.fillStyle = tone;
    g.fillRect(0, p * ph, S, ph);
    // long wavy grain running along the plank
    for (let i = 0; i < 70; i++) {
      const y0 = p * ph + r() * ph;
      const amp = 2 + r() * 7, freq = 0.004 + r() * 0.01, phase = r() * 6;
      g.strokeStyle = r() > 0.5 ? `rgba(30,18,10,${0.12 + r() * 0.2})` : `rgba(140,98,62,${0.06 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      for (let x = 0; x <= S; x += 16) {
        const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.3;
        if (x) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    // a seam between planks
    g.fillStyle = 'rgba(14,8,4,0.55)';
    g.fillRect(0, p * ph, S, 2);
  }
  softNoise(g, S, S, 8, 12, 0.12, ['#3a2618', '#6a4a33']);
  addGrain(g, S, S, 0.08);
  return canvasTexture(c, { repeat: [7, 7] });
}

/** Brown packing paper: short fibres, a little mottled. */
export function kraftTexture(w = 1024, h = 1024, seed = 5, base = '#c8ad84') {
  const [c, g] = canvas(w, h);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  softNoise(g, w, h, seed, 10, 0.25, ['#b39466', '#d9c29c']);
  const r = rng(seed + 9);
  for (let i = 0; i < (w * h) / 120; i++) {
    g.strokeStyle = r() > 0.5 ? 'rgba(90,62,32,0.18)' : 'rgba(240,226,200,0.2)';
    g.lineWidth = 0.6 + r();
    const x = r() * w, y = r() * h, a = r() * Math.PI, l = 3 + r() * 9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  addGrain(g, w, h, 0.1);
  return [c, g];
}

/* ---------- washi tape ---------- */

const TAPES = [
  { base: '#d9a9a0', ink: 'rgba(255,255,255,0.5)' },
  { base: '#9fb0c6', ink: 'rgba(255,255,255,0.45)' },
  { base: '#e2c27a', ink: 'rgba(120,80,30,0.25)' },
  { base: '#b7c2a4', ink: 'rgba(255,255,255,0.45)' },
];

function tapeTexture(k) {
  const t = TAPES[k % TAPES.length];
  const [c, g] = canvas(256, 64);
  g.fillStyle = t.base;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = t.ink;
  // a different small pattern on each roll: dots, stripes, grid, dashes
  if (k % 4 === 0) for (let x = 8; x < 256; x += 18) for (let y = 10; y < 64; y += 18) g.fillRect(x, y, 5, 5);
  if (k % 4 === 1) for (let x = -64; x < 256; x += 22) { g.save(); g.translate(x, 0); g.rotate(-0.6); g.fillRect(0, 0, 8, 120); g.restore(); }
  if (k % 4 === 2) { for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 1.5, 64); for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 256, 1.5); }
  if (k % 4 === 3) for (let x = 6; x < 256; x += 24) g.fillRect(x, 29, 12, 6);
  // torn ends
  g.globalCompositeOperation = 'destination-out';
  const r = rng(k + 2);
  for (const x0 of [0, 256]) for (let y = 0; y < 64; y += 4) g.fillRect(x0 === 0 ? 0 : 256 - r() * 6, y, r() * 6, 4);
  return canvasTexture(c);
}

/** A strip of washi tape: translucent, patterned, ends a little torn. */
export function washi(k = 0, w = 0.5) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, 0.15),
    new THREE.MeshStandardMaterial({ map: tapeTexture(k), transparent: true, opacity: 0.86, roughness: 0.55, depthWrite: false }),
  );
  m.renderOrder = 2;
  return m;
}

/* ---------- the parcel ---------- */

function lidTexture(to) {
  const W = 1400, H = 940;
  const [c, g] = kraftTexture(W, H, 12);
  // the shipping label, taped on at a slant
  g.save();
  g.translate(380, 470);
  g.rotate(-0.04);
  g.fillStyle = 'rgba(40,24,10,0.25)';
  g.fillRect(-268, -208, 548, 428);
  g.fillStyle = '#f5eedf';
  g.fillRect(-276, -216, 548, 428);
  g.fillStyle = '#2d3e5c';
  g.font = `400 30px ${FONT.type}`;
  g.fillText('TO / 寄给', -236, -150);
  g.font = `400 120px ${FONT.hand}`;
  g.fillStyle = '#1f2c46';
  g.fillText(to, -230, -36);
  g.fillStyle = 'rgba(45,62,92,0.35)';
  g.fillRect(-236, 0, 468, 3);
  g.fillStyle = '#2d3e5c';
  g.font = `400 30px ${FONT.type}`;
  g.fillText('FROM / 寄件人', -236, 70);
  g.font = `400 64px ${FONT.hand}`;
  g.fillText('four rolls, one us', -230, 140);
  g.font = `400 24px ${FONT.type}`;
  g.fillStyle = 'rgba(45,62,92,0.7)';
  g.fillText('No. 0425 · 4 × 24 EXP · 35MM', -236, 190);
  g.restore();
  // two stamps, top right
  for (const [x, y, col, rot] of [[1080, 110, '#9c3b2f', 0.05], [1220, 130, '#2d3e5c', -0.06]]) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = '#f5eedf';
    g.fillRect(-56, -70, 112, 140);
    g.fillStyle = col;
    g.fillRect(-46, -60, 92, 120);
    g.strokeStyle = '#f5eedf';
    g.lineWidth = 3;
    g.strokeRect(-36, -50, 72, 70);
    g.fillStyle = '#f5eedf';
    g.font = `400 26px ${FONT.type}`;
    g.textAlign = 'center';
    g.fillText('35mm', 0, 46);
    g.restore();
  }
  // postmark rings over the stamps
  g.strokeStyle = 'rgba(30,30,44,0.5)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(1150, 200, 70, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(1230, 180 + i * 16);
    for (let x = 1230; x < 1380; x += 10) g.lineTo(x, 180 + i * 16 + Math.sin(x * 0.08) * 5);
    g.stroke();
  }
  // a red rubber stamp: handle with care
  g.save();
  g.translate(1100, 720);
  g.rotate(-0.12);
  g.strokeStyle = 'rgba(176,52,40,0.8)';
  g.lineWidth = 6;
  g.strokeRect(-190, -70, 380, 140);
  g.fillStyle = 'rgba(176,52,40,0.8)';
  g.font = `400 52px ${FONT.type}`;
  g.textAlign = 'center';
  g.fillText('FRAGILE · 胶卷', 0, -6);
  g.font = `400 28px ${FONT.type}`;
  g.fillText('DO NOT X-RAY · 请勿 X 光', 0, 44);
  g.restore();
  addGrain(g, W, H, 0.08);
  return canvasTexture(c);
}

/**
 * A kraft box tied with string. Returns the box group with the lid and the string
 * as separate parts so the scene can untie and lift them.
 */
export function parcel({ to = 'you' } = {}) {
  const W = 3.9, D = 2.3, H = 1.08, t = 0.05;
  const g = new THREE.Group();
  const [kc] = kraftTexture(512, 512, 3);
  const kraft = std('#ffffff', { map: canvasTexture(kc), roughness: 0.92 });
  const inside = std('#a88a5e', { roughness: 0.95 });
  const part = (w, h, d, x, y, z, mat = kraft) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  part(W, t, D, 0, t / 2, 0, inside);
  part(W, H, t, 0, H / 2, D / 2 - t / 2, [kraft, kraft, kraft, kraft, kraft, inside]);
  part(W, H, t, 0, H / 2, -D / 2 + t / 2, [kraft, kraft, kraft, kraft, inside, kraft]);
  part(t, H, D - 2 * t, W / 2 - t / 2, H / 2, 0, [kraft, inside, kraft, kraft, kraft, kraft]);
  part(t, H, D - 2 * t, -W / 2 + t / 2, H / 2, 0, [inside, kraft, kraft, kraft, kraft, kraft]);
  // crumpled tissue in the bottom
  const tissue = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, D - 0.12, 24, 14), std('#efe5d3', { roughness: 1, side: THREE.DoubleSide }));
  const pos = tissue.geometry.attributes.position;
  const r = rng(8);
  for (let i = 0; i < pos.count; i++) pos.setZ(i, r() * 0.08);
  tissue.geometry.computeVertexNormals();
  tissue.rotation.x = -Math.PI / 2;
  tissue.position.y = 0.06;
  g.add(tissue);

  // the lid: a top with a short skirt that hangs over the walls
  const lid = new THREE.Group();
  const LW = W + 0.1, LD = D + 0.1, skirt = 0.32;
  const top = new THREE.Mesh(new THREE.BoxGeometry(LW, 0.06, LD), [kraft, kraft, std('#ffffff', { map: lidTexture(to), roughness: 0.9 }), inside, kraft, kraft]);
  lid.add(top);
  for (const [w, d, x, z] of [[LW, t, 0, LD / 2 - t / 2], [LW, t, 0, -LD / 2 + t / 2], [t, LD, LW / 2 - t / 2, 0], [t, LD, -LW / 2 + t / 2, 0]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, skirt, d), kraft);
    s.position.set(x, -skirt / 2, z);
    lid.add(s);
  }
  lid.position.y = H + 0.03;
  g.add(lid);

  // string tied round it, crossing over the lid, with a bow
  const twine = new THREE.Group();
  const cord = new THREE.MeshStandardMaterial({ color: '#e6d6b4', roughness: 0.85, transparent: true });
  const y = H + 0.075;
  const strand = (w, h, d, x, yy, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cord);
    m.position.set(x, yy, z);
    twine.add(m);
  };
  strand(LW + 0.04, 0.025, 0.045, 0.35, y, 0);
  strand(0.045, 0.025, LD + 0.04, 0.35, y, 0);
  strand(0.045, H + 0.1, 0.025, 0.35, y / 2, LD / 2 + 0.02);
  strand(0.045, H + 0.1, 0.025, 0.35, y / 2, -LD / 2 - 0.02);
  strand(0.025, H + 0.1, 0.045, LW / 2 + 0.02, y / 2, 0);
  strand(0.025, H + 0.1, 0.045, -LW / 2 - 0.02, y / 2, 0);
  const bow = [];
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 24), cord);
    loop.rotation.x = Math.PI / 2;
    loop.scale.set(1.3, 0.75, 1);
    loop.position.set(0.35 + s * 0.2, y + 0.03, 0);
    loop.rotation.z = s * 0.35;
    twine.add(loop);
    bow.push(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.42), cord);
    tail.position.set(0.35 + s * 0.12, y + 0.01, 0.24);
    tail.rotation.y = s * 0.5;
    twine.add(tail);
    bow.push(tail);
  }
  g.add(twine);
  shadowed(g);
  return { group: g, lid, twine, bow, cord, W, D, H };
}

/* ---------- the letter's envelope ---------- */

export function envelope({ to = 'for you' } = {}) {
  const W = 1.7, D = 1.1;
  const [c, g] = canvas(1020, 660);
  g.fillStyle = '#efe4cc';
  g.fillRect(0, 0, 1020, 660);
  softNoise(g, 1020, 660, 3, 10, 0.2, ['#e2d3b4', '#f7eedb']);
  // airmail border
  for (let i = 0; i < 1020 + 660; i += 60) {
    g.fillStyle = (i / 60) % 2 ? '#a8443a' : '#2d3e5c';
    g.save();
    g.beginPath();
    g.rect(0, 0, 1020, 660);
    g.rect(26, 26, 968, 608);
    g.clip('evenodd');
    g.translate(i, 0);
    g.rotate(0.6);
    g.fillRect(0, -400, 30, 1600);
    g.restore();
  }
  g.fillStyle = '#efe4cc';
  g.fillRect(26, 26, 968, 608);
  // a wax seal and the name
  g.fillStyle = '#8e2b24';
  g.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    const rr = 62 + Math.sin(a * 5) * 5;
    g.lineTo(830 + Math.cos(a) * rr, 150 + Math.sin(a) * rr);
  }
  g.fill();
  g.strokeStyle = 'rgba(255,220,200,0.35)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(830, 150, 38, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255,225,210,0.7)';
  g.font = `400 40px ${FONT.hand}`;
  g.textAlign = 'center';
  g.fillText('us', 830, 164);
  g.fillStyle = '#2a2420';
  g.font = `400 104px ${FONT.hand}`;
  g.textAlign = 'left';
  g.fillText(to, 130, 410);
  g.font = `400 26px ${FONT.type}`;
  g.fillStyle = 'rgba(42,36,32,0.6)';
  g.fillText('open this one first', 136, 500);
  addGrain(g, 1020, 660, 0.12);
  const m = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), [
    std('#e8dcc0'), std('#e8dcc0'), std('#ffffff', { map: canvasTexture(c), roughness: 0.85 }), std('#ddd0b2'), std('#e8dcc0'), std('#e8dcc0'),
  ]);
  m.position.y = 0.011;
  return shadowed(m);
}

/* ---------- things on the desk ---------- */

function rod(a, b, radius, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 14), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/**
 * The desk lamp: base in the back-left corner, head leaning over the middle.
 * Returns the lamp and where its light comes from, so the scene can aim the key light.
 */
export function deskLamp({ base = [-5.2, 0, -2.9], elbow = [-4.9, 3.1, -3.2], head = [-3.6, 3.5, -2.1], aim = [0.3, 0, 0.4] } = {}) {
  const g = new THREE.Group();
  const enamel = std('#2f3d35', { roughness: 0.38, metalness: 0.35 });
  const brass = std('#b8925a', { roughness: 0.3, metalness: 0.9 });
  const B = new THREE.Vector3(...base), E = new THREE.Vector3(...elbow), Hd = new THREE.Vector3(...head), A = new THREE.Vector3(...aim);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.14, 40), enamel);
  foot.position.copy(B).setY(0.07);
  g.add(foot);
  g.add(rod(B.clone().setY(0.14), E, 0.055, enamel), rod(E, Hd, 0.05, enamel));
  for (const p of [E, Hd]) {
    const j = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), brass);
    j.position.copy(p);
    g.add(j);
  }
  const dir = A.clone().sub(Hd).normalize();
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.9, 40, 1, true), std('#2f3d35', { roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide }));
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  shade.position.copy(Hd).addScaledVector(dir, 0.32);
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd79a').multiplyScalar(2.2), toneMapped: false }));
  bulb.position.copy(Hd).addScaledVector(dir, 0.6);
  g.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc77a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(2.4);
  halo.position.copy(bulb.position);
  g.add(halo);
  shadowed(g);
  bulb.castShadow = halo.castShadow = shade.castShadow = false;
  return { lamp: g, from: Hd.clone().addScaledVector(dir, 0.75), aim: A };
}

export function mug() {
  const g = new THREE.Group();
  const glaze = std('#e9e1d2', { roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.95, 40, 1, true), glaze);
  body.position.y = 0.475;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.38, 40), glaze);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.02;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.4, 40), std('#4a2a16', { roughness: 0.1 }));
  tea.rotation.x = -Math.PI / 2;
  tea.position.y = 0.78;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 10, 24, Math.PI), glaze);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.42, 0.5, 0);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.42, 0.1, 40, 1, true), std('#2d3e5c', { roughness: 0.3 }));
  band.position.y = 0.75;
  g.add(body, bottom, tea, handle, band);
  return shadowed(g);
}

/** A roll of washi tape lying on its side. */
export function tapeRoll(k = 0) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 40, 1, true), std(TAPES[k].base, { roughness: 0.5, side: THREE.DoubleSide }));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 30, 1, true), std('#d8c6a2', { roughness: 0.9, side: THREE.DoubleSide }));
  const face = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.36, 40), std(TAPES[k].base, { roughness: 0.6 }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.091;
  g.add(ring, core, face);
  g.position.y = 0.09;
  return shadowed(g);
}

function notebookTexture() {
  const [c, g] = canvas(700, 940);
  g.fillStyle = '#2d3e5c';
  g.fillRect(0, 0, 700, 940);
  softNoise(g, 700, 940, 4, 9, 0.2, ['#24324b', '#3a4d6e']);
  // cloth weave
  g.globalAlpha = 0.07;
  g.fillStyle = '#fff';
  for (let x = 0; x < 700; x += 4) g.fillRect(x, 0, 1, 940);
  for (let y = 0; y < 940; y += 4) g.fillRect(0, y, 700, 1);
  g.globalAlpha = 1;
  g.fillStyle = '#f2ead9';
  g.fillRect(150, 300, 400, 230);
  g.strokeStyle = 'rgba(45,62,92,0.5)';
  g.lineWidth = 3;
  g.strokeRect(166, 316, 368, 198);
  g.fillStyle = '#2d3e5c';
  g.textAlign = 'center';
  g.font = `400 30px ${FONT.type}`;
  g.fillText('寄件人 · SENDER', 350, 380);
  g.font = `400 76px ${FONT.hand}`;
  g.fillText('notes', 350, 470);
  g.fillStyle = '#a8443a';
  g.fillRect(560, 0, 30, 940);
  addGrain(g, 700, 940, 0.1);
  return canvasTexture(c);
}

/** The sender's notebook: where the parcel's contents get set up (opens edit.html). */
export function notebook() {
  const cover = std('#ffffff', { map: notebookTexture(), roughness: 0.8 });
  const edge = std('#f1e8d4', { roughness: 0.9 });
  const blue = std('#2d3e5c', { roughness: 0.8 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.88), [edge, blue, cover, blue, edge, edge]);
  m.position.y = 0.08;
  return shadowed(m);
}

/** The kraft envelope the prints are kept in at the end. */
export function printEnvelope(title = 'still us') {
  const [c, g] = kraftTexture(900, 640, 21, '#c9a978');
  g.fillStyle = 'rgba(80,52,24,0.18)';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(450, 250);
  g.lineTo(900, 0);
  g.fill();
  g.fillStyle = '#2a2018';
  g.font = `400 120px ${FONT.hand}`;
  g.textAlign = 'center';
  g.fillText(title, 450, 430);
  g.font = `400 30px ${FONT.type}`;
  g.fillStyle = 'rgba(42,32,24,0.7)';
  g.fillText('4R PRINTS · KEEP DRY · KEEP', 450, 520);
  // the button-and-string closure
  g.fillStyle = '#8e2b24';
  g.beginPath();
  g.arc(450, 250, 30, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#efe2c4';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(450, 250);
  g.bezierCurveTo(520, 300, 380, 340, 470, 380);
  g.stroke();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 1.28), [
    std('#bfa071'), std('#bfa071'), std('#ffffff', { map: canvasTexture(c), roughness: 0.9 }), std('#b29466'), std('#bfa071'), std('#bfa071'),
  ]);
  m.position.y = 0.035;
  return shadowed(m);
}

/** The lamp, the mug and the tape: what is always on the desk. */
export function buildDesk(stage, { lampAim = [0.3, 0, 0.4] } = {}) {
  const { lamp, from, aim } = deskLamp({ aim: lampAim });
  stage.world.add(lamp);
  // one warm lamp over the desk, the room dark around it
  stage.light({ pos: from.toArray(), target: aim.toArray(), intensity: 70, angle: 0.95, hemi: 0.22 });
  stage.key.color.set('#ffd29a');
  stage.key.penumbra = 0.9;
  const fill = new THREE.PointLight('#ffb466', 3.5, 9, 1.8);
  fill.position.copy(from);
  stage.world.add(fill);
  const cup = mug();
  cup.position.set(-1.4, 0, -2.75);
  stage.world.add(cup);
  const tape = tapeRoll(0);
  tape.position.set(4.65, 0.09, -1.95);
  stage.world.add(tape);
  const tape2 = tapeRoll(1);
  tape2.position.set(4.05, 0.09, -2.5);
  stage.world.add(tape2);
  return { lamp, cup };
}
