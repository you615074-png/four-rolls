import * as THREE from 'three';
import { ROLLS, COPY, LETTER } from '../content.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { CAN, canister, pen } from '../props.js';
import { buildDesk, envelope, notebook, parcel, printEnvelope } from '../deskSet.js';
import { canvas, canvasTexture, damp, photoMaterial, photoTexture } from '../util.js';
import { selectedFrames } from './darkroom.js';

const gsap = window.gsap;
const STILL = 3;

// where things sit on the desk
const BOX = { x: 0.3, z: -0.15 }; // the parcel, until it's unpacked
// once it's empty the box is carried off past the top of the frame, on a line that misses the mug and the pen
const AWAY = { x: 2.6, z: -7.6 };
const LID = { x: -3.9, z: -2.0, ry: 0.22 }; // the lid, set down beside it
const ENV_ASIDE = { x: -3.85, z: 2.35, ry: 0.18 };
const LAYOUT = [
  // every roll lands clear of where the box stood, so nothing passes through it
  { x: -2.3, z: 0.45, yaw: 0.35, roll: 1.0 },
  { x: -0.4, z: 2.05, yaw: -0.2, roll: 0.75 },
  { x: 2.0, z: 1.75, yaw: 0.12, roll: 0.95 },
  { x: 3.75, z: 2.65, yaw: -0.1, roll: 0.85 },
];
// on a tall, narrow screen the sides of the desk are out of frame: two rows in front instead
const LAYOUT_NARROW = [
  { x: 0.12, z: 1.75, yaw: 0.05, roll: 1.0 },
  { x: 2.22, z: 1.85, yaw: -0.05, roll: 0.75 },
  { x: 0.02, z: 3.1, yaw: -0.04, roll: 0.95 },
  { x: 2.3, z: 3.2, yaw: 0.06, roll: 0.85 },
];
const ENV_NARROW = { x: 0.9, z: 4.35, ry: -0.08 };
// the four cans packed two by two inside the box (relative to the box)
const PACKED = [
  { x: -0.95, z: -0.5 },
  { x: 0.88, z: -0.5 },
  { x: -0.95, z: 0.5 },
  { x: 0.88, z: 0.5 },
];

function tickMark() {
  const [c, g] = canvas(256, 256);
  g.strokeStyle = '#c8402f';
  g.lineWidth = 16;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(58, 142);
  g.quadraticCurveTo(84, 160, 104, 196);
  g.quadraticCurveTo(140, 110, 206, 58);
  g.stroke();
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, opacity: 0.9 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** The parcel as it is once opened: lid set down beside it, string gone. */
function settleOpen(p, at) {
  p.group.position.set(at.x, 0, at.z);
  p.twine.visible = false;
  p.lid.position.set(LID.x - at.x, 0.35, LID.z - at.z);
  p.lid.rotation.y = LID.ry;
}

const goEdit = () => (location.href = './edit.html');
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => v * v * (3 - 2 * v);
const VIEW = { py: 8.2, pz: 5.6, tz: 0.35 };
const LIFT = 2.0; // how high a can is raised before it travels: well clear of the walls

/**
 * Where a can is at progress t (0 packed, 1 on the desk): straight up out of the box,
 * across, then set down, with the phases overlapping a little so it never stops dead.
 */
function canPath(t, a, L) {
  const up = 1 - (1 - clamp01(t / 0.3)) ** 3;
  const move = smooth(clamp01((t - 0.24) / 0.52));
  const down = smooth(clamp01((t - 0.7) / 0.3));
  const y = (a.y + (LIFT - a.y) * up) * (1 - down);
  return { x: a.x + (L.x - a.x) * move, y, z: a.z + (L.z - a.z) * move, turn: move };
}

/* ---------- the desk: a parcel, a letter on top, four rolls underneath ---------- */

export function deskScene(stage, app) {
  const st = app.state;
  const narrow = stage.camera.aspect < 1.05;
  const layout = narrow ? LAYOUT_NARROW : LAYOUT;
  const aside = narrow ? ENV_NARROW : ENV_ASIDE;
  const opened = st.visited;
  const counted = () => `${opened.size} OF 4 OPENED`;
  const status = () => (!st.parcelOpen ? '1 PARCEL' : !st.letterRead ? '1 LETTER' : counted());
  hud.set({ scene: 'THE DESK', count: status(), title: true, back: false });
  stage.view({ pos: [0.3, 8.2, 5.6], target: [0.3, 0, 0.35], fov: 34 });
  stage.parallaxAmount = 0.18;
  if (!st.parcelOpen) gsap.from(stage.rig, { py: 10.5, pz: 7.6, duration: 2.6, ease: 'power2.out' });
  // on a narrow screen the rolls sit further forward, so the lamp leans that way
  buildDesk(stage, { lampAim: narrow ? [0.7, 0, 1.9] : [0.3, 0, 0.4] });

  // the sender's notebook: where the parcel gets packed (a separate page)
  const book = notebook();
  book.position.set(4.5, 0, 0.45);
  book.rotation.y = -0.22;
  stage.world.add(book);
  const bookLift = { h: 0, to: 0 };
  stage.onFrame((dt) => {
    bookLift.h = damp(bookLift.h, bookLift.to, 10, dt);
    book.position.y = 0.08 + bookLift.h * 0.1;
  });
  stage.pick(book, { label: '寄件人 · pack the parcel', enter: () => (bookLift.to = 1), leave: () => (bookLift.to = 0), click: goEdit });
  const p1 = pen('red');
  p1.rotation.set(Math.PI / 2, 0, -0.4);
  p1.position.set(3.5, 0.07, -0.55);
  stage.world.add(p1);

  const box = parcel({ to: LETTER.to.replace(/^dear\s+/i, '').replace(/[,，]$/, '') || 'you' });
  stage.world.add(box.group);
  const env = envelope();
  stage.world.add(env);

  /* the rolls: packed in the box, lifted out once the letter's been read */
  let invite = null;
  const rolls = [];
  ROLLS.forEach((roll, i) => {
    const holder = new THREE.Group();
    const tilt = new THREE.Group();
    const can = canister(roll);
    tilt.rotation.z = Math.PI / 2;
    tilt.position.set(CAN.h / 2, CAN.r + 0.03, 0);
    tilt.add(can);
    holder.add(tilt);
    stage.world.add(holder);
    const s = { h: 0, to: 0, t: st.letterRead ? 1 : 0, drop: 0 };
    rolls.push({ holder, can, s, roll, i });
  });
  const packedAt = (i) => ({ x: BOX.x + PACKED[i].x, y: 0.05, z: BOX.z + PACKED[i].z });
  stage.onFrame((dt, t) => {
    for (const r of rolls) {
      const { s, holder, can, i } = r;
      s.h = damp(s.h, s.to, 9, dt);
      const L = layout[i], a = packedAt(i);
      const p = canPath(s.t, a, L);
      const nudge = s.t < 1 || opened.has(i) ? 0 : Math.max(0, Math.sin(t * 1.4 - i * 1.6)) ** 14;
      holder.position.set(p.x, p.y + s.drop + s.h * 0.24, p.z);
      holder.rotation.y = L.yaw * p.turn + s.h * 0.1;
      // a small sway while it's in the air, gone by the time it lands
      holder.rotation.x = Math.sin(Math.PI * p.turn) * 0.08;
      can.rotation.y = L.roll * p.turn + nudge * 0.25 + s.h * 0.15;
      // packed cans stay out of sight under the lid
      holder.visible = st.parcelOpen || s.t > 0;
    }
  });
  const makePickable = () => {
    for (const { holder, s, roll, i } of rolls) {
      stage.pick(holder, {
        label: opened.has(i) ? `${roll.name} · again` : `open ${roll.name}`,
        enter: () => {
          s.to = 1;
          invite?.hide();
        },
        leave: () => (s.to = 0),
        click: () => app.go('roll', { index: i }),
      });
      if (opened.has(i)) {
        const tick = tickMark();
        tick.position.set(layout[i].x + 0.1, 0.012, layout[i].z + 0.8);
        stage.world.add(tick);
      }
    }
    if (!opened.size) invite = stage.anchor(new THREE.Vector3(layout[2].x - 0.85, 0.9, layout[2].z), 'tap a roll to open it', { dy: -26 });
  };

  const ready = () => {
    hud.setCount(counted());
    hud.say(COPY.pickOne);
    // the darkroom is open as soon as you're through the letter; no need to see every roll first
    hud.cta(COPY.toDarkroom, () => app.go('lightbox'));
  };

  /* the letter */
  const envLift = { h: 0, to: 0, base: 0.011 };
  stage.onFrame((dt) => {
    envLift.h = damp(envLift.h, envLift.to, 10, dt);
    env.position.y = envLift.base + envLift.h * 0.12;
  });
  const envOnTop = () => {
    env.position.set(BOX.x - 0.15, 1.02, BOX.z + 0.05);
    env.rotation.y = -0.08;
    envLift.base = 1.02;
  };
  const envAside = () => {
    env.position.set(aside.x, 0.011, aside.z);
    env.rotation.y = aside.ry;
    envLift.base = 0.011;
  };
  let letterGuide = null;
  const readLetter = () => {
    letterGuide?.hide();
    sfx.paper();
    envLift.to = 0;
    hud.say(null);
    hud.cta(null);
    showLetter(() => {
      const first = !st.letterRead;
      st.letterRead = true;
      // the envelope is lifted clear of the box, carried to the corner, then laid down
      if (envLift.base > 0.5) {
        const et = gsap.timeline();
        et.to(envLift, { base: 1.7, duration: 0.45, ease: 'power2.out' });
        et.to(env.position, { x: aside.x, z: aside.z, duration: 0.85, ease: 'power2.inOut' }, '-=0.1');
        et.to(env.rotation, { y: aside.ry, duration: 0.85, ease: 'power2.inOut' }, '<');
        et.to(envLift, { base: 0.011, duration: 0.4, ease: 'power2.in', onComplete: () => sfx.paper() }, '-=0.15');
      }
      if (first) {
        // each can raised straight out, carried across and set down, one after another
        rolls.forEach(({ s }, i) => {
          gsap.to(s, {
            t: 1, duration: 1.45, delay: 1.0 + i * 0.38, ease: 'none',
            onStart: () => sfx.tick(0.55 + i * 0.05, 0.16),
            onComplete: () => {
              sfx.tick(0.38, 0.22);
              if (i === 3) done();
            },
          });
        });
        // the camera eases back out to take in the whole desk
        gsap.to(stage.rig, { ...VIEW, duration: 2.4, delay: 0.8, ease: 'power2.inOut', overwrite: 'auto' });
        const done = () => {
          makePickable();
          ready();
          // the card comes once the box is gone, not over the top of it
          takeBoxAway(() => hud.toast('four rolls, out of the box', { kicker: 'the parcel', line: 'open any one, in any order', hold: 2.4 }));
        };
      } else ready();
    });
  };
  stage.pick(env, {
    label: () => (st.letterRead ? 'read the letter again' : 'open the letter'),
    enter: () => (envLift.to = 1),
    leave: () => (envLift.to = 0),
    click: readLetter,
  });

  /* the empty box: lid back on, lifted a little, carried off the top of the frame */
  const takeBoxAway = (then) => {
    const lid = box.lid;
    const tl = gsap.timeline({ delay: 0.3 });
    tl.to(lid.position, { y: box.H + 1.0, duration: 0.45, ease: 'power2.out' });
    tl.to(lid.rotation, { y: 0, duration: 0.8, ease: 'power2.inOut' }, '<');
    tl.to(lid.position, { x: 0, z: 0, duration: 0.8, ease: 'power2.inOut' }, '-=0.2');
    tl.to(lid.position, { y: box.H + 0.03, duration: 0.3, ease: 'power2.in', onComplete: () => sfx.tick(0.32, 0.2) });
    tl.to(box.group.position, { y: 0.22, duration: 0.4, ease: 'power2.out' }, '+=0.15');
    tl.to(box.group.rotation, { z: 0.025, x: -0.02, duration: 0.4, ease: 'power2.out' }, '<');
    tl.to(box.group.position, { x: AWAY.x, z: AWAY.z, duration: 1.5, ease: 'power2.in', onStart: () => sfx.paper() });
    tl.to(box.group.rotation, { y: -0.12, duration: 1.5, ease: 'power1.in' }, '<');
    tl.add(() => {
      box.group.visible = false;
      then?.();
    });
  };

  /* the parcel itself */
  const untie = () => {
    if (st.parcelOpen) return;
    st.parcelOpen = true;
    stage.unpick(box.group);
    parcelGuide?.hide();
    hud.say(null);
    // lean in a little while it's opened
    gsap.to(stage.rig, { py: 7.0, pz: 4.5, tz: 0.05, duration: 1.8, ease: 'power2.inOut', overwrite: 'auto' });
    // the bow is pulled loose, the string slackens, lifts clear and is drawn off to the side
    const tl = gsap.timeline();
    tl.add(() => sfx.paper());
    tl.to(box.bow.map((m) => m.scale), { x: 0.05, y: 0.05, z: 0.05, duration: 0.4, ease: 'power2.in', stagger: 0.04 });
    tl.to(box.bow.map((m) => m.rotation), { y: '+=1.2', duration: 0.4, ease: 'power2.in', stagger: 0.04 }, '<');
    tl.to(box.twine.scale, { x: 1.07, z: 1.09, duration: 0.3, ease: 'power1.out' });
    tl.to(box.twine.position, { y: 1.45, duration: 0.6, ease: 'power2.inOut' }, '-=0.1');
    tl.to(box.twine.position, { x: 4.5, y: 2.2, duration: 0.55, ease: 'power2.in' });
    tl.to(box.cord, { opacity: 0, duration: 0.35, ease: 'power1.in' }, '-=0.35');
    tl.add(() => (box.twine.visible = false));
    // then the lid: lifted with a slight tilt, carried to the side, set down flat
    const lid = box.lid;
    tl.add(() => sfx.paper(), '-=0.5');
    tl.to(lid.position, { y: box.H + 1.05, duration: 0.6, ease: 'power2.out' }, '-=0.5');
    tl.to(lid.rotation, { x: -0.14, z: 0.05, duration: 0.6, ease: 'power2.out' }, '<');
    tl.to(lid.position, { x: LID.x - BOX.x, z: LID.z - BOX.z, duration: 0.95, ease: 'power2.inOut' }, '-=0.1');
    tl.to(lid.rotation, { y: LID.ry, x: 0.06, z: -0.03, duration: 0.95, ease: 'power2.inOut' }, '<');
    tl.to(lid.position, { y: 0.35, duration: 0.45, ease: 'power2.in' }, '-=0.2');
    tl.to(lid.rotation, { x: 0, z: 0, duration: 0.45, ease: 'power2.in', onComplete: () => sfx.tick(0.4, 0.2) }, '<');
    tl.add(() => {
      hud.setCount(status());
      hud.say(COPY.letterWaits);
      letterGuide = stage.anchor(new THREE.Vector3(BOX.x - 0.15, 1.3, BOX.z + 0.05), 'a letter, on top', { dy: -30 });
    }, '-=0.6');
  };
  let parcelGuide = null;

  if (!st.parcelOpen) {
    box.group.position.set(BOX.x, 0, BOX.z);
    envOnTop();
    stage.pick(box.group, { label: 'untie the string', click: untie });
    // on a phone the notebook can sit at the edge of the frame, so the way in goes under the picture too
    hud.say(COPY.parcel, innerWidth < 700 ? { label: '寄件人 · pack it', run: goEdit } : null);
    parcelGuide = stage.anchor(new THREE.Vector3(BOX.x + 0.35, box.H + 0.3, BOX.z), 'a parcel came for you', { dy: -30 });
  } else if (!st.letterRead) {
    settleOpen(box, BOX);
    envOnTop();
    hud.say(COPY.letterWaits);
    letterGuide = stage.anchor(new THREE.Vector3(BOX.x - 0.15, 1.3, BOX.z + 0.05), 'a letter, on top', { dy: -30 });
  } else {
    box.group.visible = false;
    envAside();
    rolls.forEach(({ s }, i) => {
      s.drop = 0.6;
      gsap.to(s, { drop: 0, duration: 0.9, delay: 0.25 + 0.08 * i, ease: 'bounce.out' });
    });
    makePickable();
    ready();
  }
  return () => closeLetter(true);
}

/* ---------- the letter, written out by hand ---------- */

const letterEl = document.querySelector('#letter');
let letterRun = null;

function closeLetter(instant = false) {
  if (letterEl.hidden) return;
  letterRun?.kill();
  letterRun = null;
  if (instant) {
    letterEl.hidden = true;
    return;
  }
  gsap.to(letterEl, { opacity: 0, duration: 0.45, onComplete: () => (letterEl.hidden = true) });
}

function showLetter(onDone) {
  const body = letterEl.querySelector('.letter-body');
  const done = letterEl.querySelector('.letter-done');
  letterEl.querySelector('.letter-to').textContent = LETTER.to;
  letterEl.querySelector('.letter-sign').textContent = LETTER.sign;
  body.innerHTML = '';
  const lines = LETTER.paragraphs.map((p) => {
    const el = document.createElement('p');
    el.textContent = p;
    body.appendChild(el);
    return el;
  });
  const parts = [letterEl.querySelector('.letter-to'), ...lines, letterEl.querySelector('.letter-sign')];
  done.hidden = true;
  letterEl.hidden = false;
  gsap.fromTo(letterEl, { opacity: 0 }, { opacity: 1, duration: 0.5 });
  gsap.fromTo(letterEl.querySelector('.letter-paper'), { y: 60, rotate: 4 }, { y: 0, rotate: -1, duration: 1.0, ease: 'power3.out' });

  // each line appears as if the pen were moving across it
  const tl = gsap.timeline({ delay: 0.6, onComplete: () => finish() });
  for (const el of parts) {
    const len = Math.max(0.5, Math.min(3.2, el.textContent.length * 0.035));
    tl.fromTo(el, { clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0% 0 0)', duration: len, ease: 'none', onStart: () => sfx.pen() }, '+=0.25');
  }
  letterRun = tl;
  const finish = () => {
    tl.progress(1);
    done.hidden = false;
    gsap.fromTo(done, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5 });
  };
  letterEl.onclick = (e) => {
    if (e.target.closest('.letter-done')) {
      letterEl.onclick = null;
      closeLetter();
      onDone();
    } else if (done.hidden) finish();
  };
}

/* ---------- the end: the prints, back on the desk ---------- */

export function pickupScene(stage, app) {
  const picks = selectedFrames(app);
  const st = app.state.stats;
  hud.set({ scene: 'TO KEEP', count: `${picks.length} PRINTS` });
  stage.view({ pos: [0.3, 6.6, 4.6], target: [0.3, 0, 0.1], fov: 34 });
  stage.parallaxAmount = 0.12;
  gsap.from(stage.rig, { py: 8, pz: 6, duration: 1.6, ease: 'power3.out' });
  buildDesk(stage, { lampAim: [-1.2, 0, 0.3] });

  const box = parcel();
  stage.world.add(box.group);
  settleOpen(box, { x: 2.6, z: -2.9 });

  const wallet = printEnvelope(ROLLS[STILL].name);
  wallet.position.set(-3.0, 0, 0.6);
  wallet.rotation.y = 0.1;
  stage.world.add(wallet);
  // the prints, slid half out of their envelope
  picks.slice(0, 4).forEach((frameIndex, k) => {
    const f = ROLLS[STILL].frames[frameIndex];
    const w = f.wide ? 1.1 : 0.82, h = f.wide ? 0.82 : 1.1;
    const card = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.006, h + 0.1), new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.8 }));
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(w, h), photoMaterial(photoTexture(STILL, frameIndex, f), { mono: 1, bright: 0.95 }));
    ph.rotation.x = -Math.PI / 2;
    ph.position.y = 0.004;
    paper.castShadow = true;
    card.add(paper, ph);
    card.position.set(-1.35 + k * 0.38, 0.09 + k * 0.008, 0.45 - k * 0.06);
    card.rotation.y = -0.25 + k * 0.17;
    stage.world.add(card);
    gsap.from(card.position, { x: -3.0, duration: 1.0, delay: 0.6 + k * 0.15, ease: 'power3.out' });
  });

  const r = document.querySelector('#receipt');
  const rows = [
    ['rolls opened', `${app.state.visited.size} / 4`],
    ['prints', `${picks.length}`],
  ];
  if (st.developed) rows.push(['frames developed', `${st.developed}`]);
  if (st.notes) rows.push(['notes read', `${st.notes}`]);
  if (st.km) rows.push(['km apart', `${st.km.toLocaleString('en')}`]);
  r.querySelector('.receipt-rows').innerHTML = rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
  r.querySelector('.receipt-date').textContent = new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
  r.hidden = false;
  gsap.fromTo(r, { opacity: 0, y: 40, rotate: 3 }, { opacity: 1, y: 0, rotate: 1.5, duration: 0.9, delay: 0.5, ease: 'power3.out' });
  gsap.fromTo(r.querySelector('.receipt-stamp'), { opacity: 0, scale: 1.8 }, { opacity: 0.8, scale: 1, duration: 0.4, delay: 1.6, ease: 'back.out(2)', onStart: () => sfx.clack() });
  hud.say(COPY.thanks, { label: COPY.rewind, run: () => app.go('shop', { reset: true }) });
  return () => (r.hidden = true);
}
