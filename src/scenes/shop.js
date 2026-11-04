import * as THREE from 'three';
import { ROLLS, COPY, LETTER } from '../content.js';
import { hud } from '../hud.js';
import { sfx } from '../sfx.js';
import { CAN, canister, pen } from '../props.js';
import { buildCounter, buildStorefront, envelope, photoWallet, serviceBell, ticketPad } from '../shopSet.js';
import { canvas, canvasTexture, damp, photoMaterial, photoTexture } from '../util.js';
import { selectedFrames } from './darkroom.js';

const gsap = window.gsap;
const STILL = 3;

/* ---------- outside: the shop on the street ---------- */

export function shopScene(stage, app) {
  hud.set({ scene: '街外 · OUTSIDE', count: '營業中 · OPEN' });
  // on a phone the staff door is off to the side of the frame, so the way in goes under the picture too
  hud.say(COPY.stepIn, innerWidth < 700 ? { label: '店主入口 owner', run: () => (location.href = './edit.html') } : null);
  stage.table.visible = false;
  stage.scene.background.set('#05080a');
  stage.scene.fog.color.set('#05080a');
  stage.hemi.color.set('#6d84a8');
  stage.hemi.groundColor.set('#0b0d10');
  stage.parallaxAmount = 0.22;
  stage.view({ pos: [0, 2.2, 10.5], target: [0, 2.7, 0], fov: 38 });
  stage.light({ pos: [-4, 9, 9], target: [0, 1.5, 0], intensity: 30, angle: 0.55, hemi: 0.18 });
  gsap.from(stage.rig, { pz: 13, py: 2.6, duration: 2.2, ease: 'power2.out' });

  const s = buildStorefront(stage);
  stage.onFrame(s.tick);

  const look = { door: 0, staff: 0 };
  stage.onFrame((dt) => {
    s.inside.material.color.setScalar(0.95 + look.door * 0.2);
    s.doorGlass.material.color.setScalar(1 + look.door * 0.15);
    s.staff.material.emissive?.setRGB(look.staff * 0.12, look.staff * 0.1, look.staff * 0.06);
  });
  const ease = (k, v) => gsap.to(look, { [k]: v, duration: 0.3 });

  let going = false;
  const enter = () => {
    if (going) return;
    going = true;
    guide.hide();
    sfx.tick(0.5, 0.2);
    // the door swings in a little as you walk up to it
    gsap.to(s.door.rotation, { y: -0.9, duration: 1.0, ease: 'power2.inOut' });
    gsap.to(s.door.position, { x: -0.6, z: -0.35, duration: 1.0, ease: 'power2.inOut' });
    gsap.to(stage.rig, { pz: 2.2, py: 1.9, ty: 1.9, duration: 1.3, ease: 'power2.in', onComplete: () => app.go('counter') });
  };
  stage.pick(s.door, { label: 'step inside', enter: () => ease('door', 1), leave: () => ease('door', 0), click: enter });
  stage.pick(s.staff, {
    label: '店主入口 · owner',
    enter: () => ease('staff', 1),
    leave: () => ease('staff', 0),
    click: () => (location.href = './edit.html'),
  });
  const guide = stage.anchor(new THREE.Vector3(0, 2.9, 0.2), 'tap the door', { dy: -8 });
  return () => (stage.table.visible = true);
}

/* ---------- inside: the glass counter, a letter, then four rolls ---------- */

function tickMark() {
  const [c, g] = canvas(256, 256);
  g.strokeStyle = '#d22a20';
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

const LAYOUT = [
  { x: -2.75, z: -0.95, yaw: 0.42, roll: 1.0 },
  { x: -0.75, z: 1.35, yaw: -0.38, roll: 0.75 },
  { x: 1.45, z: -1.55, yaw: 0.12, roll: 0.95 },
  { x: 3.35, z: 0.45, yaw: -0.52, roll: 0.85 },
];

export function counterScene(stage, app) {
  const st = app.state;
  const opened = st.visited;
  const counted = () => `${opened.size} OF 4 OPENED`;
  hud.set({ scene: '櫃面 · THE COUNTER', count: st.letterRead ? counted() : '1 LETTER WAITING', title: true, back: false });
  stage.view({ pos: [0.3, 8.2, 5.6], target: [0.3, 0, 0.35], fov: 34 });
  stage.light({ pos: [0.2, 9, 3.4], target: [0.3, 0, 0.3], intensity: 120, angle: 0.75, hemi: 0.5 });
  stage.parallaxAmount = 0.18;

  buildCounter(stage);
  stage.table.visible = false;
  // the neon over the door tints the near edge of the counter
  const neon = new THREE.PointLight('#ff3550', 7, 9, 1.6);
  neon.position.set(0.3, 2.6, 5.2);
  stage.world.add(neon);

  const bell = serviceBell();
  bell.position.set(4.6, 0, -1.9);
  stage.world.add(bell);
  stage.pick(bell, {
    label: 'ring the bell',
    click: () => {
      sfx.chime();
      const [knob, cap] = bell.userData.knob;
      gsap.fromTo([knob.position, cap.position], { y: (i) => (i ? 0.49 : 0.42) }, { y: (i) => (i ? 0.53 : 0.46), duration: 0.35, ease: 'back.out(3)' });
    },
  });
  const pad = ticketPad('for you');
  pad.position.set(-4.55, 0, 1.75);
  pad.rotation.y = 0.18;
  stage.world.add(pad);
  const p1 = pen('red');
  p1.rotation.set(Math.PI / 2, 0, 0.5);
  p1.position.set(-3.75, 0.07, 2.3);
  stage.world.add(p1);

  const env = envelope();
  stage.world.add(env);
  const aside = { x: 2.55, z: 2.2, ry: -0.22 };
  if (st.letterRead) {
    env.position.set(aside.x, env.position.y, aside.z);
    env.rotation.y = aside.ry;
  } else {
    env.position.set(0.3, env.position.y, 0.55);
    env.rotation.y = -0.07;
  }
  const envLift = { h: 0, to: 0 };
  stage.onFrame((dt) => {
    envLift.h = damp(envLift.h, envLift.to, 10, dt);
    env.position.y = 0.011 + envLift.h * 0.12;
  });

  /* the rolls, set down on the glass once the letter's been read */
  let invite = null;
  const rolls = [];
  const placeRolls = (animate) => {
    ROLLS.forEach((roll, i) => {
      const L = LAYOUT[i];
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
      rolls.push(holder);
      const s = { h: 0, to: 0, drop: animate ? 0 : 0.6, slide: animate ? 1 : 0 };
      if (animate) {
        // pushed across the glass from the shopkeeper's side, one after another
        gsap.to(s, { slide: 0, duration: 0.9, delay: 0.15 + i * 0.16, ease: 'power3.out', onStart: () => sfx.tick(0.55 + i * 0.05, 0.16) });
      } else gsap.to(s, { drop: 0, duration: 0.9, delay: 0.25 + 0.08 * i, ease: 'bounce.out' });
      stage.pick(holder, {
        label: opened.has(i) ? `${roll.name} · again` : `open ${roll.name}`,
        enter: () => {
          s.to = 1;
          invite?.hide();
        },
        leave: () => (s.to = 0),
        click: () => app.go('roll', { index: i }),
      });
      stage.onFrame((dt, t) => {
        s.h = damp(s.h, s.to, 9, dt);
        const nudge = opened.has(i) ? 0 : Math.max(0, Math.sin(t * 1.4 - i * 1.6)) ** 14;
        holder.position.y = s.drop + s.h * 0.24;
        holder.position.z = L.z - s.slide * 5.5;
        holder.rotation.y = L.yaw + s.h * 0.1 + s.slide * 0.6;
        can.rotation.y = L.roll + nudge * 0.25 + s.h * 0.15 - s.slide * 4;
      });
      if (opened.has(i)) {
        const tick = tickMark();
        tick.position.set(L.x + 0.1, 0.012, L.z + 0.8);
        stage.world.add(tick);
      }
    });
    if (!opened.size) invite = stage.anchor(new THREE.Vector3(-0.75, 0.9, 1.35), 'tap a roll to open it', { dy: -26 });
  };

  const ready = () => {
    hud.setCount(counted());
    hud.say(COPY.pickOne);
    // the darkroom is open as soon as you're through the letter; no need to see every roll first
    hud.cta(COPY.toDarkroom, () => app.go('lightbox'));
  };

  const readLetter = () => {
    letterGuide?.hide();
    sfx.paper();
    envLift.to = 0;
    hud.say(null);
    hud.cta(null);
    showLetter(() => {
      const first = !st.letterRead;
      st.letterRead = true;
      gsap.to(env.position, { x: aside.x, z: aside.z, duration: 0.9, ease: 'power3.inOut' });
      gsap.to(env.rotation, { y: aside.ry, duration: 0.9, ease: 'power3.inOut' });
      if (first) {
        placeRolls(true);
        hud.toast('four rolls, set out for you', { kicker: 'the counter', line: 'open any one, in any order', hold: 2.4 });
      }
      ready();
    });
  };
  stage.pick(env, {
    label: () => (st.letterRead ? 'read the letter again' : 'open the letter'),
    enter: () => (envLift.to = 1),
    leave: () => (envLift.to = 0),
    click: readLetter,
  });

  let letterGuide = null;
  if (st.letterRead) {
    placeRolls(false);
    ready();
  } else {
    hud.say(COPY.letterWaits);
    letterGuide = stage.anchor(new THREE.Vector3(0.3, 0.3, 0.55), 'a letter, left for you', { dy: -30 });
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

/* ---------- the end: picking the prints up ---------- */

export function pickupScene(stage, app) {
  const picks = selectedFrames(app);
  const st = app.state.stats;
  hud.set({ scene: '取件 · PICK-UP', count: `${picks.length} PRINTS READY` });
  stage.view({ pos: [0.3, 6.4, 4.4], target: [0.3, 0, 0.1], fov: 34 });
  stage.light({ pos: [0.6, 9, 3], target: [0.3, 0, 0], intensity: 120, angle: 0.7, hemi: 0.5 });
  stage.parallaxAmount = 0.12;
  gsap.from(stage.rig, { py: 8, pz: 6, duration: 1.6, ease: 'power3.out' });
  buildCounter(stage);
  stage.table.visible = false;
  const neon = new THREE.PointLight('#ff3550', 6, 9, 1.6);
  neon.position.set(0.3, 2.6, 5.2);
  stage.world.add(neon);

  const wallet = photoWallet();
  wallet.position.set(-2.9, 0, 0.35);
  wallet.rotation.y = 0.08;
  stage.world.add(wallet);
  // the prints, fanned out of the wallet
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
    card.position.set(-1.25 + k * 0.36, 0.09 + k * 0.008, 0.2 - k * 0.05);
    card.rotation.y = -0.25 + k * 0.17;
    stage.world.add(card);
    gsap.from(card.position, { x: -2.9, duration: 1.0, delay: 0.6 + k * 0.15, ease: 'power3.out' });
  });

  const r = document.querySelector('#receipt');
  const rows = [
    ['菲林 ROLLS', `${app.state.visited.size} / 4`],
    ['相片 PRINTS', `${picks.length}`],
  ];
  if (st.developed) rows.push(['顯影 DEVELOPED', `${st.developed} frames`]);
  if (st.notes) rows.push(['紙條 NOTES', `${st.notes} read`]);
  if (st.km) rows.push(['距離 APART', `${st.km.toLocaleString('en')} km`]);
  r.querySelector('.receipt-rows').innerHTML = rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
  r.querySelector('.receipt-date').textContent = new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
  r.hidden = false;
  gsap.fromTo(r, { opacity: 0, y: 40, rotate: 3 }, { opacity: 1, y: 0, rotate: 1.5, duration: 0.9, delay: 0.5, ease: 'power3.out' });
  gsap.fromTo(r.querySelector('.receipt-stamp'), { opacity: 0, scale: 1.8 }, { opacity: 1, scale: 1, duration: 0.4, delay: 1.6, ease: 'back.out(2)', onStart: () => sfx.clack() });
  hud.say(COPY.thanks, { label: COPY.rewind, run: () => app.go('shop', { reset: true }) });
  return () => (r.hidden = true);
}
