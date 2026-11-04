import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { FONT, addGrain, canvas, canvasTexture, cardTexture, glowTexture, rng } from './util.js';

/*
 * The wet side of the darkroom: a tiled wall with a safelight, a bench with
 * three trays, a box of paper, bottles, a timer and a line to hang prints on.
 * Everything here is built from canvas textures and simple geometry.
 */

export const SET = { wallZ: -5.25, lineY: 3.05, lineZ: -4.6, benchY: 0 };

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, dithering: true, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0, dithering: true, ...o });

function shade(obj, cast = true, receive = true) {
  obj.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
  return obj;
}

/* ---------- reflections: a tiny dark room lit by a red safelight ---------- */

function environment(renderer) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: '#0b0605', side: THREE.BackSide })));
  const red = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.7, 0.25) }));
  red.position.set(-4, 3, -9.5);
  room.add(red);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.75, 0.6) }));
  warm.position.set(0, 4.9, 0);
  warm.rotation.x = Math.PI / 2;
  room.add(warm);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.03).texture;
  pm.dispose();
  return env;
}

/* ---------- surfaces ---------- */

function benchTextures() {
  const W = 2048, H = 1024;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#2b2522';
  g.fillRect(0, 0, W, H);
  const r = rng(77);
  // worn laminate: long soft streaks, a few chemical stains
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '60,50,44' : '18,14,12'},${0.05 + r() * 0.08})`;
    g.fillRect(r() * W, r() * H, 80 + r() * 600, 1 + r() * 3);
  }
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = r() * H, rad = 30 + r() * 120;
    const grd = g.createRadialGradient(x, y, rad * 0.6, x, y, rad);
    grd.addColorStop(0, 'rgba(70,52,30,0)');
    grd.addColorStop(0.85, 'rgba(70,52,30,0.18)');
    grd.addColorStop(1, 'rgba(70,52,30,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  addGrain(g, W, H, 0.18);
  // roughness: dry laminate, with a few wet puddles that shine
  const [rc, rg] = canvas(1024, 512);
  rg.fillStyle = '#a8a8a8';
  rg.fillRect(0, 0, 1024, 512);
  const rr = rng(91);
  for (let i = 0; i < 22; i++) {
    const x = rr() * 1024, y = rr() * 512, rad = 10 + rr() * 60;
    rg.fillStyle = '#1c1c1c';
    rg.beginPath();
    rg.ellipse(x, y, rad, rad * (0.5 + rr() * 0.5), rr() * 3, 0, Math.PI * 2);
    rg.fill();
  }
  const map = canvasTexture(c);
  const rough = canvasTexture(rc, { srgb: false });
  return { map, rough };
}

function tileTextures() {
  const W = 1024, H = 256, cols = 16, rows = 4;
  const [c, g] = canvas(W, H);
  const [bc, bg] = canvas(W, H);
  const r = rng(5);
  g.fillStyle = '#3d3a35';
  g.fillRect(0, 0, W, H);
  bg.fillStyle = '#000';
  bg.fillRect(0, 0, W, H);
  const tw = W / cols, th = H / rows, grout = 4;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = 128 + (r() - 0.5) * 18;
      g.fillStyle = `rgb(${v + 10},${v + 8},${v})`;
      g.fillRect(x * tw + grout / 2, y * th + grout / 2, tw - grout, th - grout);
      // a soft sheen across each glazed tile
      const grd = g.createLinearGradient(x * tw, y * th, x * tw + tw, y * th + th);
      grd.addColorStop(0, 'rgba(255,255,255,0.06)');
      grd.addColorStop(1, 'rgba(0,0,0,0.08)');
      g.fillStyle = grd;
      g.fillRect(x * tw + grout / 2, y * th + grout / 2, tw - grout, th - grout);
      bg.fillStyle = '#fff';
      bg.fillRect(x * tw + grout / 2 + 1, y * th + grout / 2 + 1, tw - grout - 2, th - grout - 2);
    }
  }
  addGrain(g, W, H, 0.1);
  const map = canvasTexture(c, { repeat: [1, 1] });
  const bump = canvasTexture(bc, { srgb: false, repeat: [1, 1] });
  return { map, bump };
}

function paintTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#1e1917';
  g.fillRect(0, 0, 512, 512);
  addGrain(g, 512, 512, 0.25);
  return canvasTexture(c, { repeat: [6, 3] });
}

/* ---------- props ---------- */

/** A plastic developing tray: rim, ribbed floor, and a clear bath that reflects. */
export function plasticTray(color, { W = 3.3, D = 2.3, H = 0.3 } = {}) {
  const g = new THREE.Group();
  const plastic = phys(color, { roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, 0.05, D, 3, 0.024), plastic);
  base.position.y = 0.025;
  g.add(base);
  const t = 0.07;
  for (const [w, d, x, z] of [[W, t, 0, D / 2 - t / 2], [W, t, 0, -D / 2 + t / 2], [t, D, W / 2 - t / 2, 0], [t, D, -W / 2 + t / 2, 0]]) {
    const wall = new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 2, 0.03), plastic);
    wall.position.set(x, H / 2, z);
    g.add(wall);
    const lip = new THREE.Mesh(new RoundedBoxGeometry(w + (w > d ? 0.08 : 0.06), 0.035, d + (d > w ? 0.08 : 0.06), 2, 0.016), plastic);
    lip.position.set(x * 1.02, H, z * 1.02);
    g.add(lip);
  }
  for (let k = 0; k < 5; k++) {
    const rib = new THREE.Mesh(new RoundedBoxGeometry(W - 0.5, 0.025, 0.05, 1, 0.01), plastic);
    rib.position.set(0, 0.06, -D / 2 + 0.4 + k * ((D - 0.8) / 4));
    g.add(rib);
  }
  shade(g);
  const liquidY = 0.215;
  const liquid = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.15, D - 0.15, 24, 16),
    phys('#8a6a4a', { transparent: true, opacity: 0.38, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, depthWrite: false }),
  );
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = liquidY;
  liquid.renderOrder = 2;
  g.add(liquid);
  return { group: g, liquid, liquidY, floorY: 0.075 };
}

function tongs(tip = '#c42a1e') {
  const g = new THREE.Group();
  const bamboo = std('#cfae74', { roughness: 0.55 });
  for (const z of [-0.035, 0.035]) {
    const s = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.035, 0.06, 1, 0.012), bamboo);
    s.position.z = z;
    s.rotation.y = z * 1.1;
    g.add(s);
    const t = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.075, 1, 0.02), std(tip, { roughness: 0.5 }));
    t.position.set(-0.6, 0, z - z * 0.66);
    g.add(t);
  }
  return shade(g);
}

function thermometer() {
  const g = new THREE.Group();
  const glass = phys('#ffffff', { transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, envMapIntensity: 2 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.3, 12), glass);
  tube.rotation.z = Math.PI / 2;
  g.add(tube);
  const mercury = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 8), std('#c41d12', { roughness: 0.3 }));
  mercury.rotation.z = Math.PI / 2;
  mercury.position.x = 0.2;
  g.add(mercury);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), std('#c41d12', { roughness: 0.25 }));
  bulb.position.x = 0.65;
  g.add(bulb);
  return shade(g, true, false);
}

/** Brown glass chemical bottle with a taped, handwritten label. */
function amberBottle(text, sub, h = 0.95) {
  const g = new THREE.Group();
  const glass = phys('#4a2008', { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, h, 40), glass);
  body.position.y = h / 2;
  g.add(body);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.28, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  shoulder.position.y = h;
  shoulder.scale.y = 0.5;
  g.add(shoulder);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 24), glass);
  neck.position.y = h + 0.2;
  g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 24), std('#121010', { roughness: 0.45 }));
  cap.position.y = h + 0.33;
  g.add(cap);
  const lab = cardTexture({ w: 512, h: 220, bg: '#e8dfc9', lines: [
    { text, font: `78px ${FONT.hand}`, x: 256, y: 120, align: 'center', color: '#2d241c', rot: -0.03 },
    { text: sub, font: `500 22px ${FONT.mono}`, x: 256, y: 182, align: 'center', color: '#6b5b4b' },
  ] });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.284, 0.284, 0.36, 40, 1, true, -Math.PI * 0.45, Math.PI * 0.9), std('#fff', { map: lab, roughness: 0.85 }));
  label.position.y = h * 0.48;
  g.add(label);
  return shade(g);
}

function graduate() {
  const g = new THREE.Group();
  const glass = phys('#ffffff', { transparent: true, opacity: 0.22, roughness: 0.04, clearcoat: 1, envMapIntensity: 2, depthWrite: false, side: THREE.DoubleSide });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.75, 32, 1, true), glass);
  cup.position.y = 0.375;
  g.add(cup);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 32), glass);
  bottom.position.y = 0.02;
  g.add(bottom);
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.4, 32), phys('#b07a3c', { transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }));
  fill.position.y = 0.22;
  g.add(fill);
  const marks = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.6, 32, 1, true, -0.6, 1.2), new THREE.MeshBasicMaterial({ map: (() => {
    const [c, gg] = canvas(256, 512);
    gg.strokeStyle = 'rgba(255,245,230,0.7)';
    gg.fillStyle = 'rgba(255,245,230,0.7)';
    gg.font = `500 26px ${FONT.mono}`;
    for (let k = 0; k <= 10; k++) {
      const y = 480 - k * 44;
      gg.fillRect(20, y, k % 5 ? 40 : 80, 3);
      if (k % 5 === 0) gg.fillText(`${k * 50}`, 110, y + 9);
    }
    return canvasTexture(c);
  })(), transparent: true, depthWrite: false }));
  marks.position.y = 0.4;
  g.add(marks);
  return g;
}

/** An open box of photographic paper, the lid set down beside it. */
function paperBox() {
  const g = new THREE.Group();
  const black = std('#151313', { roughness: 0.55 });
  const W = 1.25, D = 0.95, H = 0.2, t = 0.025;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, t, D), black);
  floor.position.y = t / 2;
  g.add(floor);
  for (const [w, d, x, z] of [[W, t, 0, D / 2], [W, t, 0, -D / 2], [t, D, W / 2, 0], [t, D, -W / 2, 0]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), black);
    wall.position.set(x, H / 2, z);
    g.add(wall);
  }
  const sheets = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.1, D - 0.1), std('#ece6da', { roughness: 0.4 }));
  sheets.position.y = 0.08;
  g.add(sheets);
  // the top sheet, which lifts when you reach for it
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.006, D - 0.12), std('#f4efe4', { roughness: 0.3 }));
  sheet.position.y = 0.135;
  sheet.userData.rest = 0.205;
  g.add(sheet);
  const lidMap = cardTexture({ w: 640, h: 480, bg: '#1a1717', lines: [
    { text: 'PHOTOGRAPHIC PAPER', font: `500 30px ${FONT.mono}`, x: 44, y: 90, color: '#e9dfcf' },
    { text: 'RC · GLOSSY · 13 × 18 cm', font: `500 22px ${FONT.mono}`, x: 44, y: 130, color: '#b9ad9c' },
    { text: 'open only in safelight', font: `italic 34px ${FONT.serif}`, x: 44, y: 400, color: '#d4442f' },
    { text: 'ours · keep for the good ones', font: `40px ${FONT.hand}`, x: 44, y: 270, color: '#e2b24a', rot: -0.05 },
  ] });
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W + 0.05, 0.07, D + 0.05, 2, 0.015), [black, black, std('#fff', { map: lidMap, roughness: 0.5 }), black, black, black]);
  // the box sits on its own lid, turned a little, label still readable
  lid.position.set(0.12, 0.035, 0.1);
  lid.rotation.y = -0.16;
  for (const m of g.children) m.position.y += 0.07;
  g.add(lid);
  shade(g);
  g.userData.sheet = sheet;
  return g;
}

/** A darkroom timer with a luminous dial; `set(seconds)` turns its sweep hand. */
function timer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.0, 0.28, 4, 0.1), std('#1b1a19', { roughness: 0.4, metalness: 0.2 }));
  g.add(body);
  const [c, gg] = canvas(512, 512);
  gg.fillStyle = '#0d0f0d';
  gg.fillRect(0, 0, 512, 512);
  gg.translate(256, 256);
  gg.strokeStyle = '#bff0a6';
  gg.fillStyle = '#bff0a6';
  gg.shadowColor = '#9fe98a';
  gg.shadowBlur = 8;
  for (let k = 0; k < 60; k++) {
    gg.save();
    gg.rotate((k / 60) * Math.PI * 2);
    gg.lineWidth = k % 5 ? 3 : 7;
    gg.beginPath();
    gg.moveTo(0, -220);
    gg.lineTo(0, k % 5 ? -200 : -180);
    gg.stroke();
    gg.restore();
  }
  gg.font = `500 34px ${FONT.mono}`;
  gg.textAlign = 'center';
  gg.textBaseline = 'middle';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    gg.fillText(String(k * 5), Math.sin(a) * 148, -Math.cos(a) * 148);
  }
  gg.shadowBlur = 0;
  gg.fillStyle = '#7c8a76';
  gg.font = `500 18px ${FONT.mono}`;
  gg.fillText('SECONDS', 0, 70);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ map: canvasTexture(c), color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: false }));
  face.position.z = 0.142;
  g.add(face);
  const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.38), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.4, 0.2), toneMapped: false }));
  hand.geometry.translate(0, 0.15, 0);
  hand.position.z = 0.146;
  g.add(hand);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), std('#2a2a2a'));
  hub.position.z = 0.148;
  g.add(hub);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.44, 48), phys('#ffffff', { transparent: true, opacity: 0.12, roughness: 0.02, clearcoat: 1, envMapIntensity: 2, depthWrite: false }));
  glass.position.z = 0.152;
  g.add(glass);
  shade(body);
  return { group: g, set: (sec) => (hand.rotation.z = -(sec / 60) * Math.PI * 2) };
}

function safelight() {
  const g = new THREE.Group();
  const metal = std('#2a2523', { roughness: 0.45, metalness: 0.5 });
  const housing = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.62, 0.34, 3, 0.05), metal);
  g.add(housing);
  const filter = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.32, 0.12), toneMapped: false }));
  filter.position.z = 0.172;
  g.add(filter);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.24), metal);
  hood.position.set(0, 0.33, 0.24);
  g.add(hood);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff3a1c', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.set(2.6, 2.0, 1);
  halo.position.z = 0.25;
  g.add(halo);
  const light = new THREE.PointLight('#ff3214', 30, 16, 1.3);
  light.position.z = 0.6;
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.002;
  light.shadow.radius = 4;
  g.add(light);
  shade(housing);
  return { group: g, light, halo };
}

/* ---------- the whole corner ---------- */

export function buildDarkroom(stage) {
  const W = stage.world;
  stage.table.visible = false;
  const env = environment(stage.renderer);
  stage.scene.environment = env;
  const prevFog = stage.scene.fog.color.getHex();
  stage.scene.fog.color.set('#0a0302');
  stage.scene.background.set('#0a0302');

  // bench
  const bt = benchTextures();
  const bench = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), std('#ffffff', { map: bt.map, roughnessMap: bt.rough, roughness: 1, metalness: 0.05, envMapIntensity: 0.9 }));
  bench.rotation.x = -Math.PI / 2;
  bench.position.set(0, 0, SET.wallZ + 4.5);
  bench.receiveShadow = true;
  W.add(bench);
  const backsplashLip = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 0.12), std('#1b1716', { roughness: 0.5 }));
  backsplashLip.position.set(0, 0.06, SET.wallZ + 0.06);
  W.add(shade(backsplashLip));

  // wall: glazed tiles up to the line, dark paint above
  const tt = tileTextures();
  tt.map.repeat.set(5, 1);
  tt.bump.repeat.set(5, 1);
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.0), std('#ffffff', { map: tt.map, bumpMap: tt.bump, bumpScale: 1.5, roughness: 0.22, envMapIntensity: 1.2 }));
  tiles.position.set(0, 1.0, SET.wallZ);
  tiles.receiveShadow = true;
  W.add(tiles);
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(22, 6), std('#ffffff', { map: paintTexture(), roughness: 0.92 }));
  paint.position.set(0, 5.0, SET.wallZ);
  paint.receiveShadow = true;
  W.add(paint);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(22, 0.06, 0.05), std('#2a2522', { roughness: 0.5 }));
  trim.position.set(0, 2.0, SET.wallZ + 0.02);
  W.add(shade(trim));

  // safelight on the wall, cable running down
  const safe = safelight();
  safe.group.position.set(-3.1, 3.95, SET.wallZ + 0.2);
  W.add(safe.group);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff3a1a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pool.position.set(-3.1, 3.6, SET.wallZ + 0.01);
  W.add(pool);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.75, 3.7, SET.wallZ + 0.1), new THREE.Vector3(-2.7, 2.6, SET.wallZ + 0.03), new THREE.Vector3(-2.55, 1.2, SET.wallZ + 0.03), new THREE.Vector3(-2.4, 0.1, SET.wallZ + 0.05),
    ]), 40, 0.018, 6),
    std('#0e0c0c', { roughness: 0.45 }),
  );
  W.add(shade(cable));

  // the line, tied to two eye hooks, with a gentle sag
  const hookL = new THREE.Vector3(-5.0, SET.lineY + 0.05, SET.lineZ), hookR = new THREE.Vector3(5.6, SET.lineY + 0.05, SET.lineZ);
  for (const h of [hookL, hookR]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.abs(SET.wallZ - SET.lineZ), 8), std('#8f8a84', { metalness: 0.8, roughness: 0.3 }));
    arm.rotation.x = Math.PI / 2;
    arm.position.set(h.x, h.y, (SET.wallZ + SET.lineZ) / 2);
    W.add(shade(arm));
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16), std('#8f8a84', { metalness: 0.8, roughness: 0.3 }));
    eye.position.copy(h);
    W.add(eye);
  }
  const sag = (x) => SET.lineY + 0.05 - 0.12 * (1 - ((2 * (x - (hookL.x + hookR.x) / 2)) / (hookR.x - hookL.x)) ** 2);
  const pts = Array.from({ length: 24 }, (_, i) => {
    const x = hookL.x + ((hookR.x - hookL.x) * i) / 23;
    return new THREE.Vector3(x, sag(x), SET.lineZ);
  });
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.009, 6), std('#d9cdb8', { roughness: 0.85 }));
  W.add(shade(line));

  // the developer tray, its tongs resting on the rim
  const dev = plasticTray('#e9e4dc');
  dev.group.position.set(0.3, 0, -3.1);
  dev.group.rotation.y = -0.03;
  W.add(dev.group);
  const tg = tongs();
  tg.position.set(1.35, dev.liquidY + 0.14, -2.35);
  tg.rotation.set(0, 0.55, -0.1);
  W.add(tg);
  const th = thermometer();
  th.position.set(-0.75, dev.liquidY - 0.02, -3.85);
  th.rotation.set(0, -0.4, 0.12);
  W.add(th);

  // bottles, a graduate and the timer along the wall
  const bottles = [['Dev', '1 + 9 · 20°C', [2.55, -3.95]], ['Stop', 'acetic · 2%', [3.25, -3.55]], ['Fix', 'rapid · 1 + 4', [2.7, -2.8]]];
  for (const [text, sub, [x, z]] of bottles) {
    const b = amberBottle(text, sub);
    b.position.set(x, 0, z);
    b.rotation.y = -0.35 + (z + 3.5) * 0.4;
    W.add(b);
  }
  const gr = graduate();
  gr.position.set(3.45, 0, -4.55);
  W.add(gr);
  const tm = timer();
  tm.group.position.set(-1.55, 0.5, SET.wallZ + 0.42);
  tm.group.rotation.set(-0.12, 0.18, 0);
  W.add(tm.group);
  tm.set(0);

  const box = paperBox();
  box.position.set(-2.65, 0, -2.75);
  box.rotation.y = 0.1;
  W.add(box);

  // a faint beam of haze below the safelight
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff4a2a', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  haze.position.set(-2.6, 2.0, SET.wallZ + 1.3);
  haze.rotation.y = 0.25;
  W.add(haze);

  return {
    tray: dev,
    tongs: tg,
    stack: box,
    timer: tm,
    safe,
    benchY: SET.benchY,
    lineAt: sag,
    cleanup() {
      stage.table.visible = true;
      stage.scene.environment = null;
      env.dispose();
      stage.scene.fog.color.setHex(prevFog);
    },
  };
}
