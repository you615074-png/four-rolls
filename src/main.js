import { Stage } from './stage.js';
import { hud } from './hud.js';
import { tableScene, rollScene } from './scenes/rolls.js';
import { lightboxScene, trayScene } from './scenes/darkroom.js';
import { wallScene, letterScene } from './scenes/wall.js';
import { FONT } from './util.js';
import { sfx } from './sfx.js';

const SCENES = {
  table: tableScene,
  roll: rollScene,
  lightbox: lightboxScene,
  tray: trayScene,
  wall: wallScene,
  letter: letterScene,
};

const freshState = () => ({ visited: new Set(), circled: new Set(), boxed: new Set(), stats: { developed: 0, notes: 0, km: 0 } });

async function boot() {
  // canvas textures draw text, so the web fonts have to be ready first
  await Promise.race([
    Promise.all([
      document.fonts.load(`40px ${FONT.hand}`),
      document.fonts.load(`italic 40px ${FONT.serif}`),
      document.fonts.load(`40px ${FONT.serif}`),
      document.fonts.load(`500 20px ${FONT.mono}`),
      document.fonts.load(`20px ${FONT.type}`),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

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

  hud.back.addEventListener('click', () => app.go('table'));
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

  document.body.dataset.scene = 'table';
  tableScene(stage, app);
  hud.open(1.4);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!hud.picker.hidden) hud.picker.querySelector('.picker-cancel').click();
    else if (!hud.zoom.hidden) hud.zoom.click();
    else if (!hud.back.hidden) app.go('table');
  });
}

boot();
