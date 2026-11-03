import * as THREE from 'three';
import { ROLLS, COPY, LETTER, NOTES } from '../content.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { pushpin } from '../props.js';
import { FONT, canvas, canvasTexture, cardTexture, corkTexture, isWide, photoMaterial, photoTexture, rng } from '../util.js';
import { selectedFrames } from './darkroom.js';

const gsap = window.gsap;
const STILL = 3;

function posterTexture() {
  const [c, g] = canvas(600, 880);
  g.fillStyle = '#e7dcc4';
  g.fillRect(0, 0, 600, 880);
  g.fillStyle = '#2a2420';
  g.fillRect(36, 36, 528, 560);
  const r = rng(3);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(231,220,196,${r() * 0.5})`;
    g.beginPath();
    g.arc(36 + r() * 528, 36 + r() * 560 * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#c3261b';
  g.font = `bold 108px ${FONT.serif}`;
  g.textAlign = 'center';
  g.fillText('PLACEHOLDER', 300, 720);
  g.fillStyle = '#2a2420';
  g.font = `500 22px ${FONT.mono}`;
  g.fillText('A FILM POSTER GOES HERE', 300, 776);
  g.font = `italic 34px ${FONT.serif}`;
  g.fillText('a picture by the two of us', 300, 830);
  return canvasTexture(c);
}

/* ---------- scene 07: the wall ---------- */

export function wallScene(stage, app) {
  const picks = selectedFrames(app);
  const roll = ROLLS[STILL];
  hud.set({ scene: 'SCENE 07 · THE WALL', count: `ROLL ${roll.no} · ${roll.name.toUpperCase()}`, back: false });
  hud.say(COPY.wallHint);
  stage.parallaxAmount = 0.2;
  const W = { x: 0, y: 3, z: -6 };
  stage.view({ pos: [-0.2, 3.0, 1.6], target: [-0.2, 3.0, -6], fov: 40 });
  gsap.to(stage.rig, { pz: 0.7, duration: 14, ease: 'sine.inOut' });
  stage.light({ pos: [-1, 6.5, -1], target: [0.3, 2.8, -6], intensity: 85, angle: 0.75, hemi: 0.45 });

  const cork = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshStandardMaterial({ map: corkTexture(), color: '#a08a7a', roughness: 0.95 }));
  cork.position.set(W.x, W.y, W.z);
  cork.receiveShadow = true;
  stage.world.add(cork);

  const add = (mesh, x, y, rot = 0, z = 0.02) => {
    mesh.position.set(W.x + x, W.y + y, W.z + z);
    mesh.rotation.z = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    stage.world.add(mesh);
    return mesh;
  };

  const label = add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshStandardMaterial({
    map: cardTexture({ w: 512, h: 256, bg: '#efe6d2', border: true, lines: [
      { text: `ROLL ${roll.no} · 24 EXP`, font: `500 18px ${FONT.mono}`, x: 34, y: 50, color: '#7d6d5d' },
      { text: roll.name, font: `italic 88px ${FONT.serif}`, x: 34, y: 150, color: '#8c2c18' },
      { text: 'kept · wound · printed', font: `500 16px ${FONT.mono}`, x: 34, y: 206, color: '#7d6d5d' },
    ] }),
    roughness: 0.9,
  })), -2.6, 1.7, 0.03);
  const poster = add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.5), new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.85 })), -3.1, -0.45, -0.04);
  const pins = [add(pushpin(), -2.6, 2.05, 0, 0.03), add(pushpin('#2c2a28'), -3.1, 0.72, 0, 0.03)];

  const spots = [[-0.9, 1.0, 0.06], [0.75, 1.15, -0.05], [-0.7, -0.75, -0.04], [0.95, -0.6, 0.07], [2.45, 0.35, -0.08], [2.55, -1.55, 0.05]];
  picks.forEach((frameIndex, k) => {
    const [x, y, rot] = spots[k % spots.length];
    const card = new THREE.Group();
    const wide = isWide(roll.frames[frameIndex]);
    const [bw, bh, pw, ph] = wide ? [1.45, 1.2, 1.29, 0.92] : [1.2, 1.45, 1.02, 1.08];
    const border = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.008), new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.85 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMaterial(photoTexture(STILL, frameIndex, roll.frames[frameIndex]), { mono: 1, bright: 0.9 }));
    photo.position.set(0, 0.1, 0.005);
    card.add(border, photo);
    card.traverse((m) => m.isMesh && (m.castShadow = true));
    add(card, x, y, rot, 0.03 + k * 0.004);
    pins.push(add(pushpin(), x + Math.sin(-rot) * 0.6, y + bh / 2 - 0.1, 0, 0.05 + k * 0.004));
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshStandardMaterial({
      map: cardTexture({ w: 320, h: 120, bg: '#f2ead6', lines: [{ text: `${NOTES[k % NOTES.length].date} · ${roll.frames[frameIndex].title.toLowerCase()}`, font: `36px ${FONT.hand}`, x: 18, y: 76, color: '#5a4636' }] }),
    }));
    add(tag, x + 0.55, y - 0.78, rot * 1.6, 0.06 + k * 0.004);
    gsap.from(card.position, { z: W.z + 0.6, duration: 0.8, delay: 0.3 + k * 0.15, ease: 'power3.out', onComplete: () => sfx.tick(0.5, 0.18) });
  });

  // red string between the pins, with a little sag
  const strings = new THREE.MeshStandardMaterial({ color: '#b3231a', roughness: 0.6 });
  const order = [0, ...pins.slice(2).map((_, i) => i + 2), 1];
  for (let i = 0; i < order.length - 1; i++) {
    const a = pins[order[i]].position.clone().setZ(W.z + 0.11), b = pins[order[i + 1]].position.clone().setZ(W.z + 0.11);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 0.12 + a.distanceTo(b) * 0.04;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.008, 5), strings);
    tube.castShadow = true;
    stage.world.add(tube);
  }
  void label;
  void poster;

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
    app.go('letter');
  };
  stage.onEmptyClick = open;
  stage.pick(cork, { cursor: 'pointer', label: 'open the letter', click: open });
  const timer = setTimeout(open, 9000);
  return () => clearTimeout(timer);
}

/* ---------- the letter ---------- */

export function letterScene(stage, app) {
  hud.set({ scene: `ROLL 04 · THE LETTER`, count: '', back: false });
  hud.say(null);
  stage.view({ pos: [-0.2, 3.0, 0.7], target: [-0.2, 3.0, -6], fov: 40 });
  stage.scene.background.set('#120806');

  const el = document.querySelector('#letter');
  const body = el.querySelector('.letter-body');
  body.textContent = '';
  el.hidden = false;
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.8 });
  sfx.paper();
  gsap.fromTo(el.querySelector('.letter-paper'), { y: 40, rotate: 3 }, { y: 0, rotate: -1.2, duration: 1.2, ease: 'power3.out' });
  gsap.fromTo(el.querySelector('.envelope'), { x: -60, rotate: -14 }, { x: 0, rotate: -8, duration: 1.2, ease: 'power3.out' });

  const text = [LETTER.to, ...LETTER.paragraphs, LETTER.sign].join('\n\n');
  let i = 0;
  let cancelled = false;
  const type = () => {
    if (cancelled) return;
    body.textContent = text.slice(0, ++i);
    if (text[i - 1] !== ' ' && text[i - 1] !== '\n') sfx.tick(0.45 + Math.random() * 0.15, 0.07);
    if (i < text.length) setTimeout(type, text[i - 1] === '\n' ? 180 : 26 + Math.random() * 30);
    else hud.say(null, { label: COPY.rewind, run: () => app.go('table', { reset: true }) });
  };
  setTimeout(type, 900);
  el.onclick = () => {
    if (i < text.length) i = text.length - 1;
  };
  return () => {
    cancelled = true;
    el.hidden = true;
    el.onclick = null;
    stage.scene.background.set('#0a0302');
  };
}
