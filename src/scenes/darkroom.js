import * as THREE from 'three';
import { ROLLS, COPY, NOTES } from '../content.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { SET, buildDarkroom } from '../darkroomSet.js';
import { FILM, bottle, clip, clothesline, lightBox, loupe, paperStack, pen, stripSegment, tray } from '../props.js';
import { FONT, canvas, canvasTexture, cardTexture, damp, glowTexture, isWide, photoMaterial, photoTexture, photoThumb, photoURL, wrapText } from '../util.js';

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
  hud.set({ scene: 'THE LIGHT BOX', count: `0 OF ${picks.length} SEEN`, back: true });
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
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(FILM.imgW, FILM.imgH), photoMaterial(photoTexture(STILL, frameIndex, f), { bright: 1.18, turn: isWide(f) ? 1 : 0 }));
      photo.position.z = 0.003;
      g.add(photo);
      g.scale.setScalar(scale);
      g.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.06);
      g.position.set(x, top + k * 0.0005, z);
      stage.world.add(g);
      if (animate) gsap.from(g.position, { y: top + 1.2, x: x + 2.5, duration: 0.8, delay: 0.08 * k, ease: 'power3.out' });
      return { g, frameIndex, frame: f, x, z, scale, dot: null };
    });
  };
  lay(false);

  // the loupe follows the pointer over the glass
  const L = loupe();
  stage.world.add(L.group);
  L.group.position.set(1.6, top, 1.25);
  // what the lens shows is rendered from directly under it: a small top-down camera at the
  // loupe's own position looks at the glass, so it sees whatever is really there (the frame at
  // its real angle, its rebate and sprocket holes, the bare glass) and changes frame only when
  // the loupe itself has moved onto another
  const LENS_SPAN = 0.36;
  const lensRT = new THREE.WebGLRenderTarget(512, 512);
  const lensCam = new THREE.OrthographicCamera(-LENS_SPAN / 2, LENS_SPAN / 2, LENS_SPAN / 2, -LENS_SPAN / 2, 0.01, 4);
  lensCam.up.set(0, 0, -1);
  const lensMat = new THREE.MeshBasicMaterial({ map: lensRT.texture, color: new THREE.Color(1.15, 1.12, 1.08) });
  L.lens.material = lensMat;
  let over = null;
  const under = (x, z) => slots.find((s) => Math.abs(s.x - x) < FILM.pitch * s.scale * 0.5 && Math.abs(s.z - z) < FILM.height * s.scale * 0.5) ?? null;
  const renderLens = () => {
    const q = L.group.position;
    lensCam.position.set(q.x, top + 1.2, q.z);
    lensCam.lookAt(q.x, top, q.z);
    lensCam.updateMatrixWorld();
    L.group.visible = false;
    const r = stage.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(lensRT);
    r.render(stage.scene, lensCam);
    r.setRenderTarget(prev);
    L.group.visible = true;
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
      // the pointer pulls the loupe toward the middle of the frame it's pointing at
      const aimAt = slots.find((s) => Math.abs(s.x - p.x) < 0.42 && Math.abs(s.z - p.z) < 0.6);
      target.set(aimAt ? THREE.MathUtils.lerp(p.x, aimAt.x, 0.6) : p.x, top + 0.02, aimAt ? THREE.MathUtils.lerp(p.z, aimAt.z, 0.6) : p.z);
    }
    // but what it's over is decided by where the loupe actually is
    over = under(L.group.position.x, L.group.position.z);
    // the loupe glides after the pointer and lifts a little when it finds a frame
    raise = damp(raise, over ? 0.08 + Math.sin(t * 3) * 0.01 : 0, 10, dt);
    L.group.position.x = damp(L.group.position.x, target.x, 12, dt);
    L.group.position.z = damp(L.group.position.z, target.z, 12, dt);
    L.group.position.y = target.y + raise;
    renderLens();
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
    hud.cta(COPY.printThem, () => {
      // the chosen negatives go to the enlarger and the tray behind: look up and across to it
      gsap.to(stage.rig, { py: 4.6, pz: 1.8, ty: 0.4, tz: -2.9, duration: 0.7, ease: 'power2.in', overwrite: true });
      app.go('tray');
    });
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
  return () => lensRT.dispose();
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
  const [W, H] = isWide(roll.frames[frameIndex]) ? [1.12, 0.84] : [0.9, 1.2];
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
  hud.set({ scene: 'THE DARKROOM', count: `0 OF ${n} HUNG`, back: true });
  hud.say(COPY.trayStart);
  stage.parallaxAmount = 0.06;
  // one fixed view, as in the original: the line across the top, the tray below
  stage.view({ pos: [0.3, 4.3, 3.0], target: [0.3, 1.55, -3.6], fov: 40 });
  stage.light({ pos: [1.2, 7.2, -0.2], target: [0.3, 0, -3.4], intensity: 38, angle: 0.7, hemi: 0.12 });
  stage.hemi.color.set('#ff9a80');
  // arriving from the light box: still looking down at the bench, then up to the line and the tray
  gsap.from(stage.rig, { py: 5.4, pz: 4.4, ty: 0.6, duration: 1.4, ease: 'power3.out' });

  const set = buildDarkroom(stage);
  const { tray: t, stack, timer: clock, tongs } = set;
  const trayHome = t.group.position.clone();
  const TRAY_HALF = 1.65; // half the tray's width: it rocks on one bottom edge, then the other
  const tongRest = { pos: tongs.position.clone(), q: tongs.quaternion.clone() };
  const TONG_TIP = new THREE.Vector3(-0.62, 0, 0);
  const grip = { k: 0, p: null, jaw: 0 }; // how far the tongs have gone from rest to the print's corner, and how open
  const levelQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const tiltQ = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  const sheet = stack.userData.sheet;
  // on a narrow screen the paper sits in front of the tray so it stays in view, and the prints
  // hang closer together on the line. Crossing the breakpoint moves both, whatever is under way.
  const STACK = { wide: stack.position.clone(), narrow: new THREE.Vector3(-0.6, 0, -1.2) };
  const isNarrow = () => stage.camera.aspect < 1.15;
  const lay = { narrow: isNarrow(), k: isNarrow() ? 1 : 0 };
  stack.position.lerpVectors(STACK.wide, STACK.narrow, lay.k);
  const stackPoint = new THREE.Vector3();

  const { lineZ } = SET;
  const spacingNow = () => THREE.MathUtils.lerp(1.18, 0.98, lay.k);
  // every print hangs with its top edge just under the line, whatever its shape
  const slot = (k, H) => {
    const x = 0.3 + (k - (n - 1) / 2) * spacingNow();
    return new THREE.Vector3(x, set.lineAt(x) - 0.08 - H / 2, lineZ + 0.03);
  };
  // the whole line, the tray and the paper stay in frame
  const trayCorners = stage.corners(t.group, 0.05);
  stage.keep = () => {
    const pts = [...trayCorners];
    for (const k of [0, n - 1]) {
      const c = slot(k, 1.2);
      pts.push(c.clone().add(new THREE.Vector3(k ? 0.62 : -0.62, 0.75, 0)), c.clone().add(new THREE.Vector3(k ? 0.62 : -0.62, -0.62, 0)));
    }
    pts.push(stack.position.clone().add(new THREE.Vector3(-0.6, 0.2, 0.45)), stack.position.clone().add(new THREE.Vector3(0.6, 0, 0.45)));
    return pts;
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

  // a print counts as hung as soon as it's pegged, and as dry only once its shine has gone
  const dryCount = () => hung.filter((e) => e.wet <= 0).length;
  const countLine = () => {
    const dry = dryCount();
    return hung.length < n || dry < n ? `${hung.length} OF ${n} HUNG · ${dry} DRY` : `${n} OF ${n} DRY`;
  };
  let doneOnce = false;
  const updateHint = () => {
    if (hung.length < n) {
      hud.say(COPY.next);
      return;
    }
    if (dryCount() < n) {
      hud.say('all on the line, drying · tap one to read the back');
      return;
    }
    hud.say(COPY.readBack);
    if (!doneOnce) {
      doneOnce = true;
      hud.toast('all dry', { kicker: `${n} print${n > 1 ? 's' : ''} on the line`, line: 'tap one to read the back', sound: 'success' });
    }
    hud.sideNote(COPY.allDry, COPY.toWall, () => {
      // the dry prints come down off the line: the camera rises with them toward the wall
      gsap.to(stage.rig, { py: 3.4, pz: 0.4, ty: 2.4, duration: 0.7, ease: 'power2.in', overwrite: true });
      app.go('wall');
    });
  };

  stackPoint.set(stack.position.x, 0.3, stack.position.z);
  const stackGuide = stage.anchor(stackPoint, 'take a sheet', { dy: -18 });
  stage.onFrame(() => {
    if (isNarrow() !== lay.narrow) {
      lay.narrow = !lay.narrow;
      gsap.to(lay, {
        k: lay.narrow ? 1 : 0, duration: 1.0, ease: 'power2.inOut', overwrite: true,
        onUpdate: () => {
          // the prints already pegged slide along the line with their pegs
          for (const e of hung) {
            if (e.moving || reading === e) continue;
            const s = slot(e.k, e.H);
            const top = new THREE.Vector3(0, e.H / 2, 0).applyEuler(e.home.rot);
            e.home.pos.copy(s);
            e.peg.copy(s).add(top);
            e.clip.position.set(s.x, s.y + e.H / 2 + 0.02, s.z + 0.02);
          }
        },
      });
    }
    stack.position.lerpVectors(STACK.wide, STACK.narrow, lay.k);
    stackPoint.set(stack.position.x, 0.3, stack.position.z);
  });
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
        // from here it lies in the tray and rocks with it
        t.group.attach(p.g);
        bath = { p, k, frameIndex, inTray, progress: 0, local: p.g.position.clone(), rz: p.g.rotation.z };
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

  const hang = new THREE.Vector3();
  let lastDry = 0;
  stage.onFrame((dt, time) => {
    for (const e of hung) {
      if (!e.moving && reading !== e) {
        // it swings from the peg: turn about the top edge, not the middle of the sheet
        e.sway = damp(e.sway ?? 0, e.hover ? 0.07 : 0, 6, dt);
        e.g.rotation.z = e.home.rot.z + Math.sin(time * 1.3 + e.k) * 0.012 + Math.sin(time * 9) * e.sway * 0.4;
        e.g.rotation.x = Math.sin(time * 0.9 + e.k * 2) * 0.03;
        hang.set(0, e.H / 2, 0).applyEuler(e.g.rotation);
        e.g.position.copy(e.peg).sub(hang);
      }
      // drying: the shine goes, the drips slow down and stop
      e.wet = Math.max(0, e.wet - dt / 11);
      e.sheen.opacity = e.wet;
      e.sheen.roughness = 0.12 + (1 - e.wet) * 0.5;
      e.nextDrip -= dt;
      if (e.wet > 0.25 && e.nextDrip < 0 && reading !== e) {
        e.nextDrip = 0.5 + (1 - e.wet) * 3 + Math.random();
        drip(e, 0);
      }
    }
    if (dryCount() !== lastDry) {
      lastDry = dryCount();
      hud.setCount(countLine());
      if (!reading) updateHint();
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
    // the tray rocks on its bottom edge, so it never dips into the bench
    const th = slosh.tilt, edge = -Math.sign(th) * TRAY_HALF;
    t.group.rotation.z = th;
    t.group.position.x = trayHome.x + edge * (1 - Math.cos(th));
    t.group.position.y = trayHome.y - edge * Math.sin(th);
    // and the bath stays level under gravity while the tray tilts around it
    t.liquid.quaternion.copy(tiltQ.setFromAxisAngle(Z, -th)).multiply(levelQ);
    // the tongs: at rest on the rim, or holding the print's top edge
    if (grip.p) {
      // the jaws close on the print's top corner, in the print's own frame: the handle runs out
      // from the corner, the jaws either side of the paper (their gap along the print's normal)
      const g = grip.p.g;
      g.updateWorldMatrix(true, false);
      const at = g.localToWorld(new THREE.Vector3(grip.p.W / 2 - 0.1, grip.p.H / 2 - 0.05, 0));
      const q = g.getWorldQuaternion(new THREE.Quaternion());
      const px = new THREE.Vector3(1, 0, 0).applyQuaternion(q), py = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const pn = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const X = px.multiplyScalar(0.8).add(py.multiplyScalar(0.5)).add(pn.clone().multiplyScalar(0.4)).normalize();
      const Zj = pn.clone().addScaledVector(X, -pn.dot(X)).normalize();
      const Y = new THREE.Vector3().crossVectors(Zj, X);
      const held = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Zj));
      tongs.quaternion.slerpQuaternions(tongRest.q, held, grip.k);
      const heldPos = at.addScaledVector(X, -TONG_TIP.x);
      tongs.position.lerpVectors(tongRest.pos, heldPos, grip.k);
      tongs.userData.jaw(grip.jaw);
    }
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
    // in the tray's own frame: it tilts with the tray and drifts a little on the wave
    b.p.g.position.x = b.local.x - slosh.wave * 0.05;
    b.p.g.position.y = b.local.y;
    b.p.g.rotation.z = b.rz + Math.sin(time * 1.7) * 0.012 + slosh.wave * 0.03;
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

  // a peg: two wooden halves on a spring; squeezing the top opens the jaws at the bottom
  const peg = (c, open, duration = 0.18) => {
    const [a, b] = c.children;
    gsap.to(a.rotation, { x: open ? 0.3 : 0, duration, ease: 'power2.out' });
    return gsap.to(b.rotation, { x: open ? -0.3 : 0, duration, ease: 'power2.out' });
  };

  // the tongs take the top edge, lift it out to drain, carry it to the line; the peg takes it from them
  const hangUp = ({ p, k, frameIndex }) => {
    const s = slot(k, p.H);
    rockGuide?.hide();
    stage.world.attach(p.g);
    gsap.fromTo(p.mat.uniforms.uBright, { value: 1.35 }, { value: 1, duration: 1.2, ease: 'power2.out' });
    hud.say('there it is');
    sfx.chime();
    const sp = stage.toScreen(p.g.getWorldPosition(new THREE.Vector3()));
    hud.burst(sp.x, sp.y, { n: 18, spread: 110 });
    const f = ROLLS[STILL].frames[frameIndex];
    hud.toast(f.title, { kicker: `print ${k + 1} of ${n} · ${f.date}`, line: k === n - 1 ? 'the last one' : 'came up beautifully', hold: 1.8, sound: null });
    ripple(0, 0, 1.2);
    const c = clip();
    c.position.set(s.x, s.y + p.H / 2 + 0.02 + 0.6, s.z + 0.02);
    c.visible = false;
    stage.world.add(c);
    grip.p = p;
    gsap.timeline()
      // open on the way in, close on the corner, and only then lift
      .to(grip, { k: 1, jaw: 1, duration: 0.5, ease: 'power2.inOut' })
      .to(grip, { jaw: 0, duration: 0.14, ease: 'power2.in', onComplete: () => sfx.tick(0.7, 0.08) })
      .to(p.g.position, { y: 1.2, z: p.g.position.z + 0.2, duration: 0.7, ease: 'power2.out' })
      .to(p.g.rotation, { x: -0.08, z: 0, duration: 0.7, ease: 'power2.out' }, '<')
      .add(() => {
        sfx.splash(0.12);
        for (let d = 0; d < 7; d++) gsap.delayedCall(d * 0.11, () => drip(p));
      })
      .to({}, { duration: 0.75 })
      .to(p.g.position, { x: s.x, y: s.y, z: s.z, duration: 1.1, ease: 'power3.inOut' })
      .to(p.g.rotation, { x: 0, y: 0, z: (Math.random() - 0.5) * 0.05, duration: 1.1, ease: 'power3.inOut' }, '<')
      // the peg comes down open, closes on the top edge
      .add(() => {
        c.visible = true;
        peg(c, true, 0.01);
      }, '-=0.35')
      .to(c.position, { y: s.y + p.H / 2 + 0.02, duration: 0.35, ease: 'power2.out' }, '-=0.35')
      .add(() => {
        peg(c, false, 0.12);
        sfx.tick(0.55, 0.2);
      })
      // the peg has it now: the tongs open, come away, and go back to the rim shut
      .to(grip, { jaw: 1, duration: 0.14, ease: 'power2.out' }, '+=0.08')
      .to(grip, { k: 0, jaw: 0, duration: 0.6, ease: 'power2.inOut', onComplete: () => (grip.p = null) })
      .add(() => {
        const rot = p.g.rotation.clone();
        const top = new THREE.Vector3(0, p.H / 2, 0).applyEuler(rot);
        const entry = { ...p, k, frameIndex, clip: c, wet: 1, nextDrip: 0.4, home: { pos: s.clone(), rot }, peg: s.clone().add(top) };
        hung.push(entry);
        stage.pick(p.g, {
          label: () => (reading === entry ? 'hang it back' : 'read the back'),
          enter: () => (entry.hover = true),
          leave: () => (entry.hover = false),
          click: () => toggleRead(entry),
        });
        hud.setCount(countLine());
        busy = false;
        updateHint();
      }, '-=0.6');
  };

  // reading the back: the peg opens, the print comes to you; it goes back the same way
  const toggleRead = (e) => {
    if (busy || e.moving) return;
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
    peg(e.clip, true);
    gsap.timeline({ delay: 0.15, onComplete: () => (e.moving = false) })
      .to(e.g.position, { y: e.g.position.y - 0.12, duration: 0.2, ease: 'power2.out' })
      .add(() => peg(e.clip, false))
      .to(e.g.position, { x: spot.x, y: spot.y, z: spot.z, duration: 0.85, ease: 'power3.inOut' })
      .to(e.g.rotation, { x: look.rotation.x, y: look.rotation.y, z: look.rotation.z, duration: 1.0, ease: 'power3.inOut' }, '<');
    hud.say(COPY.hangBack);
  };

  const hangBack = (e) => {
    if (e.moving) return;
    reading = null;
    e.moving = true;
    const below = e.home.pos.clone();
    below.y -= 0.12;
    gsap.timeline({ onComplete: () => (e.moving = false) })
      .to(e.g.position, { x: below.x, y: below.y, z: below.z, duration: 0.85, ease: 'power3.inOut' })
      .to(e.g.rotation, { x: e.home.rot.x, y: e.home.rot.y, z: e.home.rot.z, duration: 0.85, ease: 'power3.inOut' }, '<')
      .add(() => peg(e.clip, true), '-=0.25')
      .to(e.g.position, { y: e.home.pos.y, duration: 0.2, ease: 'power2.out' })
      .add(() => {
        peg(e.clip, false, 0.12);
        sfx.tick(0.55, 0.15);
      });
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
