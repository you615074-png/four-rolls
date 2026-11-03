import * as THREE from 'three';
import { ROLLS, COPY, NOTES } from '../content.js';
import { hud } from '../hud.js';
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
  const home = { px: 0.2, py: 6.6, pz: 4.4, tx: 0.2, ty: 0, tz: -0.5, fov: 36 };
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
    gsap.from(dot.scale, { x: 0.01, y: 0.01, duration: 0.5, ease: 'back.out(3)' });
  };

  const prompt = () => {
    hud.setCount(`${seen.size} OF ${picks.length} SEEN`);
    hud.say(COPY.lightbox, { label: `${COPY.swap} ↻`, run: swap });
    hud.cta(COPY.printThem, () => app.go('tray'), `${picks.length} sheet${picks.length > 1 ? 's' : ''} of paper`);
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
    hud.openZoom(photoURL(STILL, slot.frameIndex, slot.frame), from, () => {
      gsap.to(stage.rig, { ...home, duration: 0.9, ease: 'power3.inOut' });
      if (!seen.has(slot.frameIndex)) sticker(slot);
      seen.add(slot.frameIndex);
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
  stage.parallaxAmount = 0.08;
  // the camera looks into the tray while a print develops, and up at the line when it hangs
  const trayView = { pos: [0.1, 5.3, 0.55], target: [0.05, 0, -2.85], fov: 40 };
  const lineView = { pos: [0.3, 4.6, 3.3], target: [0.3, 1.25, -3.4], fov: 38 };
  stage.view(trayView);
  stage.light({ pos: [0.5, 7.5, -1.2], target: [0.3, 0, -3.3], intensity: 70, angle: 0.75, hemi: 0.22 });
  gsap.from(stage.rig, { py: 6.4, pz: 1.6, duration: 1.4, ease: 'power3.out' });

  const { tray: t, stack } = darkroomProps(stage);
  // on a narrow screen the paper sits in front of the tray so it stays in view
  if (stage.camera.aspect < 1.15) stack.position.set(-0.75, 0, -1.25);

  // the safelight: a red bulb on the wall that colours the whole room
  const safe = new THREE.Group();
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.35, 0.18), toneMapped: false }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff4a26', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(2.2);
  const red = new THREE.PointLight('#ff3a1a', 22, 12, 1.4);
  safe.add(bulb, halo, red);
  safe.position.set(-2.4, 3.6, -4.9);
  stage.world.add(safe);

  // a thin layer of developer over whatever is in the tray, with a moving glint
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(3.15, 2.15),
    new THREE.MeshStandardMaterial({ color: '#4a2a18', transparent: true, opacity: 0.32, roughness: 0.06, metalness: 0.2, depthWrite: false }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = t.liquidY + 0.03;
  t.group.add(surface);
  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.5),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff9a70', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glint.rotation.x = -Math.PI / 2;
  glint.position.y = t.liquidY + 0.035;
  t.group.add(glint);

  const lineY = 3.05, lineZ = -4.6;
  const line = clothesline(10);
  line.position.set(0.3, lineY, lineZ);
  stage.world.add(line);

  const spacing = 1.18;
  const slot = (k) => new THREE.Vector3(0.3 + (k - (n - 1) / 2) * spacing, lineY - 0.66, lineZ + 0.02);
  const hung = [];
  let busy = false;
  let reading = null;
  let bath = null; // the sheet currently in the developer
  const slosh = { tilt: 0, to: 0, wave: 0, wv: 0, stir: 0 };

  const updateHint = () => {
    if (hung.length < n) {
      hud.say(COPY.next);
      return;
    }
    hud.say(COPY.readBack);
    hud.cta(COPY.toWall, () => app.go('wall'), COPY.allDry.replace(',', ''));
  };

  const stackGuide = stage.anchor(new THREE.Vector3(stack.position.x, 0.25, stack.position.z), 'take a sheet', { dy: -18 });
  let rockGuide = null;

  const develop = () => {
    if (busy || hung.length >= n || reading) return;
    busy = true;
    stackGuide.hide();
    if (stage.rig.py !== trayView.pos[1]) stage.view(trayView, 1.1);
    const k = hung.length;
    const frameIndex = picks[k];
    const p = makePrint(frameIndex, k);
    stage.world.add(p.g);
    p.g.position.copy(stack.position).setY(0.14);
    p.g.rotation.set(-Math.PI / 2, 0, 0.12);
    hud.say(COPY.wait);
    hud.setCount(`PRINT ${k + 1} OF ${n} · 0%`);
    const inTray = t.group.position.clone().setY(t.liquidY + 0.005);
    gsap.timeline({
      onComplete: () => {
        bath = { p, k, frameIndex, inTray, progress: 0 };
        if (!k) rockGuide = stage.anchor(new THREE.Vector3(t.group.position.x, 0.4, t.group.position.z + 1.2), '⟵ drag to rock ⟶', { dy: 10 });
      },
    })
      .to(p.g.position, { x: (stack.position.x + inTray.x) / 2, y: 1.1, z: (stack.position.z + inTray.z) / 2, duration: 0.55, ease: 'power2.out' })
      .to(p.g.position, { x: inTray.x, y: inTray.y, z: inTray.z, duration: 0.6, ease: 'power2.in' })
      .to(p.g.rotation, { z: -0.04, duration: 1.1, ease: 'power2.inOut' }, 0)
      .add(() => {
        // the sheet slaps the surface and sends a wave across
        slosh.wv += 2.4;
        slosh.stir = 1;
      }, 1.1);
  };

  // rocking: drag side to side. The faster you rock, the faster the image comes up.
  const rock = (d) => {
    if (!bath) return;
    rockGuide?.hide();
    slosh.to = THREE.MathUtils.clamp(slosh.to + d, -0.07, 0.07);
    slosh.stir = Math.min(slosh.stir + Math.abs(d) * 9, 5);
  };
  stage.dragHandler = { label: null, move: (dx) => rock(dx * 0.0011) };

  stage.onFrame((dt, time) => {
    for (const e of hung) {
      if (e.moving || reading === e) continue;
      e.sway = damp(e.sway ?? 0, e.hover ? 0.07 : 0, 6, dt);
      e.g.rotation.z = e.home.rot.z + Math.sin(time * 1.3 + e.k) * 0.012 + Math.sin(time * 9) * e.sway * 0.4;
    }
    // tray tilt eases back to level; the liquid lags behind it like a spring
    slosh.to = damp(slosh.to, 0, 2.5, dt);
    slosh.tilt = damp(slosh.tilt, slosh.to, 9, dt);
    t.group.rotation.z = slosh.tilt;
    slosh.wv += (-slosh.wave * 30 - slosh.wv * 2.2 + (slosh.to - slosh.tilt) * 40) * dt;
    slosh.wave += slosh.wv * dt;
    surface.rotation.y = slosh.wave * 0.04;
    surface.position.y = t.liquidY + 0.03 + slosh.wave * 0.006;
    glint.position.x = -0.6 + Math.sin(time * 0.6) * 0.3 + slosh.wave * 0.5;
    glint.position.z = -0.3 + Math.cos(time * 0.45) * 0.2;
    glint.material.opacity = 0.16 + Math.min(0.3, Math.abs(slosh.wv) * 0.05);
    slosh.stir = damp(slosh.stir, 0, 1.6, dt);
    red.intensity = 22 + Math.sin(time * 3.3) * 0.6;

    if (!bath) return;
    const b = bath;
    b.progress = Math.min(1, b.progress + (dt / 7) * (1 + slosh.stir));
    b.p.mat.uniforms.uDev.value = b.progress;
    b.p.mat.uniforms.uTime.value = time;
    b.p.g.position.x = b.inTray.x - slosh.wave * 0.05;
    b.p.g.position.y = b.inTray.y + Math.sin(time * 2.4) * 0.004 + slosh.tilt * 0.4;
    b.p.g.rotation.z = -0.04 + Math.sin(time * 1.7) * 0.015 + slosh.wave * 0.03;
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

  // lifted out with tongs, dripping, then pegged on the line
  const drip = (p) => {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshStandardMaterial({ color: '#3a2015', roughness: 0.1, metalness: 0.2 }));
    const at = p.g.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.8, -0.6, 0));
    drop.position.copy(at);
    stage.world.add(drop);
    gsap.to(drop.position, { y: t.liquidY, duration: Math.sqrt(Math.max(0.05, at.y - t.liquidY) / 4.9), ease: 'power2.in', onComplete: () => {
      stage.world.remove(drop);
      drop.geometry.dispose();
      drop.material.dispose();
      slosh.wv += 0.25;
    } });
  };

  const hangUp = ({ p, k, frameIndex }) => {
    const s = slot(k);
    gsap.fromTo(p.mat.uniforms.uBright, { value: 1.35 }, { value: 1, duration: 1.2, ease: 'power2.out' });
    hud.say('there it is');
    gsap.timeline()
      .to(p.g.position, { y: 1.3, duration: 0.7, ease: 'power2.out' })
      .to(p.g.rotation, { x: -0.25, duration: 0.7, ease: 'power2.out' }, '<')
      .add(() => {
        for (let d = 0; d < 6; d++) gsap.delayedCall(d * 0.12, () => drip(p));
        stage.view(lineView, 1.5);
      })
      .to({}, { duration: 0.5 })
      .to(p.g.position, { x: s.x, y: s.y, z: s.z, duration: 1.1, ease: 'power3.inOut' })
      .to(p.g.rotation, { x: 0, y: 0, z: (Math.random() - 0.5) * 0.05, duration: 1.1, ease: 'power3.inOut' }, '<')
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
        // back to the tray for the next sheet, unless that was the last one
        if (hung.length < n) gsap.delayedCall(1.4, () => !busy && !reading && stage.view(trayView, 1.2));
      });
  };

  const toggleRead = (e) => {
    if (busy) return;
    if (reading && reading !== e) return hangBack(reading);
    if (reading === e) return hangBack(e);
    gsap.killTweensOf(stage.rig);
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
}
