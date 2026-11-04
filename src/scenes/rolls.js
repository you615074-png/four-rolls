import * as THREE from 'three';
import { ROLLS, COPY } from '../content.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { CAN, FILM, canister, slideViewer, stripSegment } from '../props.js';
import {
  FONT, canvas, canvasTexture, cardTexture, damp, glowTexture, handLoop,
  isWide, photoMaterial, photoTexture, releaseRoll, smooth,
} from '../util.js';

const gsap = window.gsap;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const STILL = 3;
const CUT_W = 0.94; // a cut frame is a little narrower than its pitch: the gap is the cut
const frameNo = (i) => String(i + 1).padStart(2, '0');

/* ---------- a strip standing on the table, coming out of its can ---------- */

function standingStrip(stage, rollIndex, { pulled, min = 0.6, x0 = -0.7, z = 0, neg = 1, cut = false, until = null }) {
  const roll = ROLLS[rollIndex];
  const can = canister(roll);
  can.position.set(x0, 0, z);
  stage.world.add(can);
  const mouth = x0 + CAN.r - 0.05;
  // the film exists only outside the can (or the file box): whatever is still wound in is cut away
  // at the felt lip, just inside the wall, so no frame ever shows through the back or the top.
  // `until` does the same where the film runs into something else (the viewer's hood).
  stage.renderer.localClippingEnabled = true;
  const clipping = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -(mouth - 0.01))];
  if (until != null) clipping.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), until));
  const clipped = (m) => {
    m.clippingPlanes = clipping;
    m.clipShadows = true;
    return m;
  };
  if (cut) {
    // already cut into single frames: they stand in a grooved rail coming out of a file box
    can.visible = false;
    const wood = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.6 });
    // taller than the frames standing in it (they're 1.54 to the top), so none shows over the rim
    const boxH = FILM.height + 0.2;
    const fileBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, boxH, 0.8), new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.75 }));
    fileBox.position.set(x0 - 0.05, boxH / 2, z);
    fileBox.castShadow = fileBox.receiveShadow = true;
    stage.world.add(fileBox);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), new THREE.MeshBasicMaterial({ map: cardTexture({ w: 310, h: 150, bg: '#e9dfc7', lines: [
      { text: roll.name, font: `46px ${FONT.hand}`, x: 155, y: 70, align: 'center', color: '#2b241e' },
      { text: 'CUT · 24 FRAMES', font: `500 15px ${FONT.mono}`, x: 155, y: 118, align: 'center', color: '#7a6d60' },
    ] }), color: '#d9d0c0' }));
    label.position.set(x0 - 0.05, boxH * 0.6, z + 0.401);
    stage.world.add(label);
    for (let s = -0.3; s < 9; s += 0.25) {
      const a = { x: mouth + s, z: z + 0.06 * Math.sin(s * 0.8) - 0.004 * s * s };
      const piece = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.14), wood);
      piece.position.set(a.x, 0.035, a.z);
      piece.rotation.y = -Math.atan(0.048 * Math.cos(s * 0.8) - 0.008 * s);
      piece.receiveShadow = true;
      stage.world.add(piece);
    }
  }
  const items = roll.frames.map((f, i) => {
    const seg = new THREE.Group();
    const film = stripSegment();
    clipped(film.material);
    seg.add(film);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(FILM.imgW, FILM.imgH), clipped(photoMaterial(photoTexture(rollIndex, i, f), { neg, bright: 0.92, turn: isWide(f) ? 1 : 0 })));
    photo.position.z = 0.004;
    seg.add(photo);
    const back = new THREE.Mesh(photo.geometry, photo.material);
    back.rotation.y = Math.PI;
    back.position.z = -0.004;
    seg.add(back);
    stage.world.add(seg);
    return { seg, photo, mat: photo.material, i, frame: f, lift: 0, liftTo: 0, hop: 0, out: false };
  });
  // a roll's film doesn't end at its last frame: the blank tail runs on into the can, so even
  // pulled all the way out the strip is still fixed to the spool
  const tail = cut ? [] : [0, 1, 2].map((j) => {
    const seg = new THREE.Group();
    const film = stripSegment();
    clipped(film.material);
    seg.add(film);
    stage.world.add(seg);
    return { seg, i: roll.frames.length + j, lift: 0, hop: 0, out: false, blank: true };
  });
  const strip = {
    can, items, pulled, min, mouth, tease: 0, max: roll.frames.length * FILM.pitch + 0.2,
    place(s) {
      return { x: mouth + s, y: FILM.height / 2 + 0.04, z: z + 0.06 * Math.sin(s * 0.8) - 0.004 * s * s, ry: -Math.atan(0.048 * Math.cos(s * 0.8) - 0.008 * s) };
    },
    at(it) {
      return strip.pulled + strip.tease - (it.i + 0.5) * FILM.pitch;
    },
    // hover lifts and click hops spread along the film as one smooth bump,
    // so the strip bends instead of breaking into steps
    bump(s) {
      let y = 0;
      for (const it of items) {
        const h = it.out ? 0 : it.lift + it.hop;
        if (h > 0.0005) y += h * Math.exp(-(((s - strip.at(it)) / (FILM.pitch * 0.75)) ** 2));
      }
      return y;
    },
    // each frame spans exactly from the curve point at its left edge to the one at its right,
    // so neighbours share their edges and the film reads as one continuous strip
    layout() {
      const half = FILM.pitch / 2;
      for (const it of [...items, ...tail]) {
        if (it.out) continue;
        const s = strip.at(it);
        it.seg.visible = s > -FILM.pitch * 0.52; // any of it past the lip (the rest is clipped away)
        if (cut) {
          // single frames: each stands on its own in the rail, with a gap either side
          const p = strip.place(s);
          it.seg.position.set(p.x, p.y + it.lift + it.hop, p.z);
          it.seg.rotation.order = 'YZX';
          it.seg.rotation.set(0, p.ry, 0);
          it.seg.scale.x = CUT_W;
          continue;
        }
        const a = strip.place(s - half), b = strip.place(s + half);
        const ya = a.y + strip.bump(s - half), yb = b.y + strip.bump(s + half);
        const dx = b.x - a.x, dy = yb - ya, dz = b.z - a.z;
        const flat = Math.hypot(dx, dz);
        it.seg.position.set((a.x + b.x) / 2, (ya + yb) / 2, (a.z + b.z) / 2);
        it.seg.rotation.order = 'YZX';
        it.seg.rotation.set(0, -Math.atan2(dz, dx), Math.atan2(dy, flat));
        it.seg.scale.x = (Math.hypot(flat, dy) / FILM.pitch) * 1.02; // a hair of overlap closes the wedge on bends
      }
    },
  };
  // the can (or the file box) is where the film starts: it always stays in frame, on a phone too
  stage.keep = stage.corners(can, 0.08);
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
  // while a frame is out of the strip (or on its way back) the film stays put
  const locked = () => strip.locked?.();
  stage.dragHandler = {
    label,
    start: () => {
      if (locked()) return;
      gsap.killTweensOf(strip, 'pulled');
      wheelTo = null;
    },
    begin: () => {
      v = 0;
      last = performance.now();
      touched();
    },
    move: (dx) => {
      if (locked()) return;
      const now = performance.now();
      let d = dx * 0.011;
      if (strip.pulled + d > strip.max || strip.pulled + d < strip.min) d *= 0.3;
      // the overpull gives a little and then stops, so the end of the film never comes out
      strip.pulled = clamp(strip.pulled + d, strip.min - 0.45, strip.max + 0.45);
      v = v * 0.6 + clamp((d / Math.max(8, now - last)) * 1000, -14, 14) * 0.4;
      last = now;
    },
    end: () => {
      if (locked()) return;
      if (performance.now() - last > 90) v = 0;
      settle(strip.pulled + clamp(v * 0.22, -2.4, 2.4));
    },
  };
  stage.wheelHandler = (delta) => {
    if (locked()) return;
    touched();
    wheelTo = clamp((wheelTo ?? strip.pulled) + delta * 0.006, strip.min, strip.max);
    gsap.to(strip, { pulled: wheelTo, duration: 0.6, ease: 'power3.out', overwrite: true, onComplete: () => (wheelTo = null) });
  };
}

export function rollScene(stage, app, { index }) {
  const roll = ROLLS[index];
  app.state.visited.add(index);
  app.state.lastRoll = index;
  hud.set({ scene: `ROLL ${roll.no} · OF FOUR`, count: roll.name.toUpperCase(), back: true });
  hud.say(roll.hint);
  stage.parallaxAmount = 0.1;
  if (roll.mode === 'contact') return stillDeck(stage, app, index);

  stage.view({ pos: [1.9, 2.2, 7.0], target: [1.9, 0.86, 0], fov: 34 });
  stage.light({ pos: [1.6, 7.5, 4.5], target: [1.8, 0.6, 0], intensity: 120, angle: 0.55 });
  gsap.from(stage.rig, { pz: 8.2, py: 2.6, duration: 1.4, ease: 'power3.out' });

  const modes = { develop: developRoll, light: lightRoll, viewer: viewerRoll };
  const done = modes[roll.mode](stage, index, app.state.stats);
  return () => {
    done?.();
    releaseRoll(index);
  };
}

/* Mature: one continuous gesture. Drag the film out; the safelight develops
   every frame that passes under it. */
function developRoll(stage, index, stats) {
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
        // each frame pings as it comes up; every sixth and the whole roll get a stamp
        sfx.tick(1.1 + (developedCount % 6) * 0.08, 0.1);
        stats.developed = Math.max(stats.developed, developedCount);
        const sp = stage.toScreen(it.seg.getWorldPosition(new THREE.Vector3()));
        hud.burst(sp.x, sp.y - 30, { n: 7, spread: 50 });
        if (developedCount === roll.frames.length) {
          hud.toast('the whole roll, developed', { kicker: `${roll.name} · 24 frames`, line: 'tap any frame to read its name', sound: 'success' });
        } else if (developedCount % 6 === 0) {
          hud.toast(`${developedCount} of ${roll.frames.length}`, { kicker: roll.name, line: ['keep pulling', 'a season, coming back', 'nearly there'][developedCount / 6 - 1] });
        }
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
        sfx.pop();
        hud.setCaption({ small: `${it.frame.date} · FRAME ${frameNo(it.i)}`, title: it.frame.title });
      },
    });
  }
}

/* slow days: the roll is cut into single frames. Lift one to the light and tilt it with the pointer. */
function lightRoll(stage, index, stats) {
  const strip = standingStrip(stage, index, { pulled: 0.8, min: 0.8, cut: true });
  gsap.to(strip, { pulled: 5.6, duration: 1.8, delay: 0.3, ease: 'power3.out' });
  dragToPull(stage, strip, { label: 'drag ⟷ · tap a frame' });

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(1.7, 1.6, 1.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  stage.world.add(glow);
  // where a held frame is brought: right up in front of you, close enough that the photo fills
  // most of the screen (worked out from the view, the screen's shape and which way the photo
  // stands), a little below the middle so the caption over it stays clear; turned to face you
  const target = new THREE.Vector3();
  const glowHome = new THREE.Vector3();
  let face = 0; // the tilt that turns the frame toward the camera
  const FILL_H = 0.78, FILL_W = 0.9; // the most of the screen's height and width the film may take
  // `wide`: the frame lies on its side (a landscape photo, face up); turned over it stands upright
  const aim = (it, wide = !!it && isWide(it.frame)) => {
    const cam = stage.camera;
    const t2 = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const fh = wide ? FILM.pitch * CUT_W : FILM.height, fw = wide ? FILM.height : FILM.pitch * CUT_W;
    const d = Math.max(fh / (FILL_H * t2), fw / (FILL_W * t2 * cam.aspect), 1.2);
    const ray = new THREE.Vector3(0, -0.07, 0.5).unproject(cam).sub(cam.position).normalize();
    target.copy(cam.position).addScaledVector(ray, d);
    face = -Math.atan2(cam.position.y - target.y, cam.position.z - target.z);
    glowHome.set(target.x + 0.15, target.y + 0.3, target.z - 0.9);
  };
  aim();
  glow.position.copy(glowHome);
  let held = null;
  let returning = 0;
  strip.locked = () => !!held || returning > 0;
  const guide = stage.anchor(strip.items[2].seg, 'tap one', { dy: -120 });

  const dropNote = (it) => {
    if (!it.note) return;
    it.seg.remove(it.note);
    it.note.material.map.dispose();
    it.note.material.dispose();
    it.note = null;
  };

  // the frame's own slot in the rail, as one pose (position + orientation in the layout's own order)
  const slotPose = (it) => {
    const p = strip.place(strip.at(it));
    return { pos: new THREE.Vector3(p.x, p.y, p.z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.ry, 0, 'YZX')) };
  };
  const stopMoving = (it) => {
    it.tl?.kill();
    it.tl = null;
    if (it.back) {
      it.back.kill();
      it.back = null;
      returning--;
    }
    gsap.killTweensOf([it.seg.position, it.seg.rotation]);
  };

  const putBack = (it) => {
    held = null;
    it.ready = false;
    it.flipped = false;
    hud.setCaption(null);
    hud.say(ROLLS[index].hint);
    stopMoving(it);
    gsap.to(glow.material, { opacity: 0, duration: 0.5 });
    gsap.to(it.mat.uniforms.uNeg, { value: 1, duration: 0.9 });
    gsap.to(it.mat.uniforms.uBright, { value: 0.92, duration: 0.6 });
    // slerp from wherever it is to its slot, re-reading the slot every frame
    const fromP = it.seg.position.clone(), fromQ = it.seg.quaternion.clone();
    const k = { t: 0 };
    returning++;
    it.back = gsap.to(k, {
      t: 1, duration: 0.8, ease: 'power3.inOut',
      onUpdate: () => {
        const slot = slotPose(it);
        it.seg.position.lerpVectors(fromP, slot.pos, k.t);
        it.seg.quaternion.slerpQuaternions(fromQ, slot.q, k.t);
      },
      onComplete: () => {
        it.back = null;
        returning--;
        it.out = false;
        it.seg.children[0].castShadow = true;
        dropNote(it);
        if (it.label) {
          it.seg.remove(it.label);
          it.label = null;
        }
      },
    });
  };

  // a landscape shot lies sideways on the film: turn the frame a quarter to read it
  const upright = (it) => (isWide(it.frame) ? -Math.PI / 2 + 0.04 : 0.04);

  const holdUp = (it) => {
    if (held) putBack(held);
    stopMoving(it);
    gsap.killTweensOf(strip, 'pulled');
    guide.hide();
    sfx.paper();
    aim(it);
    held = it;
    it.out = true;
    it.flipped = false;
    it.liftTo = it.lift = 0;
    it.seg.rotation.reorder('XYZ');
    it.seg.traverse((m) => (m.castShadow = false));
    if (!it.label) it.seg.add((it.label = edgePrint(ROLLS[index], it)));
    hud.setCaption({ small: `${it.frame.date} · FRAME ${frameNo(it.i)}`, title: it.frame.title });
    hud.say('tap it again to turn it over · tap outside to put it back');
    gsap.to(glow.material, { opacity: 0.95, duration: 0.9, delay: 0.25 });
    // lifted straight up out of the rail first, then brought to the light
    it.tl = gsap.timeline({ onComplete: () => (it.ready = true) })
      .to(it.seg.position, { y: it.seg.position.y + 0.55, duration: 0.3, ease: 'power2.out' })
      .to(it.seg.position, { x: target.x, y: target.y, z: target.z, duration: 0.8, ease: 'power3.inOut' })
      .to(it.seg.rotation, { x: face, y: -0.08, z: upright(it), duration: 0.8, ease: 'power3.inOut' }, '<');
    gsap.to(it.mat.uniforms.uNeg, { value: 0, duration: 1.4, delay: 0.45, ease: 'power2.inOut' });
  };

  // turning the frame over shows what was written on the slip taped behind it
  const read = new Set();
  hud.setCount(`0 OF ${ROLLS[index].frames.length} NOTES READ`);
  const flip = (it) => {
    if (!it.ready) return;
    it.ready = false;
    it.flipped = !it.flipped;
    if (it.flipped && !it.note) it.seg.add((it.note = backNote(ROLLS[index], it)));
    sfx.paper();
    if (it.flipped && !read.has(it.i)) {
      read.add(it.i);
      stats.notes = Math.max(stats.notes, read.size);
      hud.setCount(`${read.size} OF ${ROLLS[index].frames.length} NOTES READ`);
      gsap.delayedCall(0.7, () => {
        const sp = stage.toScreen(it.seg.getWorldPosition(new THREE.Vector3()));
        hud.burst(sp.x, sp.y, { n: 12, spread: 80 });
        sfx.chime();
      });
      if (read.size === 1) gsap.delayedCall(1.1, () => hud.toast('a note on the back', { kicker: 'slow days', line: 'every frame has one, turn a few more', sound: null }));
      else if ([5, 12, 24].includes(read.size)) gsap.delayedCall(1.1, () => hud.toast(`${read.size} notes read`, { kicker: 'slow days', line: read.size === 24 ? 'every quiet day, accounted for' : 'the slow days add up', sound: 'success' }));
    }
    hud.say(it.flipped ? 'tap again to turn it back · tap outside to put it back' : 'tap it again to turn it over · tap outside to put it back');
    hud.setCaption(it.flipped
      ? { small: `THE BACK · ${it.frame.date}`, title: 'in pencil, on a slip of paper' }
      : { small: `${it.frame.date} · FRAME ${frameNo(it.i)}`, title: it.frame.title });
    gsap.to(glow.material, { opacity: it.flipped ? 0.4 : 0.95, duration: 0.8 });
    // the back is read upright, so a landscape frame comes to where an upright one would be
    aim(it, it.flipped ? false : isWide(it.frame));
    it.tl = gsap.timeline({ onComplete: () => {
      it.tl = null;
      it.ready = true;
      if (!it.flipped) dropNote(it);
    } })
      .to(it.seg.position, { x: target.x, y: target.y + 0.12, z: target.z - 0.2, duration: 0.45, ease: 'power2.out' })
      .to(it.seg.position, { y: target.y, z: target.z, duration: 0.55, ease: 'power2.inOut' })
      .to(it.seg.rotation, { y: it.flipped ? Math.PI + 0.06 : -0.08, x: face, z: it.flipped ? -0.03 : upright(it), duration: 1.0, ease: 'power3.inOut' }, 0);
  };

  stage.onFrame((dt) => {
    if (!held?.ready) return;
    // the held frame follows the pointer; turning it away from the light dims it
    const tx = stage.parallax.x * 0.45, ty = -stage.parallax.y * 0.3;
    const r = held.seg.rotation;
    const k = held.flipped ? 0.6 : 1;
    r.y = damp(r.y, (held.flipped ? Math.PI + 0.06 : -0.08) + tx * k, 8, dt);
    r.x = damp(r.x, face + ty * k, 8, dt);
    if (held.flipped) return;
    glow.position.x = damp(glow.position.x, glowHome.x - tx * 1.4, 6, dt);
    glow.position.y = damp(glow.position.y, glowHome.y + ty * 1.2, 6, dt);
    held.mat.uniforms.uBright.value = damp(held.mat.uniforms.uBright.value, 1.18 - Math.hypot(tx, ty) * 0.5, 6, dt);
  });

  for (const it of strip.items) {
    stage.pick(it.seg, {
      ...hoverLift(it),
      label: () => (it !== held ? 'hold it up' : it.flipped ? 'turn it back' : 'turn it over'),
      click: () => (it === held ? flip(it) : holdUp(it)),
    });
  }
  stage.onEmptyClick = () => held && putBack(held);
}

/** The slip taped to the back of a slow days frame, in handwriting. */
function backNote(roll, it) {
  const map = cardTexture({ w: 400, h: 600, bg: '#efe6d2', scale: 2, border: true, lines: [
    { text: it.frame.date, font: `54px ${FONT.hand}`, x: 34, y: 92, color: '#9c2f1c', rot: -0.03 },
    { text: it.frame.note, font: `40px ${FONT.hand}`, x: 34, y: 172, wrap: 330, lh: 48, color: '#2a2420' },
    { text: `${roll.name.toUpperCase()} · ${frameNo(it.i)}`, font: `500 13px ${FONT.mono}`, x: 34, y: 560, color: '#9a8f82' },
  ] });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(FILM.pitch * 0.98, FILM.height * 0.98),
    new THREE.MeshBasicMaterial({ map, color: '#e6dfd2' }),
  );
  m.rotation.y = Math.PI;
  m.position.z = -0.012;
  return m;
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

/* far away: pull the lever and the carousel shuffles to a random slide.
   It arrives out of focus, as far things do; turn the brass wheel to bring it in. */
function viewerRoll(stage, index, stats) {
  const roll = ROLLS[index];
  const total = roll.frames.length;
  // the film runs from its can through a gate beside the viewer: the frame in the gate is the one
  // on the screen. Pulled length is worked out from the gate, so the two can't drift apart.
  stage.view({ pos: [0.6, 2.2, 7.0], target: [0.6, 0.86, 0], fov: 34 });
  const x0 = -1.6, z = -0.25;
  const gateX = -0.42;
  const sGate = gateX - (x0 + CAN.r - 0.05);
  const atGate = (i) => sGate + (i + 0.5) * FILM.pitch; // pulled length that puts frame i in the gate
  const VIEWER = { x: 1.05, z: 0.65, halfW: 0.75 };
  const hw = FILM.pitch / 2 + 0.04;
  const hoodFrom = gateX + hw + 0.03; // where the film goes into the dark hood on the viewer's side
  const strip = standingStrip(stage, index, { pulled: atGate(0), min: atGate(0), x0, z, until: hoodFrom + 0.04 });
  strip.max = atGate(total - 1);
  const v = slideViewer();
  v.group.position.set(VIEWER.x, 0, VIEWER.z);
  stage.world.add(v.group);
  // the gate: a brass frame the film runs through, and a dark hood into the side of the viewer
  {
    const brass = new THREE.MeshStandardMaterial({ color: '#b08a52', roughness: 0.35, metalness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: '#15110f', roughness: 0.6 });
    const g = strip.place(sGate);
    const gate = new THREE.Group();
    const top = FILM.height + 0.12;
    // each post is a pair of plates with a slit between them for the film to run through
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, top, 0.04), brass);
        post.position.set(sx * hw, top / 2, sz * 0.04);
        gate.add(post);
      }
    }
    for (const y of [0.03, top]) {
      for (const sz of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.05, 0.04, 0.03), brass);
        rail.position.set(0, y, sz * 0.03);
        gate.add(rail);
      }
    }
    gate.position.set(gateX, 0, g.z);
    gate.rotation.y = g.ry;
    gate.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
    stage.world.add(gate);
    // the hood: a dark tunnel from just past the gate into the viewer's side, taller than the
    // film and deep enough to take it in; the film is cut away inside it, so it goes in, not through
    const side = VIEWER.x - VIEWER.halfW; // the viewer's left face
    const zFront = VIEWER.z - 0.2, zBack = g.z - 0.14;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(side + 0.05 - hoodFrom, FILM.height + 0.16, zFront - zBack), dark);
    hood.position.set((side + 0.05 + hoodFrom) / 2, (FILM.height + 0.16) / 2, (zFront + zBack) / 2);
    hood.castShadow = hood.receiveShadow = true;
    stage.world.add(hood);
  }
  const spool = strip.can.userData.spool;
  // the can, the gate and the viewer: the whole film path stays in view
  stage.keep = [...stage.corners(strip.can, 0.08), ...stage.corners(v.group, 0.05)];
  const blank = new THREE.CanvasTexture(canvas(4, 4)[0]);
  const screen = photoMaterial(blank, { bright: 1.25 });
  screen.uniforms.uFlash.value = 0.85;
  v.screen.material = screen;
  const knob = v.lever.children[1];

  // the focus wheel on the left of the viewer
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a52', roughness: 0.3, metalness: 0.7 });
  const wheel = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 48), brass);
  disc.rotation.z = Math.PI / 2;
  wheel.add(disc);
  for (let k = 0; k < 18; k++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), brass);
    const a = (k / 18) * Math.PI * 2;
    rib.position.set(0, Math.cos(a) * 0.245, Math.sin(a) * 0.245);
    rib.rotation.x = -a;
    wheel.add(rib);
  }
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: '#c7231b' }));
  dot.rotation.y = -Math.PI / 2;
  dot.position.set(-0.047, 0.15, 0);
  wheel.add(dot);
  wheel.position.set(-0.8, 1.1, 0.12);
  wheel.traverse((m) => (m.castShadow = true));
  v.group.add(wheel);

  // a little lamp on top of the viewer glows brighter the closer the focus gets
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.08, 0.04), toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), lampMat);
  lamp.position.set(0, 1.9, 0.3);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff7a40', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  lampGlow.scale.setScalar(0.8);
  lampGlow.position.copy(lamp.position);
  v.group.add(lamp, lampGlow);

  const guide = stage.anchor(knob, 'pull the lever', { dy: -22 });
  let focusGuide = null;
  const found = new Set();
  let cur = -1, focus = 0, aim = 0, sharp = true, spinning = false, knobTo = 1, shownAt = 0;
  let km = 0, lastTick = 0, lastErr = 1, hintAt = 0;
  const near = () => (sharp ? 1 : 1 - Math.min(1, Math.abs(focus - aim)));

  const show = (i, blur) => {
    screen.uniforms.uMap.value = photoTexture(index, i, roll.frames[i]);
    // the screen is 1.0 × 1.18; a 4:3 slide fills its width inside a dark mount
    const tall = isWide(roll.frames[i]) ? (1.18 / 1.0) * (4 / 3) : 1;
    screen.uniforms.uCrop.value.set(0, (1 - tall) / 2, 1, tall);
    screen.uniforms.uPaper.value.set(tall > 1 ? '#0d0a08' : '#f3eee2');
    screen.uniforms.uBlur.value = blur;
  };

  const pull = () => {
    if (spinning) return;
    spinning = true;
    guide.hide();
    hud.setCaption({ small: 'SHUFFLING', title: '…' });
    sfx.clack();
    gsap.timeline()
      .to(v.lever.rotation, { x: -0.9, duration: 0.16, ease: 'power2.in' })
      .to(v.lever.rotation, { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' });
    // the carousel clacks through a few slides, slowing down, then settles
    const unseen = roll.frames.map((_, i) => i).filter((i) => !found.has(i) && i !== cur);
    const pool = unseen.length ? unseen : roll.frames.map((_, i) => i).filter((i) => i !== cur);
    const land = pool[Math.floor(Math.random() * pool.length)];
    const tl = gsap.timeline({
      onComplete: () => {
        cur = land;
        // land somewhere off focus, on either side of where the wheel is now
        aim = focus + (Math.random() > 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.45);
        sharp = false;
        spinning = false;
        shownAt = performance.now();
        lastErr = Math.abs(focus - aim);
        hud.setCaption({ small: `FRAME ${frameNo(cur)} · OUT OF FOCUS`, title: 'turn the wheel to see it' });
        hud.say('drag ⟷ or scroll to focus');
        if (!found.size && !focusGuide) focusGuide = stage.anchor(wheel, '← drag to focus →', { dy: -40 });
      },
    });
    // the film is fed through in whole frames, one step per clack, the can turning as the feed
    // reel, until the frame on the screen is the one at the gate
    const times = [0, 0.08, 0.17, 0.28, 0.41, 0.57, 0.77];
    const from = strip.pulled;
    const to = atGate(land);
    const grid = (v) => atGate(Math.round((v - sGate) / FILM.pitch - 0.5));
    times.forEach((at, k) => {
      tl.call(() => {
        // whatever frame the film has stepped into the gate is what the screen shows
        const want = k === times.length - 1 ? to : grid(from + ((to - from) * (k + 1)) / times.length);
        const i = Math.round((want - sGate) / FILM.pitch - 0.5);
        show(i, 0.05);
        sfx.tick(0.8 + k * 0.04, 0.16);
        screen.uniforms.uFlash.value = 0.55;
        gsap.to(screen.uniforms.uFlash, { value: 0, duration: 0.12, overwrite: true });
        const step = want - strip.pulled;
        gsap.to(strip, { pulled: want, duration: 0.07, ease: 'power2.out', overwrite: true });
        // the spool inside turns by the film it lets out; the shell doesn't move
        gsap.to(spool.map((m) => m.rotation), { y: `-=${step / 0.11}`, duration: 0.07, ease: 'power2.out' });
      }, null, at);
    });
  };

  const lockIn = () => {
    sharp = true;
    focusGuide?.hide();
    focusGuide = null;
    const f = roll.frames[cur];
    gsap.to(screen.uniforms.uBlur, { value: 0, duration: 0.35, ease: 'power2.out', overwrite: true });
    gsap.fromTo(screen.uniforms.uFlash, { value: 0.3 }, { value: 0, duration: 0.7, ease: 'power2.out' });
    gsap.fromTo(screen.uniforms.uBright, { value: 1.5 }, { value: 1.25, duration: 0.9, ease: 'power2.out' });
    hud.setCaption({ small: `${f.date} · FRAME ${frameNo(cur)}`, title: f.title });
    // the reward: where it was, and how far apart you were
    const fresh = !found.has(cur);
    found.add(cur);
    if (fresh) km += f.km;
    stats.km = Math.max(stats.km, km);
    hud.setCount(`${found.size} OF ${total} IN FOCUS · ${km.toLocaleString('en')} KM`);
    const s = stage.toScreen(v.screen.getWorldPosition(new THREE.Vector3()));
    hud.burst(s.x, s.y, { n: 22, spread: 120 });
    hud.toast(`${f.km.toLocaleString('en')} km apart`, { kicker: `${f.date} · ${f.place}`, line: f.line, hold: 2.6 });
    if (fresh && found.size % 6 === 0) {
      gsap.delayedCall(3.3, () => hud.toast(`${found.size} places found`, {
        kicker: 'far away', line: `${km.toLocaleString('en')} km of missing you, so far`, sound: 'success',
      }));
    }
    hud.say(found.size === total ? 'every slide found, pull again to wander' : 'pull the lever for another');
    gsap.to(strip.items[cur].mat.uniforms.uNeg, { value: 0, duration: 1.0, delay: 0.2 });
  };

  const turn = (d) => {
    focus += d;
    wheel.rotation.x -= d * 2.2;
    // detents on the wheel; they ring higher as the image comes in
    if (Math.abs(focus - lastTick) > 0.045) {
      lastTick = focus;
      sfx.tick(0.7 + near() * 0.9, 0.06 + near() * 0.08);
    }
    if (sharp) return;
    const err = Math.abs(focus - aim);
    if (err < 0.06) return lockIn();
    // say which way is right, but only now and then
    const now = performance.now();
    if (now - hintAt > 450 && Math.abs(err - lastErr) > 0.05) {
      hintAt = now;
      hud.setCaption({ small: `FRAME ${frameNo(cur)} · OUT OF FOCUS`, title: err < lastErr ? (err < 0.25 ? 'almost there…' : 'closer') : 'further away' });
      lastErr = err;
    }
  };

  stage.dragHandler = { label: 'drag ⟷ to focus', move: (dx) => turn(dx * 0.0042) };
  stage.wheelHandler = (d) => turn(clamp(d, -60, 60) * 0.0016);

  stage.pick(v.lever, {
    label: 'pull for a random slide',
    enter: () => (knobTo = 1.22),
    leave: () => (knobTo = 1),
    press: () => (knobTo = 0.9),
    click: () => {
      knobTo = 1.22;
      pull();
    },
  });
  stage.pick(v.screen, { label: () => (sharp ? 'another slide' : 'drag ⟷ to focus'), click: () => sharp && pull() });
  stage.pick(wheel, { label: 'drag ⟷ to focus', cursor: 'ew-resize' });

  stage.onFrame((dt, t) => {
    screen.uniforms.uTime.value = t;
    knob.scale.setScalar(damp(knob.scale.x, knobTo, 14, dt));
    const glow = spinning ? 0 : sharp ? (cur < 0 ? 0 : 0.55) : near() ** 3;
    lampGlow.material.opacity = damp(lampGlow.material.opacity, glow, 10, dt);
    lampMat.color.setRGB(0.25 + glow * 2.2, 0.08 + glow * 0.9, 0.04 + glow * 0.3);
    if (!sharp && !spinning) {
      const err = Math.abs(focus - aim);
      screen.uniforms.uBlur.value = damp(screen.uniforms.uBlur.value, Math.min(1, err) * 0.042 + 0.002, 12, dt);
      // a slow breath in the image hints that something is there to find
      screen.uniforms.uBright.value = 1.18 + Math.sin(t * 2) * 0.04 * Math.min(1, err);
      if (performance.now() - shownAt > 5000 && !focusGuide) focusGuide = stage.anchor(wheel, '← drag to focus →', { dy: -40 });
    }
  });

  const keys = (e) => {
    if (e.key === ' ' || e.key === 'Enter') pull();
    else if (e.key === 'ArrowRight') turn(0.05);
    else if (e.key === 'ArrowLeft') turn(-0.05);
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', keys);
  hud.setCount(`0 OF ${total} IN FOCUS · 0 KM`);
  return () => removeEventListener('keydown', keys);
}

/* ---------- still us: a pile of prints, sorted into two heaps ---------- */

const MAX_PRINTS = 6;

function printCard(index, i, frame) {
  const g = new THREE.Group();
  const wide = isWide(frame);
  // the same paper turned on its side, the photo filling the top
  const [bw, bd, pw, ph, py, cy] = wide ? [1.2, 0.98, 1.08, 0.78, -0.05, 0.42] : [0.92, 1.2, 0.8, 1.02, -0.05, 0.53];
  g.userData.wide = wide;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(bw, 0.008, bd),
    new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.82, dithering: true }),
  );
  base.castShadow = base.receiveShadow = true;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMaterial(photoTexture(index, i, frame), { bright: 0.96 }));
  photo.rotation.x = -Math.PI / 2;
  photo.position.set(0, 0.0045, py);
  const [c, gg] = canvas(512, 64);
  gg.fillStyle = '#8a7d70';
  gg.font = `40px ${FONT.hand}`;
  gg.fillText(`${frame.date}  ·  ${frame.title}`, 12, 44);
  const caption = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, color: '#cfc6b8' }));
  caption.rotation.x = -Math.PI / 2;
  caption.position.set(wide ? -0.14 : 0, 0.0045, cy);
  g.add(base, photo, caption);
  return g;
}

/** A red grease-pencil loop drawn over a print; returns a setter for 0..1. */
function circleMark(card, seed) {
  const [c, g] = canvas(512, 640);
  const tex = canvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  if (card.userData.wide) m.rotation.z = Math.PI / 2;
  m.position.set(0, 0.006, -0.03);
  card.add(m);
  const st = { p: 0 };
  const draw = () => {
    g.clearRect(0, 0, 512, 640);
    handLoop(g, 256, 310, 222, 282, st.p, seed, { width: 11, color: '#e0372a' });
    tex.needsUpdate = true;
  };
  return { mesh: m, to: (p, duration = 0.8) => gsap.to(st, { p, duration, ease: 'power1.inOut', onUpdate: draw }) };
}

function pileMat(stage, { at, title, sub, ink, bg }) {
  const map = cardTexture({ w: 380, h: 500, bg, scale: 2, border: true, lines: [
    { text: title, font: `56px ${FONT.hand}`, x: 190, y: 66, align: 'center', color: ink },
    { text: sub, font: `500 14px ${FONT.mono}`, x: 190, y: 96, align: 'center', color: ink },
  ] });
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 2.43), new THREE.MeshStandardMaterial({ map, color: '#c4baab', roughness: 0.9, dithering: true }));
  mat.rotation.set(-Math.PI / 2, 0, at.x < 0 ? 0.05 : -0.04);
  mat.position.set(at.x, 0.004, at.z - 0.08);
  mat.receiveShadow = true;
  stage.world.add(mat);
  return mat;
}

function stillDeck(stage, app, index) {
  const roll = ROLLS[index];
  const { circled, boxed } = app.state;
  // side by side on a wide screen; on a phone the two heaps sit under the pile
  let narrow = stage.camera.aspect < 1.15;
  const HOMES = {
    narrow: { box: [-1.15, 1.75], print: [1.15, 1.75], deck: [0, -1.0], reach: 0.75, scale: 1.12, view: { pos: [0, 6.6, 2.6], target: [0, 0, 0.35], fov: 40 } },
    wide: { box: [-2.3, 0.5], print: [2.3, 0.5], deck: [0, 0.42], reach: 1.1, scale: 1.3, view: { pos: [0, 5.7, 3.7], target: [0, 0, 0.45], fov: 36 } },
  };
  const H0 = narrow ? HOMES.narrow : HOMES.wide;
  const homes = { box: new THREE.Vector3(H0.box[0], 0, H0.box[1]), print: new THREE.Vector3(H0.print[0], 0, H0.print[1]), deck: new THREE.Vector3(H0.deck[0], 0, H0.deck[1]) };
  let reach = H0.reach;
  stage.view(H0.view);
  stage.light({ pos: [0.2, 8.5, 2.6], target: [0, 0, 0.3], intensity: 160, angle: 0.8 });
  stage.parallaxAmount = 0.08;
  gsap.from(stage.rig, { py: 8.2, pz: 5.4, duration: 1.4, ease: 'power3.out' });

  const mats = {
    box: pileMat(stage, { at: homes.box, title: 'keep in the box', sub: '← DRAG LEFT', ink: '#5e4e3f', bg: '#d9cdb6' }),
    print: pileMat(stage, { at: homes.print, title: 'print these', sub: `DRAG RIGHT → · UP TO ${MAX_PRINTS}`, ink: '#a8261a', bg: '#f0d6c8' }),
  };

  let scale = H0.scale;
  let layer = 0.008 * scale + 0.002; // each sheet's own (scaled) thickness plus a hair of air
  const cards = roll.frames.map((f, i) => {
    const g = printCard(index, i, f);
    g.scale.setScalar(scale);
    stage.world.add(g);
    return { g, i, frame: f, jitter: { x: (Math.random() - 0.5) * 0.08, z: (Math.random() - 0.5) * 0.08, r: (Math.random() - 0.5) * 0.12 } };
  });
  const deck = cards.filter((c) => !circled.has(c.i) && !boxed.has(c.i)).reverse(); // last element is on top
  const piles = {
    print: [...circled].map((i) => cards[i]),
    box: [...boxed].map((i) => cards[i]),
  };

  const restAt = (where, k, c) => {
    const h = homes[where];
    const spread = where === 'deck' ? 0.35 : 1;
    // the bottom sheet's underside sits just above the mat (the mat is 0.004 up), the rest one on another
    return { x: h.x + c.jitter.x * spread, y: 0.005 + 0.004 * scale + k * layer, z: h.z + c.jitter.z * spread, r: c.jitter.r * (where === 'deck' ? 0.5 : 1.6) };
  };
  const placeAll = () => {
    for (const where of ['deck', 'box', 'print']) {
      const list = where === 'deck' ? deck : piles[where];
      list.forEach((c, k) => {
        const p = restAt(where, k, c);
        c.g.position.set(p.x, p.y, p.z);
        c.g.rotation.y = p.r;
      });
    }
  };
  placeAll();
  for (const c of piles.print) (c.mark = circleMark(c.g, c.i * 31 + 5)).to(1, 0.01);

  // crossing the phone/desk breakpoint: the heaps, their mats and the camera move to the other
  // arrangement, and every print slides to its place in it; nothing about the sorting changes
  stage.onFrame(() => {
    const now = stage.camera.aspect < 1.15;
    if (now === narrow || grab) return;
    narrow = now;
    const H = narrow ? HOMES.narrow : HOMES.wide;
    for (const key of ['box', 'print', 'deck']) homes[key].set(H[key][0], 0, H[key][1]);
    reach = H.reach;
    scale = H.scale;
    layer = 0.008 * scale + 0.002;
    stage.view(H.view, 1.0);
    for (const key of ['box', 'print']) gsap.to(mats[key].position, { x: homes[key].x, z: homes[key].z - 0.08, duration: 0.9, ease: 'power2.inOut' });
    for (const where of ['deck', 'box', 'print']) {
      const list = where === 'deck' ? deck : piles[where];
      list.forEach((c, k) => {
        const p = restAt(where, k, c);
        gsap.to(c.g.position, { x: p.x, y: p.y, z: p.z, duration: 0.9, ease: 'power2.inOut', overwrite: true });
        gsap.to(c.g.scale, { x: scale, y: scale, z: scale, duration: 0.9, ease: 'power2.inOut' });
      });
    }
  });

  const top = () => deck[deck.length - 1] ?? null;
  const sync = () => {
    const n = piles.print.length;
    hud.setCount(`${n} OF ${MAX_PRINTS} TO PRINT · ${deck.length} LEFT`);
    const t = top();
    hud.setCaption(t ? { small: `${t.frame.date} · FRAME ${frameNo(t.i)}`, title: t.frame.title } : null);
    if (!t) hud.say(n ? 'all sorted. tap a heap to take one back' : 'nothing to print? tap the box to take one back');
  };
  sync();

  // a print moving from one place to another: light paper skims over just above the table,
  // slows on its own air, its leading edge lifted a touch, and settles flat once
  const fly = (c, where, k, then) => {
    const p = restAt(where, k, c);
    gsap.killTweensOf([c.g.position, c.g.rotation]);
    const dir = Math.sign(p.x - c.g.position.x) || 1;
    gsap.timeline({ onComplete: then })
      .to(c.g.position, { x: p.x, z: p.z, duration: 0.75, ease: 'power3.out' }, 0)
      // up off whichever is higher, where it was or where it's going, so it never dips into a heap
      .to(c.g.position, { y: Math.max(c.g.position.y, p.y) + 0.08, duration: 0.2, ease: 'power2.out' }, 0)
      // skimming high enough that its tipped edge clears the heap it's passing over
      .to(c.g.position, { y: p.y + 0.03, duration: 0.42, ease: 'sine.inOut' }, 0.2)
      .to(c.g.position, { y: p.y, duration: 0.22, ease: 'power1.out' }, 0.62)
      .to(c.g.rotation, { y: p.r, duration: 0.75, ease: 'power3.out' }, 0)
      // tipped only once it is up off the heap
      .to(c.g.rotation, { z: -dir * 0.025, x: 0, duration: 0.2, ease: 'power2.out' }, 0.12)
      .to(c.g.rotation, { z: 0, duration: 0.5, ease: 'sine.out' }, 0.3);
  };

  let refused = 0;
  const send = (where) => {
    const c = top();
    if (!c) return;
    guides.forEach((g) => g.hide());
    if (where === 'print' && piles.print.length >= MAX_PRINTS) {
      refused++;
      sfx.nope();
      hud.say(`${COPY.printLimit}. take one back from the print heap first`);
      gsap.fromTo(mats.print.scale, { x: 1.05, y: 1.05 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      return settle(c);
    }
    deck.pop();
    piles[where].push(c);
    (where === 'print' ? circled : boxed).add(c.i);
    where === 'print' ? sfx.pen() : sfx.paper();
    fly(c, where, piles[where].length - 1, () => {
      if (where !== 'print') return;
      (c.mark ??= circleMark(c.g, c.i * 31 + 5)).to(1);
      const sp = stage.toScreen(c.g.getWorldPosition(new THREE.Vector3()));
      hud.burst(sp.x, sp.y, { n: 12, spread: 70, color: '255,120,90' });
      const k = piles.print.length;
      if (k === MAX_PRINTS) hud.toast('six chosen', { kicker: 'still us', line: 'they wait for the darkroom', sound: 'success' });
      else if (k === 1) hud.toast('the first keeper', { kicker: 'still us', line: `up to ${MAX_PRINTS}, choose slowly`, sound: 'chime' });
    });
    if (!deck.length) gsap.delayedCall(0.6, () => hud.toast('all sorted', { kicker: 'still us · 24 frames', line: `${piles.print.length} to print, the rest kept safe`, sound: 'success' }));
    if (refused && where !== 'print') hud.say(roll.hint);
    sync();
  };

  const takeBack = (where) => {
    const c = piles[where].pop();
    if (!c) return;
    (where === 'print' ? circled : boxed).delete(c.i);
    c.mark?.to(0, 0.25);
    deck.push(c);
    sfx.paper();
    fly(c, 'deck', deck.length - 1);
    hud.say(roll.hint);
    sync();
  };

  const settle = (c) => {
    const p = restAt('deck', deck.length - 1, c);
    gsap.to(c.g.position, { x: p.x, y: p.y, z: p.z, duration: 0.6, ease: 'power3.out' });
    gsap.to(c.g.rotation, { y: p.r, z: 0, duration: 0.6, ease: 'power3.out' });
  };

  // dragging the top print
  let grab = null;
  const lean = { box: 0, print: 0 };
  stage.dragHandler = {
    label: null,
    start: () => {
      const hit = stage.hit();
      const c = top();
      grab = c && hit?.object === c.g ? { c, off: null, vx: 0, last: performance.now() } : null;
      if (grab) gsap.killTweensOf(c.g.position);
    },
    move: () => {
      if (!grab) return;
      const p = stage.pointOnPlane(0.4);
      if (!p) return;
      const g = grab.c.g.position;
      grab.off ??= { x: g.x - p.x, z: g.z - p.z };
      const now = performance.now();
      const nx = p.x + grab.off.x;
      grab.vx = grab.vx * 0.5 + ((nx - (grab.x ?? nx)) / Math.max(8, now - grab.last)) * 1000 * 0.5;
      grab.x = nx;
      grab.z = p.z + grab.off.z * 0.5;
      grab.last = now;
    },
    end: () => {
      if (!grab) return;
      const c = grab.c;
      const x = (grab.x ?? c.g.position.x) + clamp(grab.vx, -12, 12) * 0.12;
      grab = null;
      if (x > reach) send('print');
      else if (x < -reach) send('box');
      else settle(c);
    },
  };

  stage.onFrame((dt, t) => {
    const c = top();
    if (grab?.x !== undefined) {
      const g = grab.c.g;
      g.position.x = damp(g.position.x, grab.x, 20, dt);
      g.position.z = damp(g.position.z, grab.z, 20, dt);
      g.position.y = damp(g.position.y, 0.45, 14, dt);
      g.rotation.y = damp(g.rotation.y, -g.position.x * 0.09, 10, dt);
      g.rotation.z = damp(g.rotation.z, -clamp(grab.vx, -8, 8) * 0.012, 8, dt);
    } else if (c && !touched && t > 2.2 && !gsap.isTweening(c.g.position)) {
      // until someone touches it, the top print leans one way and the other
      const w = Math.sin(t * 1.6);
      c.g.position.x = homes.deck.x + c.jitter.x * 0.35 + Math.sign(w) * Math.abs(w) ** 6 * reach * 0.38;
      c.g.rotation.y = c.jitter.r * 0.5 - Math.sign(w) * Math.abs(w) ** 6 * 0.08;
    }
    // the heap you're heading for brightens
    const x = grab ? grab.c.g.position.x : 0;
    lean.print = damp(lean.print, smooth(reach * 0.3, reach, x), 10, dt);
    lean.box = damp(lean.box, smooth(-reach * 0.3, -reach, x), 10, dt);
    mats.print.material.emissive.setRGB(0.32, 0.08, 0.04).multiplyScalar(lean.print);
    mats.box.material.emissive.setRGB(0.18, 0.14, 0.1).multiplyScalar(lean.box);
  });

  let touched = deck.length < cards.length;
  for (const c of cards) {
    stage.pick(c.g, {
      label: () => {
        if (c === top()) return 'drag ⟷ to sort';
        if (c === piles.print.at(-1)) return 'take it back';
        if (c === piles.box.at(-1)) return 'take it back';
        return null;
      },
      cursor: () => (c === top() ? 'grab' : c === piles.print.at(-1) || c === piles.box.at(-1) ? 'pointer' : 'default'),
      press: () => (touched = true),
      click: () => {
        if (c === piles.print.at(-1)) takeBack('print');
        else if (c === piles.box.at(-1)) takeBack('box');
        else if (c === top()) gsap.fromTo(c.g.position, { y: c.g.position.y }, { y: c.g.position.y + 0.18, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
      },
    });
  }
  stage.pick(mats.print, { label: () => (piles.print.length ? 'take the last one back' : null), click: () => takeBack('print') });
  stage.pick(mats.box, { label: () => (piles.box.length ? 'take the last one back' : null), click: () => takeBack('box') });

  const guides = touched ? [] : [
    stage.anchor(new THREE.Vector3(homes.deck.x + 0.9, 0.3, homes.deck.z), 'print it →', { side: 'right', dx: narrow ? -10 : 20 }),
    stage.anchor(new THREE.Vector3(homes.deck.x - 0.9, 0.3, homes.deck.z), '← keep it', { side: 'left', dx: narrow ? 10 : -20 }),
  ];

  const keys = (e) => {
    if (e.key === 'ArrowRight') send('print');
    else if (e.key === 'ArrowLeft') send('box');
    else if (e.key === 'Backspace') takeBack(circled.size ? 'print' : 'box');
    else return;
    touched = true;
    e.preventDefault();
  };
  addEventListener('keydown', keys);
  return () => removeEventListener('keydown', keys);
}
