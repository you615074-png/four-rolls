import * as THREE from 'three';
import { ROLLS, COPY, NOTES } from '../content.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { kraftTexture, washi } from '../deskSet.js';
import { FONT, canvas, canvasTexture, cardTexture, isWide, photoMaterial, photoTexture } from '../util.js';
import { selectedFrames } from './darkroom.js';

const gsap = window.gsap;
const STILL = 3;

// a typed index card where the old poster used to be
function indexCardTexture(roll, n) {
  const [c, g] = canvas(640, 420);
  g.fillStyle = '#f7f2e7';
  g.fillRect(0, 0, 640, 420);
  g.fillStyle = 'rgba(200,64,47,0.5)';
  g.fillRect(0, 86, 640, 3);
  g.fillStyle = 'rgba(45,62,92,0.18)';
  for (let y = 136; y < 420; y += 50) g.fillRect(0, y, 640, 2);
  g.fillStyle = '#2b241e';
  g.font = `400 34px ${FONT.type}`;
  g.fillText(`ROLL ${roll.no} · ${roll.name.toUpperCase()}`, 36, 62);
  g.font = `400 26px ${FONT.type}`;
  const lines = [`${n} prints, 4R, fibre paper`, 'developed by hand, at home', 'under one lamp, one night'];
  lines.forEach((t, i) => g.fillText(t, 36, 128 + i * 50));
  g.fillStyle = '#c8402f';
  g.font = `400 52px ${FONT.hand}`;
  g.fillText('keep these', 330, 390);
  return canvasTexture(c);
}

/* ---------- scene 07: the board ---------- */

export function wallScene(stage, app) {
  const picks = selectedFrames(app);
  const roll = ROLLS[STILL];
  hud.set({ scene: 'THE BOARD', count: `ROLL ${roll.no} · ${roll.name.toUpperCase()}`, back: false });
  hud.say(COPY.wallHint);
  stage.parallaxAmount = 0.2;
  const W = { x: 0, y: 3, z: -6 };
  stage.view({ pos: [-0.2, 3.0, 1.6], target: [-0.2, 3.0, -6], fov: 40 });
  gsap.to(stage.rig, { pz: 0.7, duration: 14, ease: 'sine.inOut' });
  stage.light({ pos: [-2.2, 6.2, -1.2], target: [0.2, 2.8, -6], intensity: 80, angle: 0.8, hemi: 0.35 });
  stage.key.color.set('#ffd29a');

  // a sheet of packing paper pinned over the whole wall
  const [kc] = kraftTexture(1024, 1024, 17);
  const kt = canvasTexture(kc);
  kt.wrapS = kt.wrapT = THREE.RepeatWrapping;
  kt.repeat.set(2.4, 1.4);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshStandardMaterial({ map: kt, color: '#d6c2a4', roughness: 0.95 }));
  board.position.set(W.x, W.y, W.z);
  board.receiveShadow = true;
  stage.world.add(board);

  const add = (mesh, x, y, rot = 0, z = 0.02) => {
    mesh.position.set(W.x + x, W.y + y, W.z + z);
    mesh.rotation.z = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    stage.world.add(mesh);
    return mesh;
  };
  let tapes = 0;
  // two strips of washi across the top corners
  const taped = (x, y, rot, w, h, z) => {
    for (const side of [-1, 1]) {
      const cx = x + Math.cos(rot) * side * (w / 2 - 0.06) - Math.sin(rot) * (h / 2 - 0.04);
      const cy = y + Math.sin(rot) * side * (w / 2 - 0.06) + Math.cos(rot) * (h / 2 - 0.04);
      const t = add(washi(tapes++, 0.46), cx, cy, rot - side * 0.7, z + 0.012);
      t.castShadow = false;
    }
  };

  const label = add(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshStandardMaterial({
    map: cardTexture({ w: 512, h: 256, bg: '#f4efe4', lines: [
      { text: `ROLL ${roll.no} · 24 EXP`, font: `500 18px ${FONT.mono}`, x: 34, y: 50, color: '#7d6d5d' },
      { text: roll.name, font: `italic 88px ${FONT.serif}`, x: 34, y: 150, color: '#8c2c18' },
      { text: 'kept · wound · printed', font: `500 16px ${FONT.mono}`, x: 34, y: 206, color: '#7d6d5d' },
    ] }),
    roughness: 0.9,
  })), -3.0, 1.75, 0.03);
  taped(-3.0, 1.75, 0.03, 1.8, 0.9, 0.02);
  const note = add(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.25), new THREE.MeshStandardMaterial({ map: indexCardTexture(roll, picks.length), roughness: 0.9 })), -3.05, -0.55, -0.05);
  taped(-3.05, -0.55, -0.05, 1.9, 1.25, 0.02);

  const spots = [[-0.9, 1.0, 0.06], [0.75, 1.15, -0.05], [-0.7, -0.75, -0.04], [0.95, -0.6, 0.07], [2.45, 0.35, -0.08], [2.55, -1.55, 0.05]];
  picks.forEach((frameIndex, k) => {
    const [x, y, rot] = spots[k % spots.length];
    const frame = roll.frames[frameIndex];
    const card = new THREE.Group();
    const wide = isWide(frame);
    const [bw, bh, pw, ph] = wide ? [1.45, 1.2, 1.29, 0.92] : [1.2, 1.45, 1.02, 1.08];
    const border = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.008), new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.85 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMaterial(photoTexture(STILL, frameIndex, frame), { mono: 1, bright: 0.9 }));
    photo.position.set(0, 0.1, 0.005);
    card.add(border, photo);
    card.traverse((m) => m.isMesh && (m.castShadow = true));
    const z = 0.03 + k * 0.004;
    add(card, x, y, rot, z);
    gsap.from(card.position, { z: W.z + 0.6, duration: 0.8, delay: 0.3 + k * 0.15, ease: 'power3.out', onComplete: () => { sfx.tick(0.5, 0.18); taped(x, y, rot, bw, bh, z); } });
    const when = frame.date || NOTES[k % NOTES.length].date;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshStandardMaterial({
      map: cardTexture({ w: 320, h: 120, bg: '#f2ead6', lines: [{ text: `${when} · ${frame.title.toLowerCase()}`, font: `36px ${FONT.hand}`, x: 18, y: 76, color: '#2d3e5c' }] }),
    }));
    add(tag, x + 0.55, y - 0.78, rot * 1.6, z + 0.03);
  });
  void label;
  void note;

  // everything gathered on the way, in one card
  const st = app.state.stats;
  const bits = [`${picks.length} prints`];
  if (st.developed) bits.push(`${st.developed} frames developed`);
  if (st.notes) bits.push(`${st.notes} notes read`);
  if (st.km) bits.push(`${st.km.toLocaleString('en')} km apart`);
  gsap.delayedCall(1.8, () => hud.toast('look what we kept', { kicker: 'the board', line: bits.join(' · '), hold: 3.2, sound: 'success' }));

  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    app.go('pickup');
  };
  stage.onEmptyClick = open;
  stage.pick(board, { cursor: 'pointer', label: 'put them away', click: open });
  const timer = setTimeout(open, 9000);
  return () => clearTimeout(timer);
}
