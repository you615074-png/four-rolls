import * as THREE from 'three';
import { ROLLS, COPY } from '../content.js';
import { hud } from '../hud.js';
import { CAN, FILM, canister, pen, slideViewer, stripSegment } from '../props.js';
import { FONT, canvas, canvasTexture, handHeart, handLoop, photoMaterial, photoSource, photoTexture } from '../util.js';

const gsap = window.gsap;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- the table: four rolls ---------- */

export function tableScene(stage, app) {
  hud.set({ scene: 'SCENE 04 · THE ROLLS', count: '4 ROLLS · 96 FRAMES', title: true });
  stage.view({ pos: [0.3, 9.4, 6.6], target: [0.3, 0, 0.5], fov: 34 });
  stage.light({ pos: [0.2, 9, 3.4], target: [0.3, 0, 0.3], intensity: 150, angle: 0.72 });
  stage.parallaxAmount = 0.18;

  const layout = [
    { x: -2.75, z: -0.95, yaw: 0.42, roll: 1.0 },
    { x: -0.75, z: 1.35, yaw: -0.38, roll: 0.75 },
    { x: 1.45, z: -1.55, yaw: 0.12, roll: 0.95 },
    { x: 3.35, z: 0.45, yaw: -0.52, roll: 0.85 },
  ];

  ROLLS.forEach((roll, i) => {
    const L = layout[i];
    const holder = new THREE.Group();
    const tilt = new THREE.Group();
    const can = canister(roll);
    can.rotation.y = L.roll;
    tilt.rotation.z = Math.PI / 2;
    tilt.position.set(CAN.h / 2, CAN.r + 0.03, 0);
    tilt.add(can);
    holder.add(tilt);
    holder.position.set(L.x, 0, L.z);
    holder.rotation.y = L.yaw;
    stage.world.add(holder);
    gsap.from(holder.position, { y: 0.5, duration: 0.9, delay: 0.08 * i, ease: 'bounce.out' });
    stage.pick(holder, {
      enter: () => gsap.to(holder.position, { y: 0.22, duration: 0.35, ease: 'power2.out' }),
      leave: () => gsap.to(holder.position, { y: 0, duration: 0.45, ease: 'power2.inOut' }),
      click: () => app.go('roll', { index: i }),
    });
  });

  // a red marker and a pencil left by the last roll
  const p1 = pen('red');
  p1.rotation.set(Math.PI / 2, 0, 0.5);
  p1.position.set(3.6, 0.07, 1.75);
  const p2 = pen('pencil');
  p2.rotation.set(Math.PI / 2, 0, -0.35);
  p2.position.set(4.2, 0.05, 1.55);
  stage.world.add(p1, p2);

  const ready = app.state.visited.size === ROLLS.length;
  hud.say(COPY.pickOne, ready ? { label: COPY.toDarkroom, run: () => app.go('lightbox') } : null);
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
    const back = photo.clone();
    back.material = photo.material;
    back.rotation.y = Math.PI;
    back.position.z = -0.004;
    seg.add(back);
    stage.world.add(seg);
    return { seg, photo, mat: photo.material, i, frame: f, lift: 0, out: false };
  });
  const strip = {
    can, items, pulled, min, max: roll.frames.length * FILM.pitch + 0.2,
    place(s) {
      return { x: mouth + s, y: FILM.height / 2 + 0.04, z: z + 0.06 * Math.sin(s * 0.8) - 0.004 * s * s, ry: -Math.atan(0.048 * Math.cos(s * 0.8) - 0.008 * s) };
    },
    layout() {
      for (const it of items) {
        if (it.out) continue;
        const s = strip.pulled - (it.i + 0.5) * FILM.pitch;
        it.seg.visible = s > -FILM.pitch * 0.55;
        const p = strip.place(s);
        it.seg.position.set(p.x, p.y + it.lift, p.z);
        it.seg.rotation.set(0, p.ry, 0);
      }
    },
  };
  stage.onFrame((dt, t) => {
    for (const it of items) it.mat.uniforms.uTime.value = t;
    strip.layout();
  });
  strip.layout();
  return strip;
}

function hoverLift(it) {
  return {
    enter: () => !it.out && gsap.to(it, { lift: 0.07, duration: 0.3 }),
    leave: () => gsap.to(it, { lift: 0, duration: 0.4 }),
  };
}

function dragToPull(stage, strip, onChange) {
  stage.dragHandler = {
    move: (dx) => {
      gsap.killTweensOf(strip, 'pulled');
      strip.pulled = clamp(strip.pulled + dx * 0.011, strip.min, strip.max);
      onChange?.();
    },
  };
}

export function rollScene(stage, app, { index }) {
  const roll = ROLLS[index];
  app.state.visited.add(index);
  hud.set({ scene: 'SCENE 04 · THE ROLLS', count: '4 ROLLS · 96 FRAMES', back: true });
  hud.say(roll.hint);
  stage.parallaxAmount = 0.1;
  if (roll.mode === 'contact') return contactSheet(stage, app, index);

  stage.view({ pos: [1.9, 2.2, 7.0], target: [1.9, 0.86, 0], fov: 34 });
  stage.light({ pos: [1.6, 7.5, 4.5], target: [1.8, 0.6, 0], intensity: 120, angle: 0.55 });
  gsap.from(stage.rig, { pz: 7.4, py: 2.4, duration: 1.2, ease: 'power3.out' });

  if (roll.mode === 'develop') developRoll(stage, index);
  else if (roll.mode === 'light') lightRoll(stage, index);
  else viewerRoll(stage, index);
}

/* Mature: pull the film out, tap a frame to develop it. */
function developRoll(stage, index) {
  const strip = standingStrip(stage, index, { pulled: 0.75, min: 0.6 });
  gsap.to(strip, { pulled: 1.6, duration: 1.4, delay: 0.5, ease: 'power2.out' });
  dragToPull(stage, strip);
  for (const it of strip.items) {
    stage.pick(it.seg, {
      ...hoverLift(it),
      click: () => {
        const to = it.mat.uniforms.uNeg.value > 0.5 ? 0 : 1;
        gsap.to(it.mat.uniforms.uNeg, { value: to, duration: 1.8, ease: 'power2.inOut' });
        gsap.fromTo(it.mat.uniforms.uBright, { value: 1.6 }, { value: 0.92, duration: 1.4, ease: 'power2.out' });
      },
    });
  }
}

function edgePrint(roll, it) {
  const [c, g] = canvas(256, 384);
  g.fillStyle = 'rgba(255,224,170,0.9)';
  g.font = `500 12px ${FONT.mono}`;
  g.fillText(`↑ ${String(it.i + 1).padStart(2, '0')}  ${it.frame.title.toUpperCase()}`, 26, 56);
  g.fillText(`${roll.name.toUpperCase()} 400  ·  ${roll.no}  ·  ${it.frame.date}`, 26, 340);
  const t = canvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(FILM.pitch, FILM.height), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.position.z = 0.006;
  return m;
}

function glowTexture() {
  const [c, g] = canvas(256, 256);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,246,228,1)');
  grad.addColorStop(0.35, 'rgba(255,226,190,0.45)');
  grad.addColorStop(1, 'rgba(255,200,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return canvasTexture(c);
}

/* slow days: pull one frame out and hold it up to the light. */
function lightRoll(stage, index) {
  const roll = ROLLS[index];
  const strip = standingStrip(stage, index, { pulled: 0.8, min: 0.8 });
  gsap.to(strip, { pulled: 5.6, duration: 1.8, delay: 0.3, ease: 'power3.out' });
  dragToPull(stage, strip);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(1.7, 1.6, 1.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  stage.world.add(glow);
  let held = null;

  const putBack = (it) => {
    held = null;
    gsap.to(glow.material, { opacity: 0, duration: 0.5 });
    gsap.to(it.mat.uniforms.uNeg, { value: 1, duration: 0.9 });
    gsap.to(it.mat.uniforms.uBright, { value: 0.92, duration: 0.6 });
    gsap.to(it.seg.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power3.inOut' });
    const s = strip.pulled - (it.i + 0.5) * FILM.pitch;
    const p = strip.place(s);
    gsap.to(it.seg.rotation, { y: p.ry, z: 0, duration: 0.8 });
    gsap.to(it.seg.position, {
      x: p.x, y: p.y, z: p.z, duration: 0.8, ease: 'power3.inOut',
      onComplete: () => {
        it.out = false;
        if (it.label) {
          it.seg.remove(it.label);
          it.label = null;
        }
      },
    });
  };

  const holdUp = (it) => {
    if (held) putBack(held);
    held = it;
    it.out = true;
    it.lift = 0;
    if (!it.label) it.seg.add((it.label = edgePrint(roll, it)));
    const target = new THREE.Vector3(stage.rig.tx - 0.2, 1.45, 1.55);
    glow.position.set(target.x + 0.15, target.y + 0.35, target.z - 0.5);
    gsap.to(glow.material, { opacity: 0.95, duration: 0.9, delay: 0.25 });
    gsap.to(it.seg.position, { x: target.x, y: target.y, z: target.z, duration: 0.9, ease: 'power3.inOut' });
    gsap.to(it.seg.rotation, { y: -0.08, z: 0.04, duration: 0.9, ease: 'power3.inOut' });
    gsap.to(it.seg.scale, { x: 1.28, y: 1.28, z: 1.28, duration: 0.9, ease: 'power3.inOut' });
    gsap.to(it.mat.uniforms.uNeg, { value: 0, duration: 1.4, delay: 0.35, ease: 'power2.inOut' });
    gsap.to(it.mat.uniforms.uBright, { value: 1.12, duration: 1.2, delay: 0.35 });
  };

  for (const it of strip.items) {
    stage.pick(it.seg, { ...hoverLift(it), click: () => (it.out ? putBack(it) : holdUp(it)) });
  }
  stage.onEmptyClick = () => held && putBack(held);
}

/* far away: a slide viewer; the lever feeds one frame at a time. */
function viewerRoll(stage, index) {
  const roll = ROLLS[index];
  const strip = standingStrip(stage, index, { pulled: 5.4, min: 5.4, z: -0.25 });
  for (const it of strip.items) it.mat.uniforms.uNeg.value = 1;
  const v = slideViewer();
  v.group.position.set(1.05, 0, 0.65);
  stage.world.add(v.group);
  const blank = new THREE.CanvasTexture(canvas(4, 4)[0]);
  const screen = photoMaterial(blank, { bright: 1.25 });
  screen.uniforms.uFlash.value = 0.85;
  v.screen.material = screen;
  let cur = -1;

  const show = (i) => {
    const f = roll.frames[i];
    screen.uniforms.uMap.value = photoTexture(index, i, f);
    gsap.fromTo(screen.uniforms.uFlash, { value: 1 }, { value: 0, duration: 0.8, ease: 'power2.out' });
    hud.setCaption({ small: `${f.date} · FRAME ${String(i + 1).padStart(2, '0')}`, title: f.title });
    gsap.to(strip.items[i].mat.uniforms.uNeg, { value: 0, duration: 1.0, delay: 0.3 });
  };

  stage.pick(v.lever, {
    click: () => {
      gsap.timeline().to(v.lever.rotation, { x: -0.9, duration: 0.18, ease: 'power2.in' }).to(v.lever.rotation, { x: 0, duration: 0.5, ease: 'back.out(3)' });
      cur = (cur + 1) % roll.frames.length;
      const target = cur === 0 ? 5.4 + FILM.pitch : strip.pulled + FILM.pitch;
      gsap.to(strip, { pulled: Math.min(target, strip.max), duration: 0.55, ease: 'power2.inOut' });
      show(cur);
    },
    enter: () => gsap.to(v.lever.position, { z: 0.26, duration: 0.2 }),
    leave: () => gsap.to(v.lever.position, { z: 0.2, duration: 0.2 }),
  });
  stage.onFrame((dt, t) => (screen.uniforms.uTime.value = t));
}

/* ---------- still us: the contact sheet ---------- */

function contactSheet(stage, app, index) {
  const roll = ROLLS[index];
  stage.view({ pos: [0.5, 7.9, 3.9], target: [0.5, 0, -0.05], fov: 36 });
  stage.light({ pos: [0.5, 8.5, 2.2], target: [0.4, 0, -0.2], intensity: 160, angle: 0.7 });
  gsap.from(stage.rig, { py: 8.9, pz: 4.3, duration: 1.2, ease: 'power3.out' });

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
      g.fillStyle = '#d7a45a';
      g.font = `500 18px ${FONT.mono}`;
      g.fillText(`${cell.i + 1}A`, cell.x + 6, cell.y + fh + 44 + 30);
    }
    for (const [i, m] of marks) {
      const cell = cells[i];
      if (m.circle > 0) handLoop(g, cell.x + fw / 2, cell.y + fh / 2, fw * 0.52, fh * 0.5, m.circle, m.seed, { width: 7 });
      if (m.heart > 0) handHeart(g, cell.x + fw + 4, cell.y + 30, 74, m.heart, { width: 7 });
    }
    tex.needsUpdate = true;
  };
  draw();

  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4.7, (4.7 * H) / W), new THREE.MeshStandardMaterial({ map: tex, color: '#cfc8bc', roughness: 0.92 }));
  sheet.rotation.set(-Math.PI / 2, 0, 0.035);
  sheet.position.set(0.15, 0.012, 0.75);
  sheet.receiveShadow = true;
  stage.world.add(sheet);

  // tools: red marker circles, white marker circles, pencil draws hearts
  const tools = [
    { kind: 'red', tool: 'circle', pos: [3.25, 0.07, 0.55], rot: 0.08 },
    { kind: 'white', tool: 'circle', pos: [3.65, 0.07, 0.62], rot: -0.06 },
    { kind: 'pencil', tool: 'heart', pos: [4.05, 0.05, 0.5], rot: 0.12 },
  ];
  let tool = 'circle';
  const pens = tools.map((t) => {
    const p = pen(t.kind);
    p.rotation.set(Math.PI / 2 - 0.1, 0, t.rot);
    p.position.set(...t.pos);
    stage.world.add(p);
    stage.pick(p, {
      click: () => {
        tool = t.tool;
        for (const q of pens) gsap.to(q.position, { y: q === p ? 0.3 : q.userData.y, duration: 0.35, ease: 'power2.out' });
      },
    });
    p.userData.y = t.pos[1];
    return p;
  });
  pens[0].position.y = 0.3;

  let animating = 0;
  const animate = (m, key, to) => {
    animating++;
    gsap.to(m, {
      [key]: to, duration: to ? 0.9 : 0.25, ease: to ? 'power1.inOut' : 'none', onUpdate: draw,
      onComplete: () => {
        animating--;
        if (!m.circle && !m.heart) marks.forEach((v, k) => v === m && marks.delete(k));
      },
    });
  };

  const syncStrip = () => {
    for (const it of strip.items) {
      const on = app.state.circled.has(it.i);
      gsap.to(it.mat.uniforms.uNeg, { value: on ? 0 : 1, duration: 1.2 });
    }
  };
  syncStrip();

  stage.pick(sheet, {
    cursor: 'crosshair',
    click: (hit) => {
      if (!hit.uv) return;
      const px = hit.uv.x * W, py = (1 - hit.uv.y) * H;
      const cell = cells.find((q) => px > q.x - 30 && px < q.x + q.w + 30 && py > q.y - 40 && py < q.y + q.h + 40);
      if (!cell) return;
      const m = marks.get(cell.i) ?? { circle: 0, heart: 0, seed: cell.i * 31 + 5 };
      marks.set(cell.i, m);
      if (tool === 'circle') {
        const on = !app.state.circled.has(cell.i);
        on ? app.state.circled.add(cell.i) : app.state.circled.delete(cell.i);
        animate(m, 'circle', on ? 1 : 0);
        syncStrip();
      } else {
        const on = !app.state.hearts.has(cell.i);
        on ? app.state.hearts.add(cell.i) : app.state.hearts.delete(cell.i);
        animate(m, 'heart', on ? 1 : 0);
      }
    },
  });
  for (const it of strip.items) stage.pick(it.seg, hoverLift(it));
  return () => animating;
}
