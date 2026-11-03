import * as THREE from 'three';
import { ROLLS, COPY } from '../content.js';
import { hud } from '../hud.js';
import { CAN, FILM, canister, pen, slideViewer, stripSegment } from '../props.js';
import {
  FONT, canvas, canvasTexture, damp, glowTexture, handHeart, handLoop,
  photoMaterial, photoSource, photoTexture, releaseRoll, smooth,
} from '../util.js';

const gsap = window.gsap;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const STILL = 3;
const frameNo = (i) => String(i + 1).padStart(2, '0');

function tickMark() {
  const [c, g] = canvas(256, 256);
  g.strokeStyle = '#e04a3a';
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(58, 142);
  g.quadraticCurveTo(84, 160, 104, 196);
  g.quadraticCurveTo(140, 110, 206, 58);
  g.stroke();
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/* ---------- the table: four rolls ---------- */

export function tableScene(stage, app) {
  const opened = app.state.visited;
  hud.set({ scene: 'SCENE 04 · THE ROLLS', count: `${opened.size} OF 4 OPENED`, title: true });
  stage.view({ pos: [0.3, 9.4, 6.6], target: [0.3, 0, 0.5], fov: 34 });
  stage.light({ pos: [0.2, 9, 3.4], target: [0.3, 0, 0.3], intensity: 150, angle: 0.72 });
  stage.parallaxAmount = 0.18;

  const layout = [
    { x: -2.75, z: -0.95, yaw: 0.42, roll: 1.0 },
    { x: -0.75, z: 1.35, yaw: -0.38, roll: 0.75 },
    { x: 1.45, z: -1.55, yaw: 0.12, roll: 0.95 },
    { x: 3.35, z: 0.45, yaw: -0.52, roll: 0.85 },
  ];

  let invite = null;
  ROLLS.forEach((roll, i) => {
    const L = layout[i];
    const holder = new THREE.Group();
    const tilt = new THREE.Group();
    const can = canister(roll);
    tilt.rotation.z = Math.PI / 2;
    tilt.position.set(CAN.h / 2, CAN.r + 0.03, 0);
    tilt.add(can);
    holder.add(tilt);
    holder.position.set(L.x, 0, L.z);
    holder.rotation.y = L.yaw;
    stage.world.add(holder);

    const st = { h: 0, to: 0, drop: 0.6 };
    gsap.to(st, { drop: 0, duration: 0.9, delay: 0.25 + 0.08 * i, ease: 'bounce.out' });
    stage.pick(holder, {
      label: opened.has(i) ? `${roll.name} · again` : `open ${roll.name}`,
      enter: () => {
        st.to = 1;
        invite?.hide();
      },
      leave: () => (st.to = 0),
      click: () => app.go('roll', { index: i }),
    });
    stage.onFrame((dt, t) => {
      st.h = damp(st.h, st.to, 9, dt);
      // rolls you haven't opened take turns giving a little nudge
      const nudge = opened.has(i) ? 0 : Math.max(0, Math.sin(t * 1.4 - i * 1.6)) ** 14;
      holder.position.y = st.drop + st.h * 0.24;
      holder.rotation.y = L.yaw + st.h * 0.1;
      can.rotation.y = L.roll + nudge * 0.25 + st.h * 0.15;
    });
    if (opened.has(i)) {
      const tick = tickMark();
      tick.position.set(L.x + 0.1, 0.012, L.z + 0.8);
      stage.world.add(tick);
    }
  });

  // a red marker and a pencil left by the last roll
  const p1 = pen('red');
  p1.rotation.set(Math.PI / 2, 0, 0.5);
  p1.position.set(3.6, 0.07, 1.75);
  const p2 = pen('pencil');
  p2.rotation.set(Math.PI / 2, 0, -0.35);
  p2.position.set(4.2, 0.05, 1.55);
  stage.world.add(p1, p2);

  if (!opened.size) invite = stage.anchor(new THREE.Vector3(-0.75, 0.9, 1.35), 'tap a roll to open it', { dy: -26 });
  const canGo = opened.has(STILL) || opened.size === ROLLS.length;
  hud.say(opened.size && !opened.has(STILL) ? COPY.stillDecides : COPY.pickOne, canGo ? { label: COPY.toDarkroom, run: () => app.go('lightbox') } : null);
}

/* ---------- a strip standing on the table, coming out of its can ---------- */

function standingStrip(stage, rollIndex, { pulled, min = 0.6, x0 = -0.7, z = 0, neg = 1 }) {
  const roll = ROLLS[rollIndex];
  const can = canister(roll);
  can.position.set(x0, 0, z);
  stage.world.add(can);
  const mouth = x0 + CAN.r - 0.05;
  const items = roll.frames.map((f, i) => {
    const seg = new THREE.Group();
    seg.add(stripSegment());
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(FILM.imgW, FILM.imgH), photoMaterial(photoTexture(rollIndex, i, f), { neg, bright: 0.92 }));
    photo.position.z = 0.004;
    seg.add(photo);
    const back = new THREE.Mesh(photo.geometry, photo.material);
    back.rotation.y = Math.PI;
    back.position.z = -0.004;
    seg.add(back);
    stage.world.add(seg);
    return { seg, photo, mat: photo.material, i, frame: f, lift: 0, liftTo: 0, hop: 0, out: false };
  });
  const strip = {
    can, items, pulled, min, mouth, tease: 0, max: roll.frames.length * FILM.pitch + 0.2,
    place(s) {
      return { x: mouth + s, y: FILM.height / 2 + 0.04, z: z + 0.06 * Math.sin(s * 0.8) - 0.004 * s * s, ry: -Math.atan(0.048 * Math.cos(s * 0.8) - 0.008 * s) };
    },
    at(it) {
      return strip.pulled + strip.tease - (it.i + 0.5) * FILM.pitch;
    },
    layout() {
      for (const it of items) {
        if (it.out) continue;
        const s = strip.at(it);
        it.seg.visible = s > -FILM.pitch * 0.55;
        const p = strip.place(s);
        it.seg.position.set(p.x, p.y + it.lift + it.hop, p.z);
        it.seg.rotation.set(0, p.ry, 0);
      }
    },
  };
  stage.onFrame((dt, t) => {
    for (const it of items) {
      it.mat.uniforms.uTime.value = t;
      it.lift = damp(it.lift, it.liftTo, 12, dt);
    }
    strip.layout();
  });
  strip.layout();
  return strip;
}

function hoverLift(it, amount = 0.08) {
  return {
    enter: () => !it.out && (it.liftTo = amount),
    leave: () => (it.liftTo = 0),
  };
}

/** Drag (or scroll) to slide the film in and out, with momentum and soft ends. */
function dragToPull(stage, strip, { label = 'drag ⟷', onFirst } = {}) {
  let v = 0, last = 0, first = true, wheelTo = null;
  const touched = () => {
    if (!first) return;
    first = false;
    onFirst?.();
  };
  const settle = (to, duration = 1.0) =>
    gsap.to(strip, { pulled: clamp(to, strip.min, strip.max), duration, ease: 'power3.out', overwrite: true });
  stage.dragHandler = {
    label,
    start: () => {
      gsap.killTweensOf(strip, 'pulled');
      wheelTo = null;
    },
    begin: () => {
      v = 0;
      last = performance.now();
      touched();
    },
    move: (dx) => {
      const now = performance.now();
      let d = dx * 0.011;
      if (strip.pulled + d > strip.max || strip.pulled + d < strip.min) d *= 0.3;
      strip.pulled += d;
      v = v * 0.6 + clamp((d / Math.max(8, now - last)) * 1000, -14, 14) * 0.4;
      last = now;
    },
    end: () => {
      if (performance.now() - last > 90) v = 0;
      settle(strip.pulled + clamp(v * 0.22, -2.4, 2.4));
    },
  };
  stage.wheelHandler = (delta) => {
    touched();
    wheelTo = clamp((wheelTo ?? strip.pulled) + delta * 0.006, strip.min, strip.max);
    gsap.to(strip, { pulled: wheelTo, duration: 0.6, ease: 'power3.out', overwrite: true, onComplete: () => (wheelTo = null) });
  };
}

export function rollScene(stage, app, { index }) {
  const roll = ROLLS[index];
  app.state.visited.add(index);
  hud.set({ scene: 'SCENE 04 · THE ROLLS', count: `ROLL ${roll.no} · ${roll.name.toUpperCase()}`, back: true });
  hud.say(roll.hint);
  stage.parallaxAmount = 0.1;
  if (roll.mode === 'contact') return contactSheet(stage, app, index);

  stage.view({ pos: [1.9, 2.2, 7.0], target: [1.9, 0.86, 0], fov: 34 });
  stage.light({ pos: [1.6, 7.5, 4.5], target: [1.8, 0.6, 0], intensity: 120, angle: 0.55 });
  gsap.from(stage.rig, { pz: 8.2, py: 2.6, duration: 1.4, ease: 'power3.out' });

  const modes = { develop: developRoll, light: lightRoll, viewer: viewerRoll };
  const done = modes[roll.mode](stage, index);
  return () => {
    done?.();
    releaseRoll(index);
  };
}

/* Mature: one continuous gesture. Drag the film out; the safelight develops
   every frame that passes under it. */
function developRoll(stage, index) {
  const roll = ROLLS[index];
  const strip = standingStrip(stage, index, { pulled: 0.7, min: 0.6 });
  gsap.to(strip, { pulled: 1.45, duration: 1.4, delay: 0.7, ease: 'power2.out' });

  const lamp = new THREE.Group();
  const lampX = strip.mouth + 1.05;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#111' }));
  cord.position.y = 1.35;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#2a201c', metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.55, 0.25), toneMapped: false }));
  bulb.position.y = -0.08;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff6a3a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.setScalar(1.6);
  glow.position.y = -0.1;
  const safelight = new THREE.PointLight('#ff5a2a', 5, 3.5, 1.5);
  safelight.position.y = -0.3;
  lamp.add(cord, shade, bulb, glow, safelight);
  lamp.position.set(lampX, 2.05, 0.35);
  stage.world.add(lamp);

  let touched = false;
  const guide = stage.anchor(new THREE.Vector3(strip.mouth + 1.7, 1.75, 0.2), 'pull it out →', { side: 'right' });
  dragToPull(stage, strip, {
    label: 'drag to pull ⟷',
    onFirst: () => {
      touched = true;
      guide.hide();
    },
  });

  let developedCount = 0;
  const t0 = performance.now();
  stage.onFrame((dt, t) => {
    // until the first drag, the film keeps edging out a little to show it moves
    const idle = (performance.now() - t0) / 1000 > 2.2 && !touched;
    strip.tease = damp(strip.tease, idle ? 0.25 * Math.max(0, Math.sin(t * 2.2)) ** 6 : 0, 10, dt);
    glow.material.opacity = 0.5 + Math.sin(t * 3.1) * 0.04;
    for (const it of strip.items) {
      const lit = smooth(0.55, 1.55, strip.at(it));
      if (lit <= (it.dev ?? 0)) continue;
      it.dev = lit;
      it.mat.uniforms.uNeg.value = 1 - lit;
      if (lit > 0.98 && !it.done) {
        it.done = true;
        developedCount++;
        hud.setCount(`${developedCount} OF ${roll.frames.length} DEVELOPED`);
        gsap.fromTo(it.mat.uniforms.uBright, { value: 1.45 }, { value: 0.92, duration: 1.1, ease: 'power2.out' });
      }
    }
  });

  for (const it of strip.items) {
    stage.pick(it.seg, {
      ...hoverLift(it),
      label: () => (it.done ? it.frame.title : 'pull it under the lamp'),
      click: () => {
        if (!it.done) {
          gsap.fromTo(it, { hop: 0 }, { hop: 0.05, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' });
          return;
        }
        gsap.fromTo(it, { hop: 0 }, { hop: 0.22, duration: 0.24, yoyo: true, repeat: 1, ease: 'power2.out' });
        hud.setCaption({ small: `${it.frame.date} · FRAME ${frameNo(it.i)}`, title: it.frame.title });
      },
    });
  }
}

/* slow days: lift one frame to the light and tilt it with the pointer. */
function lightRoll(stage, index) {
  const strip = standingStrip(stage, index, { pulled: 0.8, min: 0.8 });
  gsap.to(strip, { pulled: 5.6, duration: 1.8, delay: 0.3, ease: 'power3.out' });
  dragToPull(stage, strip, { label: 'drag ⟷ · tap a frame' });

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(1.7, 1.6, 1.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  stage.world.add(glow);
  const target = new THREE.Vector3(stage.rig.tx - 0.2, 1.45, 1.55);
  const glowHome = new THREE.Vector3(target.x + 0.15, target.y + 0.35, target.z - 0.5);
  glow.position.copy(glowHome);
  let held = null;
  const guide = stage.anchor(strip.items[2].seg, 'tap one', { dy: -120 });

  const putBack = (it) => {
    held = null;
    it.ready = false;
    hud.setCaption(null);
    gsap.to(glow.material, { opacity: 0, duration: 0.5 });
    gsap.to(it.mat.uniforms.uNeg, { value: 1, duration: 0.9 });
    gsap.to(it.mat.uniforms.uBright, { value: 0.92, duration: 0.6 });
    gsap.to(it.seg.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power3.inOut' });
    const p = strip.place(strip.at(it));
    gsap.to(it.seg.rotation, { x: 0, y: p.ry, z: 0, duration: 0.8, ease: 'power3.inOut' });
    gsap.to(it.seg.position, {
      x: p.x, y: p.y, z: p.z, duration: 0.8, ease: 'power3.inOut',
      onComplete: () => {
        it.out = false;
        it.seg.children[0].castShadow = true;
        if (it.label) {
          it.seg.remove(it.label);
          it.label = null;
        }
      },
    });
  };

  const holdUp = (it) => {
    if (held) putBack(held);
    guide.hide();
    held = it;
    it.out = true;
    it.liftTo = it.lift = 0;
    it.seg.traverse((m) => (m.castShadow = false));
    if (!it.label) it.seg.add((it.label = edgePrint(ROLLS[index], it)));
    hud.setCaption({ small: `${it.frame.date} · FRAME ${frameNo(it.i)}`, title: it.frame.title });
    gsap.to(glow.material, { opacity: 0.95, duration: 0.9, delay: 0.25 });
    gsap.to(it.seg.position, { x: target.x, y: target.y, z: target.z, duration: 0.9, ease: 'power3.inOut' });
    gsap.to(it.seg.rotation, { x: 0, y: -0.08, z: 0.04, duration: 0.9, ease: 'power3.inOut', onComplete: () => (it.ready = true) });
    gsap.to(it.seg.scale, { x: 1.28, y: 1.28, z: 1.28, duration: 0.9, ease: 'power3.inOut' });
    gsap.to(it.mat.uniforms.uNeg, { value: 0, duration: 1.4, delay: 0.35, ease: 'power2.inOut' });
  };

  stage.onFrame((dt) => {
    if (!held?.ready) return;
    // the held frame follows the pointer; turning it away from the light dims it
    const tx = stage.parallax.x * 0.45, ty = -stage.parallax.y * 0.3;
    const r = held.seg.rotation;
    r.y = damp(r.y, -0.08 + tx, 8, dt);
    r.x = damp(r.x, ty, 8, dt);
    glow.position.x = damp(glow.position.x, glowHome.x - tx * 1.4, 6, dt);
    glow.position.y = damp(glow.position.y, glowHome.y + ty * 1.2, 6, dt);
    held.mat.uniforms.uBright.value = damp(held.mat.uniforms.uBright.value, 1.18 - Math.hypot(tx, ty) * 0.5, 6, dt);
  });

  for (const it of strip.items) {
    stage.pick(it.seg, {
      ...hoverLift(it),
      label: () => (it.out ? 'put it back' : 'hold it up'),
      click: () => (it.out ? putBack(it) : holdUp(it)),
    });
  }
  stage.onEmptyClick = () => held && putBack(held);
}

function edgePrint(roll, it) {
  const [c, g] = canvas(512, 768);
  g.scale(2, 2);
  g.fillStyle = 'rgba(255,224,170,0.9)';
  g.font = `500 12px ${FONT.mono}`;
  g.fillText(`${frameNo(it.i)} · ${it.frame.title.toUpperCase()}`, 96, 58);
  g.fillText(`${roll.no} · ${it.frame.date}`, 26, 336);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(FILM.pitch, FILM.height), new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false }));
  m.position.z = 0.006;
  return m;
}

/* far away: a slide viewer; the lever feeds one frame at a time. */
function viewerRoll(stage, index) {
  const roll = ROLLS[index];
  const strip = standingStrip(stage, index, { pulled: 5.4, min: 5.4, z: -0.25 });
  const v = slideViewer();
  v.group.position.set(1.05, 0, 0.65);
  stage.world.add(v.group);
  const blank = new THREE.CanvasTexture(canvas(4, 4)[0]);
  const screen = photoMaterial(blank, { bright: 1.25 });
  screen.uniforms.uFlash.value = 0.85;
  v.screen.material = screen;
  const knob = v.lever.children[1];
  const guide = stage.anchor(knob, 'press the lever', { dy: -22 });
  let cur = -1;
  let knobTo = 1;

  const step = (dir) => {
    guide.hide();
    cur = (cur + dir + roll.frames.length) % roll.frames.length;
    gsap.timeline()
      .to(v.lever.rotation, { x: dir > 0 ? -0.9 : 0.6, duration: 0.16, ease: 'power2.in' })
      .to(v.lever.rotation, { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' });
    const to = 5.4 + FILM.pitch * (cur + 1);
    gsap.to(strip, { pulled: Math.min(to, strip.max), duration: 0.6, ease: 'power2.inOut', overwrite: true });
    const f = roll.frames[cur];
    screen.uniforms.uMap.value = photoTexture(index, cur, f);
    gsap.fromTo(screen.uniforms.uFlash, { value: 1 }, { value: 0, duration: 0.8, ease: 'power2.out' });
    hud.setCaption({ small: `${f.date} · FRAME ${frameNo(cur)}`, title: f.title });
    hud.setCount(`FRAME ${cur + 1} OF ${roll.frames.length}`);
    gsap.to(strip.items[cur].mat.uniforms.uNeg, { value: 0, duration: 1.0, delay: 0.3 });
  };

  const lever = {
    label: 'next frame',
    enter: () => (knobTo = 1.22),
    leave: () => (knobTo = 1),
    press: () => (knobTo = 0.9),
    click: () => {
      knobTo = 1.22;
      step(1);
    },
  };
  stage.pick(v.lever, lever);
  stage.pick(v.screen, { label: 'next frame', click: () => step(1) });
  stage.onFrame((dt, t) => {
    screen.uniforms.uTime.value = t;
    knob.scale.setScalar(damp(knob.scale.x, knobTo, 14, dt));
  });

  const keys = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', keys);
  return () => removeEventListener('keydown', keys);
}

/* ---------- still us: the contact sheet ---------- */

function contactSheet(stage, app, index) {
  const roll = ROLLS[index];
  stage.view({ pos: [0.5, 7.9, 3.9], target: [0.5, 0, -0.05], fov: 36 });
  stage.light({ pos: [0.5, 8.5, 2.2], target: [0.4, 0, -0.2], intensity: 160, angle: 0.7 });
  gsap.from(stage.rig, { py: 9.1, pz: 4.6, duration: 1.4, ease: 'power3.out' });

  const strip = standingStrip(stage, index, { pulled: 0.6, min: 0.6, x0: -3.1, z: -2.05 });
  gsap.to(strip, { pulled: 6.8, duration: 2.2, delay: 0.2, ease: 'power3.out' });
  dragToPull(stage, strip);

  // the sheet: two rows of four frames, printed as small positives
  const W = 2048, H = 1380;
  const [c, g] = canvas(W, H);
  const tex = canvasTexture(c);
  const cells = [];
  const fw = 360, fh = 470, gap = 28, left = 196;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const i = row * 4 + col;
      cells.push({ i, x: left + col * (fw + gap), y: 200 + row * (fh + 150), w: fw, h: fh });
    }
  }
  const marks = new Map(); // frame index -> { circle, heart }
  for (const i of app.state.circled) marks.set(i, { circle: 1, heart: app.state.hearts.has(i) ? 1 : 0, seed: i * 31 + 5 });
  for (const i of app.state.hearts) if (!marks.has(i)) marks.set(i, { circle: 0, heart: 1, seed: i * 31 + 5 });
  let hoverCell = -1;

  const draw = () => {
    g.fillStyle = '#f2ece0';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#3b332c';
    g.font = `500 26px ${FONT.mono}`;
    g.fillText(`${roll.name.toUpperCase()} · ROLL ${roll.no} · 400`, left, 120);
    g.textAlign = 'right';
    g.fillText('SHEET 1 / 3', W - left, 120);
    g.textAlign = 'left';
    for (let row = 0; row < 2; row++) {
      const y = cells[row * 4].y;
      g.fillStyle = '#141110';
      g.fillRect(left - 40, y - 56, 4 * (fw + gap) + 52, fh + 112);
      g.fillStyle = '#e8e2d6';
      for (let x = left - 30; x < left + 4 * (fw + gap); x += 46) {
        g.fillRect(x, y - 44, 22, 26);
        g.fillRect(x, y + fh + 18, 22, 26);
      }
    }
    for (const cell of cells) {
      const f = roll.frames[cell.i];
      const src = photoSource(index, cell.i, f);
      if (src.width) g.drawImage(src, cell.x, cell.y, cell.w, cell.h);
      if (cell.i === hoverCell) {
        g.fillStyle = 'rgba(255,240,220,0.14)';
        g.fillRect(cell.x, cell.y, cell.w, cell.h);
      }
      g.fillStyle = '#d7a45a';
      g.font = `500 18px ${FONT.mono}`;
      g.fillText(`${cell.i + 1}A`, cell.x + 6, cell.y + fh + 74);
    }
    for (const [i, m] of marks) {
      const cell = cells[i];
      if (m.circle > 0) handLoop(g, cell.x + fw / 2, cell.y + fh / 2, fw * 0.52, fh * 0.5, m.circle, m.seed, { width: 7 });
      if (m.heart > 0) handHeart(g, cell.x + fw + 4, cell.y + 30, 74, m.heart, { width: 7 });
    }
    tex.needsUpdate = true;
  };
  draw();

  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4.7, (4.7 * H) / W), new THREE.MeshStandardMaterial({ map: tex, color: '#cfc8bc', roughness: 0.92, dithering: true }));
  sheet.rotation.set(-Math.PI / 2, 0, 0.035);
  sheet.position.set(0.15, 0.012, 0.75);
  sheet.receiveShadow = true;
  stage.world.add(sheet);

  // tools: markers circle a frame to print it, the pencil draws a heart
  const tools = [
    { kind: 'red', tool: 'circle', pos: [3.25, 0.07, 0.55], rot: 0.08, label: 'red pen · circle to print' },
    { kind: 'white', tool: 'circle', pos: [3.65, 0.07, 0.62], rot: -0.06, label: 'marker · circle to print' },
    { kind: 'pencil', tool: 'heart', pos: [4.05, 0.05, 0.5], rot: 0.12, label: 'pencil · draw a heart' },
  ];
  let tool = 'circle';
  let active = 0;
  const pens = tools.map((t, k) => {
    const p = pen(t.kind);
    p.rotation.set(Math.PI / 2 - 0.1, 0, t.rot);
    p.position.set(...t.pos);
    p.userData.h = 0;
    stage.world.add(p);
    stage.pick(p, {
      label: t.label,
      enter: () => (p.userData.hover = 1),
      leave: () => (p.userData.hover = 0),
      click: () => {
        tool = t.tool;
        active = k;
      },
    });
    return p;
  });
  const guides = [
    stage.anchor(new THREE.Vector3(3.3, 0.1, 1.5), 'circle = print', { dy: 34, side: 'up' }),
    stage.anchor(new THREE.Vector3(4.1, 0.1, 1.45), 'heart = love it', { dx: 30, dy: 30, side: 'right' }),
  ];
  stage.onFrame((dt, t) => {
    pens.forEach((p, k) => {
      const to = (k === active ? 0.3 + Math.sin(t * 2) * 0.03 : 0) + (p.userData.hover ? 0.08 : 0);
      p.userData.h = damp(p.userData.h, to, 10, dt);
      p.position.y = tools[k].pos[1] + p.userData.h;
    });
  });

  let animating = 0;
  const animate = (m, key, to) => {
    animating++;
    gsap.to(m, { [key]: to, duration: to ? 0.9 : 0.25, ease: to ? 'power1.inOut' : 'none', onUpdate: draw, onComplete: () => animating-- });
  };

  const sync = () => {
    for (const it of strip.items) gsap.to(it.mat.uniforms.uNeg, { value: app.state.circled.has(it.i) ? 0 : 1, duration: 1.2 });
    const n = app.state.circled.size;
    hud.setCount(`${n} TO PRINT`);
    hud.say(roll.hint, n ? { label: COPY.toDarkroom, run: () => app.go('lightbox') } : null);
  };
  sync();

  const cellAt = (hit) => {
    if (!hit?.uv) return null;
    const px = hit.uv.x * W, py = (1 - hit.uv.y) * H;
    return cells.find((q) => px > q.x - 30 && px < q.x + q.w + 30 && py > q.y - 40 && py < q.y + q.h + 40) ?? null;
  };

  stage.pick(sheet, {
    cursor: 'crosshair',
    label: (hit) => {
      const cell = cellAt(hit);
      if (!cell) return null;
      if (tool === 'heart') return app.state.hearts.has(cell.i) ? 'rub out the heart' : 'draw a heart';
      return app.state.circled.has(cell.i) ? 'un-circle' : 'circle to print';
    },
    over: (hit) => {
      const i = cellAt(hit)?.i ?? -1;
      if (i !== hoverCell) {
        hoverCell = i;
        if (!animating) draw();
      }
    },
    leave: () => {
      hoverCell = -1;
      if (!animating) draw();
    },
    click: (hit) => {
      const cell = cellAt(hit);
      if (!cell) return;
      for (const gd of guides) gd.hide();
      const m = marks.get(cell.i) ?? { circle: 0, heart: 0, seed: cell.i * 31 + 5 };
      marks.set(cell.i, m);
      if (tool === 'circle') {
        const on = !app.state.circled.has(cell.i);
        on ? app.state.circled.add(cell.i) : app.state.circled.delete(cell.i);
        animate(m, 'circle', on ? 1 : 0);
        sync();
      } else {
        const on = !app.state.hearts.has(cell.i);
        on ? app.state.hearts.add(cell.i) : app.state.hearts.delete(cell.i);
        animate(m, 'heart', on ? 1 : 0);
      }
    },
  });
  for (const it of strip.items) stage.pick(it.seg, { ...hoverLift(it), label: () => (app.state.circled.has(it.i) ? 'to print' : null) });
}
