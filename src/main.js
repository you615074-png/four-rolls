import { Stage } from './stage.js';
import { hud } from './hud.js';
import { rollScene } from './scenes/rolls.js';
import { counterScene, pickupScene, shopScene } from './scenes/shop.js';
import { lightboxScene, trayScene } from './scenes/darkroom.js';
import { wallScene } from './scenes/wall.js';
import { applySaved } from './store.js';
import { FONT } from './util.js';
import { sfx } from './sfx.js';

const SCENES = {
  shop: shopScene,
  counter: counterScene,
  roll: rollScene,
  lightbox: lightboxScene,
  tray: trayScene,
  wall: wallScene,
  pickup: pickupScene,
};

const freshState = () => ({ letterRead: false, visited: new Set(), circled: new Set(), boxed: new Set(), stats: { developed: 0, notes: 0, km: 0 } });

async function boot() {
  // canvas textures draw text, so the web fonts have to be ready first
  await Promise.race([
    Promise.all([
      document.fonts.load(`40px ${FONT.hand}`),
      document.fonts.load(`italic 40px ${FONT.serif}`),
      document.fonts.load(`40px ${FONT.serif}`),
      document.fonts.load(`500 20px ${FONT.mono}`),
      document.fonts.load(`20px ${FONT.type}`),
      document.fonts.load(`900 40px ${FONT.sign}`),
      document.fonts.load(`600 40px ${FONT.cond}`),
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
      }, from);
      busy = false;
    },
  };

  hud.back.addEventListener('click', () => app.go('counter'));
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
  const first = shopScene(stage, app);
  if (typeof first === 'function') cleanup = first;
  hud.open(1.4);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!hud.picker.hidden) hud.picker.querySelector('.picker-cancel').click();
    else if (!hud.zoom.hidden) hud.zoom.click();
    else if (!hud.back.hidden) app.go('counter');
  });
}

boot();
