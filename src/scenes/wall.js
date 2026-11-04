import * as THREE from 'three';
import { ROLLS, COPY, NOTES } from '../content.js';
import { mosaicTexture } from '../shopSet.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { FONT, canvas, canvasTexture, cardTexture, isWide, photoMaterial, photoTexture, } from '../util.js';
import { selectedFrames } from './darkroom.js';

const gsap = window.gsap;
const STILL = 3;

// the board over the sample wall, painted like the sign outside
function headerTexture() {
  const [c, g] = canvas(1600, 220);
  g.fillStyle = '#c4231b';
  g.fillRect(0, 0, 1600, 220);
  g.strokeStyle = '#f5c32c';
  g.lineWidth = 10;
  g.strokeRect(14, 14, 1572, 192);
  g.fillStyle = '#fff6ea';
  g.font = `900 104px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('樣 板 相', 560, 146);
  g.fillStyle = '#f5c32c';
  g.font = `600 52px ${FONT.cond}`;
  g.fillText('SAMPLE PRINTS · 本店出品', 1150, 132);
  return canvasTexture(c);
}

// a hand-ruled price card where the poster used to be
function priceTexture() {
  const [c, g] = canvas(600, 880);
  g.fillStyle = '#f5c32c';
  g.fillRect(0, 0, 600, 880);
  g.fillStyle = '#151413';
  g.font = `900 92px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('沖曬價目', 300, 130);
  g.font = `600 30px ${FONT.cond}`;
  g.fillText('DEVELOP & PRINT', 300, 182);
  g.fillRect(50, 214, 500, 6);
  const rows = [['沖底片', '$ 30'], ['4R 相', '$ 2.5'], ['5R 放大', '$ 8'], ['掃描入碟', '$ 50'], ['一小時快相', '$ 10']];
  g.textAlign = 'left';
  rows.forEach(([a, b], i) => {
    const y = 300 + i * 92;
    g.font = `700 46px ${FONT.sign}`;
    g.fillText(a, 60, y);
    g.textAlign = 'right';
    g.font = `600 46px ${FONT.cond}`;
    g.fillText(b, 540, y);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(21,20,19,0.25)';
    g.fillRect(60, y + 26, 480, 3);
    g.fillStyle = '#151413';
  });
  g.fillStyle = '#c4231b';
  g.font = `900 54px ${FONT.sign}`;
  g.textAlign = 'center';
  g.fillText('即日取 · 1 HR', 300, 820);
  return canvasTexture(c);
}

function tape(w = 0.42) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.13), new THREE.MeshStandardMaterial({ color: '#f3ead0', transparent: true, opacity: 0.62, roughness: 0.5 }));
  return m;
}

/* ---------- scene 07: the wall ---------- */

export function wallScene(stage, app) {
  const picks = selectedFrames(app);
  const roll = ROLLS[STILL];
  hud.set({ scene: '相片牆 · THE WALL', count: `ROLL ${roll.no} · ${roll.name.toUpperCase()}`, back: false });
  hud.say(COPY.wallHint);
  stage.parallaxAmount = 0.2;
  const W = { x: 0, y: 3, z: -6 };
  stage.view({ pos: [-0.2, 3.0, 1.6], target: [-0.2, 3.0, -6], fov: 40 });
  gsap.to(stage.rig, { pz: 0.7, duration: 14, ease: 'sine.inOut' });
  stage.light({ pos: [-1, 6.5, -1], target: [0.3, 2.8, -6], intensity: 85, angle: 0.75, hemi: 0.45 });

  const tiles = mosaicTexture({ base: '#9fcdbd', dark: '#79ad9b', light: '#c3e6d9', grout: '#dfe8e3', seed: 9 });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(5, 2.9);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshStandardMaterial({ map: tiles, color: '#c9d6d1', roughness: 0.35, metalness: 0.05 }));
  wall.position.set(W.x, W.y, W.z);
  wall.receiveShadow = true;
  stage.world.add(wall);

  const add = (mesh, x, y, rot = 0, z = 0.02) => {
    mesh.position.set(W.x + x, W.y + y, W.z + z);
    mesh.rotation.z = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    stage.world.add(mesh);
    return mesh;
  };
  const taped = (x, y, rot, w, h, z) => {
    for (const side of [-1, 1]) {
      const t = add(tape(), x + Math.cos(rot) * side * (w / 2 - 0.08) - Math.sin(rot) * (h / 2 - 0.02), y + Math.sin(rot) * side * (w / 2 - 0.08) + Math.cos(rot) * (h / 2 - 0.02), rot + side * 0.6, z + 0.012);
      t.castShadow = false;
    }
  };

  add(new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.86, 0.06), new THREE.MeshStandardMaterial({ map: headerTexture(), roughness: 0.5 })), 0.4, 2.2, 0, 0.04);
  const label = add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshStandardMaterial({
    map: cardTexture({ w: 512, h: 256, bg: '#fbf8f0', border: true, lines: [
      { text: `取件單 · ROLL ${roll.no} · 24 EXP`, font: `600 20px ${FONT.cond}`, x: 34, y: 50, color: '#c4231b' },
      { text: roll.name, font: `90px ${FONT.hand}`, x: 34, y: 152, color: '#24201c' },
      { text: 'kept · wound · printed', font: `500 18px ${FONT.cond}`, x: 34, y: 206, color: '#6b625a' },
    ] }),
    roughness: 0.9,
  })), -3.0, 1.45, 0.03);
  taped(-3.0, 1.45, 0.03, 1.7, 0.85, 0.02);
  const price = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.35), new THREE.MeshStandardMaterial({ map: priceTexture(), roughness: 0.8 })), -3.1, -0.85, -0.04);
  taped(-3.1, -0.85, -0.04, 1.6, 2.35, 0.02);

  const spots = [[-0.9, 1.0, 0.06], [0.75, 1.15, -0.05], [-0.7, -0.75, -0.04], [0.95, -0.6, 0.07], [2.45, 0.35, -0.08], [2.55, -1.55, 0.05]];
  picks.forEach((frameIndex, k) => {
    const [x, y, rot] = spots[k % spots.length];
    const frame = roll.frames[frameIndex];
    const card = new THREE.Group();
    const wide = isWide(frame);
    const [bw, bh, pw, ph] = wide ? [1.45, 1.2, 1.29, 0.92] : [1.2, 1.45, 1.02, 1.08];
    const border = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.008), new THREE.MeshStandardMaterial({ color: '#f6f2e8', roughness: 0.6 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMaterial(photoTexture(STILL, frameIndex, frame), { mono: 1, bright: 0.9 }));
    photo.position.set(0, 0.1, 0.005);
    card.add(border, photo);
    card.traverse((m) => m.isMesh && (m.castShadow = true));
    const z = 0.03 + k * 0.004;
    add(card, x, y, rot, z);
    gsap.from(card.position, { z: W.z + 0.6, duration: 0.8, delay: 0.3 + k * 0.15, ease: 'power3.out', onComplete: () => { sfx.tick(0.5, 0.18); taped(x, y, rot, bw, bh, z); } });
    const when = frame.date || NOTES[k % NOTES.length].date;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshStandardMaterial({
      map: cardTexture({ w: 320, h: 120, bg: '#f5c32c', lines: [{ text: `${when} · ${frame.title.toLowerCase()}`, font: `36px ${FONT.hand}`, x: 18, y: 76, color: '#151413' }] }),
    }));
    add(tag, x + 0.55, y - 0.78, rot * 1.6, z + 0.03);
  });
  void label;
  void price;

  // everything gathered on the way, pinned up as one stamp
  const st = app.state.stats;
  const bits = [`${picks.length} prints`];
  if (st.developed) bits.push(`${st.developed} frames developed`);
  if (st.notes) bits.push(`${st.notes} notes read`);
  if (st.km) bits.push(`${st.km.toLocaleString('en')} km apart`);
  gsap.delayedCall(1.8, () => hud.toast('look what we kept', { kicker: 'the wall', line: bits.join(' · '), hold: 3.2, sound: 'success' }));

  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    app.go('pickup');
  };
  stage.onEmptyClick = open;
  stage.pick(wall, { cursor: 'pointer', label: 'collect the prints', click: open });
  const timer = setTimeout(open, 9000);
  return () => clearTimeout(timer);
}
