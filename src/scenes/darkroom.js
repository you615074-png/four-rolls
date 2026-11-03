import * as THREE from 'three';
import { ROLLS, COPY, NOTES } from '../content.js';
import { hud } from '../hud.js';
import { FILM, bottle, clip, clothesline, lightBox, loupe, paperStack, pen, stripSegment, tray } from '../props.js';
import { FONT, canvas, canvasTexture, cardTexture, damp, photoMaterial, photoTexture, photoURL, wrapText } from '../util.js';

const gsap = window.gsap;
const STILL = 3;

/** The frames circled on the contact sheet, or a default handful. */
export function selectedFrames(app) {
  const picked = [...app.state.circled].sort((a, b) => a - b);
  return (picked.length ? picked : [0, 2, 5, 7]).slice(0, NOTES.length);
}

function darkroomProps(stage) {
  const t = tray();
  t.group.position.set(0.3, 0, -3.1);
  t.group.rotation.y = -0.04;
  stage.world.add(t.group);
  const bottles = [['Dev', '#1c2a20'], ['Stop', '#171717'], ['Fix', '#1d2a22'], ['Rinse', '#141818']];
  const spots = [[3.05, -3.6], [3.7, -3.05], [3.25, -2.45], [3.95, -2.0]];
  bottles.forEach(([name, color], i) => {
    const b = bottle(name, color);
    b.position.set(spots[i][0], 0, spots[i][1]);
    b.rotation.y = -0.4 + i * 0.3;
    stage.world.add(b);
  });
  const stack = paperStack(`paper × ${NOTES.length}`);
  stack.position.set(-2.55, 0, -2.6);
  stack.rotation.y = 0.12;
  stage.world.add(stack);
  return { tray: t, stack };
}

/* ---------- scene 05: the light box and the loupe ---------- */

export function lightboxScene(stage, app) {
  const picks = selectedFrames(app);
  const seen = new Set();
  const roll = ROLLS[STILL];
  hud.set({ scene: 'SCENE 05 · THE LIGHT BOX', count: `0 OF ${picks.length} SEEN`, back: true });
  hud.say(COPY.lightbox);
  stage.parallaxAmount = 0.12;
  const home = { px: 0.2, py: 6.6, pz: 4.4, tx: 0.2, ty: 0, tz: -0.5, fov: 36 };
  stage.view({ pos: [home.px, home.py, home.pz], target: [home.tx, home.ty, home.tz], fov: home.fov });
  stage.light({ pos: [0.6, 8, 1], target: [0.2, 0, -1], intensity: 90, angle: 0.8, hemi: 0.45 });
  gsap.from(stage.rig, { py: 7.6, pz: 5.4, duration: 1.4, ease: 'power3.out' });

  darkroomProps(stage);
  const box = lightBox();
  box.group.position.set(0, 0, 0.35);
  stage.world.add(box.group);

  // a slip of paper and the red pen
  const slip = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.55),
    new THREE.MeshStandardMaterial({
      map: cardTexture({ w: 512, h: 216, bg: '#efe6d0', lines: [
        { text: 'STILL US · KEEPERS', font: `500 20px ${FONT.mono}`, x: 26, y: 50, color: '#6b5b4b' },
        { text: picks.map((i) => `${i + 1}A`).join('  '), font: `40px ${FONT.hand}`, x: 26, y: 130, color: '#b0281c' },
      ] }),
      roughness: 0.9,
    }),
  );
  slip.rotation.set(-Math.PI / 2, 0, 0.18);
  slip.position.set(-3.05, 0.01, 0.15);
  slip.receiveShadow = true;
  stage.world.add(slip);
  const rp = pen('red');
  rp.rotation.set(Math.PI / 2, 0, 1.2);
  rp.position.set(3.1, 0.07, 1.2);
  stage.world.add(rp);

  // frames laid on the glass, as cut strips
  const top = box.topY + 0.005;
  const scale = picks.length > 3 ? 0.78 : 1.0;
  const cols = Math.min(3, picks.length);
  const slots = picks.map((frameIndex, k) => {
    const row = Math.floor(k / cols), col = k % cols;
    const rows = Math.ceil(picks.length / cols);
    const x = (col - (cols - 1) / 2) * FILM.pitch * scale * 1.18;
    const z = 0.35 + (row - (rows - 1) / 2) * FILM.height * scale * 0.95;
    const g = new THREE.Group();
    const seg = stripSegment();
    g.add(seg);
    const f = roll.frames[frameIndex];
    const mat = photoMaterial(photoTexture(STILL, frameIndex, f), { bright: 1.18 });
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(FILM.imgW, FILM.imgH), mat);
    photo.position.z = 0.003;
    g.add(photo);
    g.scale.setScalar(scale);
    g.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.06);
    g.position.set(x, top + k * 0.0005, z);
    stage.world.add(g);
    return { g, frameIndex, frame: f, x, z };
  });

  // the loupe follows the pointer over the glass
  const L = loupe();
  stage.world.add(L.group);
  L.group.position.set(1.6, top, 1.25);
  const lensMat = photoMaterial(new THREE.CanvasTexture(canvas(4, 4)[0]), { bright: 1.25 });
  const lensDark = L.lens.material;
  let over = null;
  const zoomCrop = (slot) => {
    lensMat.uniforms.uMap.value = photoTexture(STILL, slot.frameIndex, slot.frame);
    lensMat.uniforms.uCrop.value.set(0.25, 0.3, 0.5, 0.4);
    L.lens.material = lensMat;
  };

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.9), new THREE.MeshBasicMaterial({ visible: false }));
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(0, top + 0.01, 0.35);
  stage.world.add(glass);
  stage.pick(glass, {
    cursor: 'none',
    label: () => (over ? (seen.has(over.frameIndex) ? 'look again' : 'look closer') : 'slide onto a frame'),
    click: () => over && look(over),
  });
  const guide = stage.anchor(new THREE.Vector3(slots[0].x, top, slots[0].z - 0.75), 'slide the loupe here', { dy: -6 });
  const target = new THREE.Vector3(1.6, top, 1.25);
  let raise = 0;
  stage.onFrame((dt, t) => {
    const p = stage.pointOnPlane(top);
    if (p && hud.zoom.hidden) {
      p.x = THREE.MathUtils.clamp(p.x, -2.0, 2.0);
      p.z = THREE.MathUtils.clamp(p.z, -0.85, 1.6);
      const near = slots.find((s) => Math.abs(s.x - p.x) < 0.42 && Math.abs(s.z - p.z) < 0.6);
      if (near !== over) {
        over = near ?? null;
        if (over) zoomCrop(over);
        else L.lens.material = lensDark;
      }
      target.set(over ? THREE.MathUtils.lerp(p.x, over.x, 0.6) : p.x, top + 0.02, over ? THREE.MathUtils.lerp(p.z, over.z, 0.6) : p.z);
    }
    // the loupe glides after the pointer and lifts a little when it finds a frame
    raise = damp(raise, over ? 0.08 + Math.sin(t * 3) * 0.01 : 0, 10, dt);
    L.group.position.x = damp(L.group.position.x, target.x, 12, dt);
    L.group.position.z = damp(L.group.position.z, target.z, 12, dt);
    L.group.position.y = target.y + raise;
    if (over) {
      const dx = L.group.position.x - over.x, dz = L.group.position.z - over.z;
      lensMat.uniforms.uCrop.value.set(0.27 + dx * 0.35, 0.3 - dz * 0.25, 0.46, 0.4);
    }
  });

  const sticker = (slot) => {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshBasicMaterial({ color: '#d0261c' }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(slot.x + 0.3, top + 0.006, slot.z - 0.52);
    stage.world.add(dot);
    gsap.from(dot.scale, { x: 0.01, y: 0.01, duration: 0.5, ease: 'back.out(3)' });
  };

  const look = (slot) => {
    guide.hide();
    const v = L.group.position.clone();
    v.y += 0.6;
    v.project(stage.camera);
    const r = stage.renderer.domElement.getBoundingClientRect();
    const from = { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    gsap.to(stage.rig, { px: L.group.position.x, py: 2.2, pz: L.group.position.z + 0.6, tx: L.group.position.x, ty: 0, tz: L.group.position.z, duration: 0.9, ease: 'power3.inOut' });
    hud.openZoom(photoURL(STILL, slot.frameIndex, slot.frame), from, () => {
      gsap.to(stage.rig, { ...home, duration: 0.9, ease: 'power3.inOut' });
      if (!seen.has(slot.frameIndex)) sticker(slot);
      seen.add(slot.frameIndex);
      hud.setCount(`${seen.size} OF ${picks.length} SEEN`);
      hud.say(seen.size === picks.length ? null : COPY.lightbox, { label: COPY.printThem, run: () => app.go('tray') });
    });
  };
}

/* ---------- scene 06: the tray and the line ---------- */

function noteTexture(frameIndex, k) {
  const note = NOTES[k % NOTES.length];
  const [c, g] = canvas(600, 760);
  g.fillStyle = '#f4f0e6';
  g.fillRect(0, 0, 600, 760);
  g.fillStyle = '#9a9086';
  g.font = `500 20px ${FONT.mono}`;
  g.fillText(`STILL US  ·  FRAME ${String(frameIndex + 1).padStart(2, '0')}`, 40, 66);
  g.fillStyle = '#2a2420';
  g.font = `64px ${FONT.hand}`;
  g.fillText(note.date, 40, 170);
  g.font = `44px ${FONT.hand}`;
  wrapText(g, note.text, 40, 250, 520, 54);
  return canvasTexture(c);
}

function makePrint(frameIndex, k) {
  const g = new THREE.Group();
  const roll = ROLLS[STILL];
  const W = 0.9, H = 1.2;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), photoMaterial(photoTexture(STILL, frameIndex, roll.frames[frameIndex]), { mono: 1, dev: 0, paper: '#f1ece0' }));
  front.material.uniforms.uCrop.value.set(-0.06, -0.05, 1.12, 1.1);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: noteTexture(frameIndex, k), color: '#e4ddd0' }));
  back.rotation.y = Math.PI;
  back.position.z = -0.0035;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.002), new THREE.MeshStandardMaterial({ color: '#efe9dc' }));
  edge.position.z = -0.0015;
  front.position.z = 0.001;
  g.add(edge, front, back);
  g.traverse((m) => m.isMesh && (m.castShadow = true));
  return { g, front, mat: front.material };
}

export function trayScene(stage, app) {
  const picks = selectedFrames(app);
  const n = picks.length;
  hud.set({ scene: 'SCENE 06 · THE TRAY', count: `0 OF ${n} DRY`, back: true });
  hud.say(COPY.trayStart);
  stage.parallaxAmount = 0.1;
  stage.view({ pos: [0.3, 4.6, 3.3], target: [0.3, 1.25, -3.4], fov: 38 });
  stage.light({ pos: [0.5, 7.5, -1.2], target: [0.3, 0, -3.3], intensity: 140, angle: 0.75, hemi: 0.4 });

  const { tray: t, stack } = darkroomProps(stage);
  const lineY = 3.05, lineZ = -4.6;
  const line = clothesline(10);
  line.position.set(0.3, lineY, lineZ);
  stage.world.add(line);

  const spacing = 1.18;
  const slot = (k) => new THREE.Vector3(0.3 + (k - (n - 1) / 2) * spacing, lineY - 0.66, lineZ + 0.02);
  const hung = [];
  let busy = false;
  let reading = null;

  const updateHint = () => {
    if (hung.length < n) hud.say(hung.length ? COPY.next : COPY.trayStart);
    else {
      hud.say(COPY.readBack);
      hud.sideNote(`<b>${COPY.allDry}</b><span>${COPY.toWall} →</span>`, () => app.go('wall'));
    }
  };

  const stackGuide = stage.anchor(new THREE.Vector3(stack.position.x, 0.2, stack.position.z), 'take a sheet', { dy: -18 });
  let bath = null; // the sheet currently in the developer

  const develop = () => {
    if (busy || hung.length >= n || reading) return;
    busy = true;
    stackGuide.hide();
    const k = hung.length;
    const frameIndex = picks[k];
    const p = makePrint(frameIndex, k);
    stage.world.add(p.g);
    p.g.position.copy(stack.position).setY(0.14);
    p.g.rotation.set(-Math.PI / 2, 0, 0.12);
    hud.say(COPY.wait);
    const inTray = t.group.position.clone().setY(t.liquidY + 0.005);
    gsap.timeline({ onComplete: () => (bath = { p, k, frameIndex, inTray, progress: 0, boost: 0 }) })
      .to(p.g.position, { x: (stack.position.x + inTray.x) / 2, y: 1.1, z: (stack.position.z + inTray.z) / 2, duration: 0.55, ease: 'power2.out' })
      .to(p.g.position, { x: inTray.x, y: inTray.y, z: inTray.z, duration: 0.6, ease: 'power2.in' })
      .to(p.g.rotation, { z: -0.04, duration: 1.1, ease: 'power2.inOut' }, 0)
      .fromTo(t.liquid.position, { y: 0.215 }, { y: 0.2, duration: 0.9, ease: 'elastic.out(1, 0.3)' }, 1.1);
  };

  // developing: time does it slowly, rocking the tray hurries it along
  stage.onFrame((dt, time) => {
    for (const e of hung) {
      if (e.moving || reading === e) continue;
      e.sway = damp(e.sway ?? 0, e.hover ? 0.07 : 0, 6, dt);
      e.g.rotation.z = e.home.rot.z + Math.sin(time * 1.3 + e.k) * 0.012 + Math.sin(time * 9) * e.sway * 0.4;
    }
    if (!bath) return;
    const b = bath;
    b.boost = damp(b.boost, 0, 2.2, dt);
    b.progress = Math.min(1, b.progress + (dt / 6) * (1 + b.boost));
    b.p.mat.uniforms.uDev.value = b.progress;
    b.p.mat.uniforms.uTime.value = time;
    b.p.g.position.y = b.inTray.y + Math.sin(time * 2.4) * 0.004 * (1 + b.boost);
    b.p.g.rotation.z = -0.04 + Math.sin(time * 1.7) * 0.015 * (1 + b.boost);
    if (b.progress >= 1) {
      bath = null;
      hangUp(b);
    }
  });

  stage.pick(t.group, {
    label: () => (bath ? 'rock the tray' : null),
    cursor: () => (bath ? 'pointer' : 'default'),
    click: () => {
      if (!bath) return;
      bath.boost = Math.min(bath.boost + 2.4, 7);
      gsap.fromTo(t.group.rotation, { z: 0.045 * (Math.random() > 0.5 ? 1 : -1) }, { z: 0, duration: 1.1, ease: 'elastic.out(1, 0.3)' });
      gsap.fromTo(t.liquid.position, { y: 0.225 }, { y: 0.2, duration: 1.0, ease: 'elastic.out(1, 0.25)' });
    },
  });

  const hangUp = ({ p, k, frameIndex }) => {
    const s = slot(k);
    gsap.timeline()
      .to(p.g.position, { y: 1.6, duration: 0.6, ease: 'power2.out' })
      .to(p.g.position, { x: s.x, y: s.y, z: s.z, duration: 1.0, ease: 'power3.inOut' })
      .to(p.g.rotation, { x: 0, y: 0, z: (Math.random() - 0.5) * 0.05, duration: 1.0, ease: 'power3.inOut' }, '<')
      .add(() => {
        const c = clip();
        c.position.set(s.x, lineY - 0.06, s.z + 0.03);
        stage.world.add(c);
        gsap.from(c.position, { y: lineY + 0.4, duration: 0.3, ease: 'power2.out' });
        const entry = { ...p, k, frameIndex, home: { pos: s.clone(), rot: p.g.rotation.clone() } };
        hung.push(entry);
        stage.pick(p.g, {
          label: () => (reading === entry ? 'hang it back' : 'read the back'),
          enter: () => (entry.hover = true),
          leave: () => (entry.hover = false),
          click: () => toggleRead(entry),
        });
        hud.setCount(`${hung.length} OF ${n} DRY`);
        busy = false;
        updateHint();
      });
  };

  const toggleRead = (e) => {
    if (busy) return;
    if (reading && reading !== e) return hangBack(reading);
    if (reading === e) return hangBack(e);
    reading = e;
    e.moving = true;
    const cam = stage.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const spot = cam.position.clone().add(dir.multiplyScalar(2.5));
    const look = new THREE.Object3D();
    look.position.copy(spot);
    look.lookAt(cam.position);
    look.rotateY(Math.PI);
    gsap.to(e.g.position, { x: spot.x, y: spot.y, z: spot.z, duration: 0.85, ease: 'power3.inOut' });
    gsap.to(e.g.rotation, { x: look.rotation.x, y: look.rotation.y, z: look.rotation.z, duration: 1.1, ease: 'power3.inOut', onComplete: () => (e.moving = false) });
    hud.say(COPY.hangBack);
  };

  const hangBack = (e) => {
    reading = null;
    gsap.to(e.g.position, { x: e.home.pos.x, y: e.home.pos.y, z: e.home.pos.z, duration: 0.85, ease: 'power3.inOut' });
    e.moving = true;
    gsap.to(e.g.rotation, { x: e.home.rot.x, y: e.home.rot.y, z: e.home.rot.z, duration: 0.85, ease: 'power3.inOut', onComplete: () => (e.moving = false) });
    updateHint();
  };

  stage.pick(stack, {
    label: () => (hung.length + (busy ? 1 : 0) < n ? 'take a sheet' : null),
    click: develop,
    enter: () => gsap.to(stack.position, { y: 0.06, duration: 0.25 }),
    leave: () => gsap.to(stack.position, { y: 0, duration: 0.3 }),
  });
  stage.onEmptyClick = () => reading && hangBack(reading);
  return () => hud.sideNote(null);
}
