import { Stage } from './stage.js';
import { hud } from './hud.js';
import { rollScene } from './scenes/rolls.js';
import { deskScene, pickupScene } from './scenes/desk.js';
import { lightboxScene, trayScene } from './scenes/darkroom.js';
import { wallScene } from './scenes/wall.js';
import { applySaved } from './store.js';
import { FONT } from './util.js';
import { sfx } from './sfx.js';

const SCENES = {
  // the desk is both the opening (a closed parcel) and where you come back to
  shop: deskScene,
  counter: deskScene,
  roll: rollScene,
  lightbox: lightboxScene,
  tray: trayScene,
  wall: wallScene,
  pickup: pickupScene,
};

// Up one level from each scene; the desk is the top, and leaving it leaves Four Rolls.
const PARENT = { roll: 'counter', lightbox: 'counter', tray: 'lightbox', wall: 'tray', pickup: 'wall' };
const BACK_TO = { counter: 'BACK TO THE DESK', lightbox: 'BACK TO THE LIGHT BOX', tray: 'BACK TO THE DARKROOM', wall: 'BACK TO THE WALL' };
// where "leave" goes: back to the page that linked here, if any (standalone, there may be none)
const EXIT = (() => {
  try {
    const from = new URL(document.referrer);
    // the desk and the sender's notes sit side by side; coming from either isn't a way out
    const own = from.origin === location.origin && new URL('.', from).pathname === new URL('.', location.href).pathname;
    if (!own) return from.href;
  } catch { /* no referrer */ }
  return null;
})();

const freshState = () => ({ parcelOpen: false, letterRead: false, visited: new Set(), circled: new Set(), boxed: new Set(), stats: { developed: 0, notes: 0, km: 0 } });

async function boot() {
  // canvas textures draw text, so the web fonts have to be ready first
  await Promise.race([
    Promise.all([
      document.fonts.load(`40px ${FONT.hand}`),
      document.fonts.load(`italic 40px ${FONT.serif}`),
      document.fonts.load(`40px ${FONT.serif}`),
      document.fonts.load(`500 20px ${FONT.mono}`),
      document.fonts.load(`20px ${FONT.type}`),
      document.fonts.load(`40px ${FONT.kai}`),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  // what the owner put in the shop (edit.html) replaces the sample rolls
  await applySaved();

  const stage = new Stage(document.querySelector('#stage'));
  let cleanup = null;
  let busy = false;

  let lastDown = null;
  addEventListener('pointerdown', (e) => (lastDown = { x: e.clientX, y: e.clientY }), true);

  const app = {
    stage,
    state: freshState(),
    current: null,
    async go(name, params = {}) {
      if (busy) return;
      busy = true;
      const from = lastDown;
      await hud.cut(() => {
        cleanup?.();
        cleanup = null;
        hud.cta(null);
        hud.sideNote(null);
        hud.picker.hidden = true;
        hud.zoom.hidden = true;
        hud.say(null);
        stage.clear();
        if (params.reset) app.state = freshState();
        app.current = name;
        document.body.dataset.scene = name;
        const r = SCENES[name](stage, app, params);
        if (typeof r === 'function') cleanup = r;
        paintBack(name);
      }, from);
      busy = false;
    },
  };

  // one button, bottom left, on every scene: up a level, or out of Four Rolls from the desk
  const paintBack = (name) => {
    const up = PARENT[name];
    const long = up ? BACK_TO[up] : 'LEAVE FOUR ROLLS';
    hud.back.replaceChildren();
    const arrow = document.createElement('i');
    arrow.textContent = '←';
    const full = document.createElement('span');
    full.className = 'hb-long';
    full.textContent = long;
    const short = document.createElement('span');
    short.className = 'hb-short';
    short.textContent = up ? 'BACK' : 'LEAVE';
    hud.back.append(arrow, ' ', full, short);
    hud.back.title = up ? '返回上一级（Esc）' : '离开 Four Rolls';
    hud.back.setAttribute('aria-label', up ? `返回上一级：${long.toLowerCase()}` : '离开 Four Rolls');
    hud.back.hidden = !up && !EXIT;
  };
  const goUp = () => {
    const up = PARENT[app.current];
    if (up) app.go(up);
    else if (EXIT) location.href = EXIT;
  };
  hud.back.addEventListener('click', goUp);
  const sound = document.querySelector('#sound');
  const paintSound = () => {
    sound.textContent = sfx.muted ? 'sound off' : 'sound on';
    sound.setAttribute('aria-pressed', String(!sfx.muted));
  };
  sound.addEventListener('click', () => {
    sfx.toggle();
    paintSound();
    if (!sfx.muted) sfx.pop();
  });
  paintSound();
  window.darkroom = app; // handy from the console while building

  document.body.dataset.scene = 'shop';
  app.current = 'shop';
  const first = deskScene(stage, app);
  if (typeof first === 'function') cleanup = first;
  paintBack('shop');
  hud.open(1.4);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const letter = document.querySelector('#letter');
    if (!hud.picker.hidden) hud.picker.querySelector('.picker-cancel').click();
    else if (!hud.zoom.hidden) hud.zoom.click();
    else if (letter && !letter.hidden) {
      // the first Esc finishes the writing, the next one folds the letter away
      const done = letter.querySelector('.letter-done');
      (done.hidden ? letter : done).click();
    } else if (PARENT[app.current]) goUp(); // Esc never leaves the page by itself
  });
}

boot();
