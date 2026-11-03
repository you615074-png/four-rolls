import { Stage } from './stage.js';
import { hud } from './hud.js';
import { tableScene, rollScene } from './scenes/rolls.js';
import { lightboxScene, trayScene } from './scenes/darkroom.js';
import { wallScene, letterScene } from './scenes/wall.js';
import { FONT } from './util.js';

const SCENES = {
  table: tableScene,
  roll: rollScene,
  lightbox: lightboxScene,
  tray: trayScene,
  wall: wallScene,
  letter: letterScene,
};

const freshState = () => ({ visited: new Set(), circled: new Set(), hearts: new Set() });

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

  const app = {
    stage,
    state: freshState(),
    current: null,
    async go(name, params = {}) {
      if (busy) return;
      busy = true;
      await hud.cut(() => {
        cleanup?.();
        cleanup = null;
        hud.sideNote(null);
        hud.zoom.hidden = true;
        stage.clear();
        if (params.reset) app.state = freshState();
        app.current = name;
        document.body.dataset.scene = name;
        const r = SCENES[name](stage, app, params);
        if (typeof r === 'function') cleanup = r;
      });
      busy = false;
    },
  };

  hud.back.addEventListener('click', () => app.go('table'));
  window.darkroom = app; // handy from the console while building

  document.body.dataset.scene = 'table';
  tableScene(stage, app);
  window.gsap.to('#fade', { opacity: 0, duration: 1.2, ease: 'power2.out' });
}

boot();
