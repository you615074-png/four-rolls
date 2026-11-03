import * as THREE from 'three';
import { ROLLS, COPY, NOTES } from '../content.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { SET, buildDarkroom } from '../darkroomSet.js';
import { FILM, bottle, clip, clothesline, lightBox, loupe, paperStack, pen, stripSegment, tray } from '../props.js';
import { FONT, canvas, canvasTexture, cardTexture, damp, glowTexture, photoMaterial, photoTexture, photoThumb, photoURL, wrapText } from '../util.js';

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
  let picks = selectedFrames(app);
  const seen = new Set();
  const roll = ROLLS[STILL];
  hud.set({ scene: 'SCENE 05 · THE LIGHT BOX', count: `0 OF ${picks.length} SEEN`, back: true });
  stage.parallaxAmount = 0.12;
  const home = { px: 0.2, py: 6.0, pz: 3.9, tx: 0.2, ty: 0, tz: -0.35, fov: 36 };
  stage.view({ pos: [home.px, home.py, home.pz], target: [home.tx, home.ty, home.tz], fov: home.fov });
  stage.light({ pos: [0.6, 8, 1], target: [0.2, 0, -1], intensity: 90, angle: 0.8, hemi: 0.45 });
  gsap.from(stage.rig, { py: 7.6, pz: 5.4, duration: 1.4, ease: 'power3.out' });

  darkroomProps(stage);
  const box = lightBox();
  box.group.position.set(0, 0, 0.35);
  stage.world.add(box.group);

  // a slip of paper and the red pen
  const slipMap = () => cardTexture({ w: 512, h: 216, bg: '#efe6d0', lines: [
    { text: 'STILL US · KEEPERS', font: `500 20px ${FONT.mono}`, x: 26, y: 50, color: '#6b5b4b' },
    { text: picks.map((i) => `${i + 1}A`).join('  '), font: `40px ${FONT.hand}`, x: 26, y: 130, color: '#b0281c' },
  ] });
  const slip = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.55), new THREE.MeshStandardMaterial({ map: slipMap(), roughness: 0.9 }));
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
  let slots = [];
  const lay = (animate) => {
    const scale = picks.length > 3 ? 0.78 : 1.0;
    const cols = Math.min(3, picks.length);
    const rows = Math.ceil(picks.length / cols);
    slots = picks.map((frameIndex, k) => {
      const row = Math.floor(k / cols), col = k % cols;
      const x = (col - (cols - 1) / 2) * FILM.pitch * scale * 1.18;
      const z = 0.35 + (row - (rows - 1) / 2) * FILM.height * scale * 0.95;
      const g = new THREE.Group();
      g.add(stripSegment());
      const f = roll.frames[frameIndex];
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(FILM.imgW, FILM.imgH), photoMaterial(photoTexture(STILL, frameIndex, f), { bright: 1.18 }));
      photo.position.z = 0.003;
      g.add(photo);
      g.scale.setScalar(scale);
      g.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.06);
      g.position.set(x, top + k * 0.0005, z);
      stage.world.add(g);
      if (animate) gsap.from(g.position, { y: top + 1.2, x: x + 2.5, duration: 0.8, delay: 0.08 * k, ease: 'power3.out' });
      return { g, frameIndex, frame: f, x, z, dot: null };
    });
  };
  lay(false);

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
    slot.dot = dot;
    sfx.pop();
    const sp = stage.toScreen(dot.position);
    hud.burst(sp.x, sp.y, { n: 8, spread: 40, color: '255,110,90' });
    gsap.from(dot.scale, { x: 0.01, y: 0.01, duration: 0.5, ease: 'back.out(3)' });
  };

  const prompt = () => {
    hud.setCount(`${seen.size} OF ${picks.length} SEEN`);
    hud.say(COPY.lightbox, { label: `${COPY.swap} ↻`, run: swap });
    hud.cta(COPY.printThem, () => app.go('tray'));
  };

  // pick different negatives: the old strips slide off the glass, the new ones slide on
  const swap = async () => {
    const result = await hud.choose({
      title: COPY.pickerTitle, sub: COPY.pickerSub, done: COPY.pickerDone, max: NOTES.length,
      items: roll.frames.map((f, i) => ({ src: photoThumb(STILL, i, f), no: `${i + 1}A`, title: f.title })),
      selected: picks,
    });
    if (!result || result.join() === picks.join()) return;
    const { circled, boxed } = app.state;
    for (const i of picks) if (!result.includes(i)) {
      circled.delete(i);
      boxed.add(i);
    }
    for (const i of result) {
      circled.add(i);
      boxed.delete(i);
    }
    picks = selectedFrames(app);
    for (const i of [...seen]) if (!picks.includes(i)) seen.delete(i);
    over = null;
    L.lens.material = lensDark;
    for (const old of slots) {
      const gone = [old.g, old.dot].filter(Boolean);
      gsap.to(old.g.position, { x: old.x - 3, y: top + 0.8, duration: 0.6, ease: 'power3.in', onComplete: () => gone.forEach((o) => {
        stage.world.remove(o);
        o.traverse((m) => m.isMesh && m.geometry.dispose());
      }) });
      old.dot?.scale.setScalar(0.01);
    }
    gsap.delayedCall(0.35, () => {
      lay(true);
      for (const sl of slots) if (seen.has(sl.frameIndex)) sticker(sl);
    });
    slip.material.map.dispose();
    slip.material.map = slipMap();
    sfx.paper();
    hud.toast('new negatives on the glass', { kicker: 'the light box', line: `${picks.length} to print`, hold: 1.6, sound: null });
    prompt();
  };
  prompt();

  const look = (slot) => {
    guide.hide();
    const v = L.group.position.clone();
    v.y += 0.6;
    v.project(stage.camera);
    const r = stage.renderer.domElement.getBoundingClientRect();
    const from = { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    gsap.to(stage.rig, { px: L.group.position.x, py: 2.2, pz: L.group.position.z + 0.6, tx: L.group.position.x, ty: 0, tz: L.group.position.z, duration: 0.9, ease: 'power3.inOut' });
    sfx.tick(0.6, 0.18);
    hud.openZoom(photoURL(STILL, slot.frameIndex, slot.frame), from, () => {
      gsap.to(stage.rig, { ...home, duration: 0.9, ease: 'power3.inOut' });
      if (!seen.has(slot.frameIndex)) {
        sticker(slot);
        seen.add(slot.frameIndex);
        if (seen.size === picks.length) hud.toast('every frame checked', { kicker: 'the light box', line: 'sharp enough to print', sound: 'success' });
      }
      prompt();
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

/** A wet print: curls a little at the bottom, shines while wet, dries matte. */
function makePrint(frameIndex, k) {
  const g = new THREE.Group();
  const roll = ROLLS[STILL];
  const W = 0.9, H = 1.2;
  const curl = (geo, sign, off) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (H / 2 - pos.getY(i)) / H; // 0 at the peg, 1 at the bottom edge
      pos.setZ(i, sign * (0.07 * t * t + 0.012 * Math.sin(pos.getX(i) * 3.4) * t) + off);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const front = new THREE.Mesh(
    curl(new THREE.PlaneGeometry(W, H, 6, 14), 1, 0.0015),
    photoMaterial(photoTexture(STILL, frameIndex, roll.frames[frameIndex]), { mono: 1, dev: 0, paper: '#f1ece0' }),
  );
  front.material.uniforms.uCrop.value.set(-0.07, -0.06, 1.14, 1.16);
  const back = new THREE.Mesh(curl(new THREE.PlaneGeometry(W, H, 6, 14), -1, 0.0015), new THREE.MeshStandardMaterial({ map: noteTexture(frameIndex, k), color: '#e9e2d6', roughness: 0.75 }));
  back.rotation.y = Math.PI;
  // the wet sheen: only reflections are added on top of the print, and they fade as it dries
  const sheen = new THREE.Mesh(
    curl(new THREE.PlaneGeometry(W, H, 6, 14), 1, 0.003),
    new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.12, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1.6 }),
  );
  g.add(front, back, sheen);
  front.castShadow = back.castShadow = true;
  back.receiveShadow = true;
  return { g, front, mat: front.material, sheen: sheen.material, W, H };
}

export function trayScene(stage, app) {
  const picks = selectedFrames(app);
  const n = picks.length;
  hud.set({ scene: 'SCENE 06 · THE TRAY', count: `0 OF ${n} DRY`, back: true });
  hud.say(COPY.trayStart);
  stage.parallaxAmount = 0.06;
  // one fixed view, as in the original: the line across the top, the tray below
  stage.view({ pos: [0.3, 4.3, 3.0], target: [0.3, 1.55, -3.6], fov: 40 });
  stage.light({ pos: [1.2, 7.2, -0.2], target: [0.3, 0, -3.4], intensity: 38, angle: 0.7, hemi: 0.12 });
  stage.hemi.color.set('#ff9a80');
  gsap.from(stage.rig, { py: 5.0, pz: 4.0, duration: 1.4, ease: 'power3.out' });

  const set = buildDarkroom(stage);
  const { tray: t, stack, timer: clock } = set;
  const sheet = stack.userData.sheet;
  // on a narrow screen the paper sits in front of the tray so it stays in view
  if (stage.camera.aspect < 1.15) stack.position.set(-0.6, 0, -1.2);

  const { lineZ } = SET;
  const spacing = 1.18;
  const slot = (k) => {
    const x = 0.3 + (k - (n - 1) / 2) * spacing;
    return new THREE.Vector3(x, set.lineAt(x) - 0.68, lineZ + 0.03);
  };
  const hung = [];
  let busy = false;
  let reading = null;
  let bath = null; // the sheet currently in the developer
  const slosh = { tilt: 0, to: 0, wave: 0, wv: 0, stir: 0 };

  // the bath surface: a grid of vertices nudged by the slosh and by ripples
  const lp = t.liquid.geometry.attributes.position;
  const rest = Float32Array.from(lp.array);
  const ripples = [];
  const ripple = (x, z, amp = 1) => ripples.push({ x, z, t: 0, amp });

  let doneOnce = false;
  const updateHint = () => {
    if (hung.length < n) {
      hud.say(COPY.next);
      return;
    }
    hud.say(COPY.readBack);
    if (!doneOnce) {
      doneOnce = true;
      gsap.delayedCall(1.2, () => hud.toast('all dry', { kicker: `${n} print${n > 1 ? 's' : ''} on the line`, line: 'tap one to read the back', sound: 'success' }));
    }
    hud.sideNote(COPY.allDry, COPY.toWall, () => app.go('wall'));
  };

  const stackGuide = stage.anchor(new THREE.Vector3(stack.position.x, 0.3, stack.position.z), 'take a sheet', { dy: -18 });
  let rockGuide = null;

  const develop = () => {
    if (busy || hung.length >= n || reading) return;
    busy = true;
    stackGuide.hide();
    const k = hung.length;
    const frameIndex = picks[k];
    const p = makePrint(frameIndex, k);
    p.sheen.opacity = 1;
    stage.world.add(p.g);
    const from = stack.localToWorld(new THREE.Vector3(0, 0.24, 0));
    p.g.position.copy(from);
    p.g.rotation.set(-Math.PI / 2, 0, 0.1);
    sfx.paper();
    hud.say(COPY.wait);
    hud.setCount(`PRINT ${k + 1} OF ${n} · 0%`);
    const inTray = t.group.position.clone().setY(t.floorY + 0.02);
    gsap.timeline({
      onComplete: () => {
        bath = { p, k, frameIndex, inTray, progress: 0 };
        if (!k) rockGuide = stage.anchor(new THREE.Vector3(t.group.position.x, 0.4, t.group.position.z + 1.25), '⟵ drag to rock ⟶', { dy: 14 });
      },
    })
      .to(p.g.position, { x: (from.x + inTray.x) / 2, y: 0.9, z: (from.z + inTray.z) / 2, duration: 0.5, ease: 'power2.out' })
      .to(p.g.position, { x: inTray.x, y: t.liquidY + 0.01, z: inTray.z, duration: 0.45, ease: 'power2.in' })
      .add(() => {
        // the sheet slaps the surface, then sinks to the ribs
        sfx.splash();
        slosh.wv += 2.4;
        slosh.stir = 1;
        ripple(0, 0, 1.6);
      })
      .to(p.g.position, { y: inTray.y, duration: 0.6, ease: 'power2.out' })
      .to(p.g.rotation, { z: -0.04, duration: 1.4, ease: 'power2.inOut' }, 0);
  };

  // rocking: drag side to side. The faster you rock, the faster the image comes up.
  let lastSlosh = 0;
  const rock = (d) => {
    if (!bath) return;
    rockGuide?.hide();
    slosh.to = THREE.MathUtils.clamp(slosh.to + d, -0.07, 0.07);
    slosh.stir = Math.min(slosh.stir + Math.abs(d) * 9, 5);
    const now = performance.now();
    if (now - lastSlosh > 380 && Math.abs(d) > 0.004) {
      lastSlosh = now;
      sfx.splash(0.05 + Math.min(0.1, Math.abs(d)));
      ripple(Math.sign(d) * -1.2, (Math.random() - 0.5) * 0.8, 0.6);
    }
  };
  stage.dragHandler = { label: null, move: (dx) => rock(dx * 0.0011) };

  // water dropping off a wet print onto the bench leaves a spot that slowly dries
  const spots = [];
  const spotMat = new THREE.MeshStandardMaterial({ color: '#000', roughness: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 2 });
  const fall = (from, floorY, onLand) => {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#cbb8a0', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.7 }));
    drop.scale.y = 1.5;
    drop.position.copy(from);
    stage.world.add(drop);
    gsap.to(drop.position, { y: floorY, duration: Math.sqrt(Math.max(0.02, from.y - floorY) / 4.9), ease: 'power2.in', onComplete: () => {
      stage.world.remove(drop);
      drop.geometry.dispose();
      drop.material.dispose();
      onLand?.(drop.position);
    } });
  };
  const drip = (p, floorY = t.liquidY) => {
    const from = p.g.localToWorld(new THREE.Vector3((Math.random() - 0.5) * p.W * 0.8, -p.H / 2, 0.07));
    fall(from, floorY, (at) => {
      if (floorY === t.liquidY) {
        slosh.wv += 0.2;
        ripple(at.x - t.group.position.x, at.z - t.group.position.z, 0.5);
        return;
      }
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.05 + Math.random() * 0.05, 16), spotMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.position.set(at.x, 0.003, at.z);
      stage.world.add(m);
      spots.push({ m, life: 1 });
    });
  };

  stage.onFrame((dt, time) => {
    for (const e of hung) {
      if (!e.moving && reading !== e) {
        e.sway = damp(e.sway ?? 0, e.hover ? 0.07 : 0, 6, dt);
        e.g.rotation.z = e.home.rot.z + Math.sin(time * 1.3 + e.k) * 0.012 + Math.sin(time * 9) * e.sway * 0.4;
        e.g.rotation.x = Math.sin(time * 0.9 + e.k * 2) * 0.03;
      }
      // drying: the shine goes, the drips slow down and stop
      e.wet = Math.max(0, e.wet - dt / 18);
      e.sheen.opacity = e.wet;
      e.sheen.roughness = 0.12 + (1 - e.wet) * 0.5;
      e.nextDrip -= dt;
      if (e.wet > 0.25 && e.nextDrip < 0 && reading !== e) {
        e.nextDrip = 0.5 + (1 - e.wet) * 3 + Math.random();
        drip(e, 0);
      }
    }
    for (let i = spots.length - 1; i >= 0; i--) {
      const s = spots[i];
      s.life -= dt / 14;
      s.m.material.opacity = Math.max(0, s.life);
      if (s.life <= 0) {
        stage.world.remove(s.m);
        s.m.geometry.dispose();
        s.m.material.dispose();
        spots.splice(i, 1);
      }
    }

    // tray tilt eases back to level; the liquid lags behind it like a spring
    slosh.to = damp(slosh.to, 0, 2.5, dt);
    slosh.tilt = damp(slosh.tilt, slosh.to, 9, dt);
    t.group.rotation.z = slosh.tilt;
    slosh.wv += (-slosh.wave * 30 - slosh.wv * 2.2 + (slosh.to - slosh.tilt) * 40) * dt;
    slosh.wave += slosh.wv * dt;
    slosh.stir = damp(slosh.stir, 0, 1.6, dt);
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].t += dt;
      if (ripples[i].t > 2.2) ripples.splice(i, 1);
    }
    for (let i = 0; i < lp.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1]; // plane space: y is -z in the tray
      let h = slosh.wave * x * 0.012 + Math.sin(x * 2.1 + time * 1.3) * Math.cos(y * 2.7 - time) * 0.0025;
      for (const r of ripples) {
        const d = Math.hypot(x - r.x, y + r.z);
        const front = r.t * 1.4;
        h += Math.sin((d - front) * 14) * Math.exp(-((d - front) ** 2) * 14) * 0.012 * r.amp * (1 - r.t / 2.2);
      }
      lp.setZ(i, h);
    }
    lp.needsUpdate = true;
    t.liquid.geometry.computeVertexNormals();
    set.safe.light.intensity = 30 + Math.sin(time * 3.3) * 0.5;

    if (!bath) {
      clock.set(0);
      return;
    }
    const b = bath;
    b.progress = Math.min(1, b.progress + (dt / 7) * (1 + slosh.stir));
    clock.set(b.progress * 60);
    b.p.mat.uniforms.uDev.value = b.progress;
    b.p.mat.uniforms.uTime.value = time;
    b.p.g.position.x = b.inTray.x - slosh.wave * 0.05;
    b.p.g.position.y = b.inTray.y + slosh.tilt * 0.4;
    b.p.g.rotation.z = -0.04 + Math.sin(time * 1.7) * 0.012 + slosh.wave * 0.03;
    hud.setCount(`PRINT ${b.k + 1} OF ${n} · ${Math.round(b.progress * 100)}%`);
    if (b.progress >= 1) {
      bath = null;
      hangUp(b);
    }
  });

  stage.pick(t.group, {
    label: () => (bath ? 'drag ⟷ to rock' : hung.length + (busy ? 1 : 0) < n ? 'take a sheet' : null),
    cursor: () => (bath ? 'ew-resize' : busy ? 'default' : 'pointer'),
    click: () => {
      if (!bath) return develop();
      rock(Math.random() > 0.5 ? 0.06 : -0.06);
    },
  });

  // lifted out with the tongs, held to drain, then pegged on the line
  const hangUp = ({ p, k, frameIndex }) => {
    const s = slot(k);
    rockGuide?.hide();
    gsap.fromTo(p.mat.uniforms.uBright, { value: 1.35 }, { value: 1, duration: 1.2, ease: 'power2.out' });
    hud.say('there it is');
    sfx.chime();
    const sp = stage.toScreen(p.g.getWorldPosition(new THREE.Vector3()));
    hud.burst(sp.x, sp.y, { n: 18, spread: 110 });
    const f = ROLLS[STILL].frames[frameIndex];
    hud.toast(f.title, { kicker: `print ${k + 1} of ${n} · ${f.date}`, line: k === n - 1 ? 'the last one' : 'came up beautifully', hold: 1.8, sound: null });
    ripple(0, 0, 1.2);
    gsap.timeline()
      .to(p.g.position, { y: 1.2, z: p.g.position.z + 0.2, duration: 0.7, ease: 'power2.out' })
      .to(p.g.rotation, { x: -0.08, z: 0, duration: 0.7, ease: 'power2.out' }, '<')
      .add(() => {
        sfx.splash(0.12);
        for (let d = 0; d < 7; d++) gsap.delayedCall(d * 0.11, () => drip(p));
      })
      .to({}, { duration: 0.75 })
      .to(p.g.position, { x: s.x, y: s.y, z: s.z, duration: 1.1, ease: 'power3.inOut' })
      .to(p.g.rotation, { x: 0, y: 0, z: (Math.random() - 0.5) * 0.05, duration: 1.1, ease: 'power3.inOut' }, '<')
      .add(() => {
        const c = clip();
        sfx.tick(0.55, 0.2);
        c.position.set(s.x, s.y + 0.62, s.z + 0.02);
        stage.world.add(c);
        gsap.from(c.position, { y: s.y + 1.0, duration: 0.3, ease: 'power2.out' });
        const entry = { ...p, k, frameIndex, wet: 1, nextDrip: 0.4, home: { pos: s.clone(), rot: p.g.rotation.clone() } };
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
    sfx.paper();
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
    enter: () => gsap.to(sheet.position, { y: sheet.userData.rest + 0.07, duration: 0.25, ease: 'power2.out' }),
    leave: () => gsap.to(sheet.position, { y: sheet.userData.rest, duration: 0.3 }),
  });
  stage.onEmptyClick = () => reading && hangBack(reading);
  return () => {
    stage.hemi.color.set('#ffd9c0');
    set.cleanup();
  };
}
