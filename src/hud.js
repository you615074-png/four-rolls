const $ = (s) => document.querySelector(s);
const gsap = window.gsap;

/** The paper-thin DOM layer over the canvas: labels, hints, overlays, fades. */
export const hud = {
  scene: $('#hud-scene'),
  count: $('#hud-count'),
  title: $('#hud-title'),
  caption: $('#hud-caption'),
  back: $('#hud-back'),
  hint: $('#hint'),
  hintText: $('#hint-text'),
  hintAction: $('#hint-action'),
  side: $('#side-note'),
  fade: $('#fade'),
  zoom: $('#zoom'),
  zoomImg: $('#zoom img'),

  set({ scene, count, title = false, caption = null, back = false } = {}) {
    if (scene !== undefined) this.scene.textContent = scene;
    if (count !== undefined) this.count.textContent = count;
    this.title.hidden = !title;
    this.setCaption(caption);
    this.back.hidden = !back;
  },

  setCount(text) {
    this.count.textContent = text;
  },

  setCaption(c) {
    if (!c) {
      this.caption.hidden = true;
      return;
    }
    this.caption.hidden = false;
    this.caption.querySelector('small').textContent = c.small;
    this.caption.querySelector('em').textContent = c.title;
    gsap.fromTo(this.caption, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
  },

  /** Handwritten hint under the screen, with an optional action on the right. */
  say(text, action = null) {
    const swap = () => {
      this.hintText.textContent = text ?? '';
      if (action) {
        this.hintAction.hidden = false;
        this.hintAction.querySelector('span').textContent = action.label;
        this.hintAction.onclick = action.run;
      } else {
        this.hintAction.hidden = true;
        this.hintAction.onclick = null;
      }
      gsap.to(this.hint, { opacity: 1, duration: 0.45 });
    };
    if (this.hintText.textContent === (text ?? '') && !!action === !this.hintAction.hidden) {
      if (action) this.hintAction.onclick = action.run;
      return;
    }
    gsap.to(this.hint, { opacity: 0, duration: 0.2, onComplete: swap });
  },

  /** A handwritten note drawn inside the screen (e.g. "all dry, to the wall →"). */
  sideNote(lines, run) {
    if (!lines) {
      this.side.hidden = true;
      return;
    }
    this.side.hidden = false;
    this.side.innerHTML = lines;
    this.side.onclick = run;
    gsap.fromTo(this.side, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' });
  },

  async cut(fn, { out = 0.38, inn = 0.6 } = {}) {
    this.fade.style.pointerEvents = 'auto';
    await gsap.to(this.fade, { opacity: 1, duration: out, ease: 'power2.in' });
    await fn();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await gsap.to(this.fade, { opacity: 0, duration: inn, ease: 'power2.out' });
    this.fade.style.pointerEvents = '';
  },

  /** Full-bleed photo, zooming out of a point on screen (the loupe). */
  openZoom(src, from, onClose) {
    this.zoomImg.src = src;
    this.zoom.hidden = false;
    const r = this.zoom.getBoundingClientRect();
    const ox = ((from.x - r.left) / r.width) * 100, oy = ((from.y - r.top) / r.height) * 100;
    this.zoom.style.transformOrigin = `${ox}% ${oy}%`;
    gsap.fromTo(this.zoom, { scale: 0.08, opacity: 0, borderRadius: '50%' }, { scale: 1, opacity: 1, borderRadius: '0%', duration: 0.9, ease: 'power3.inOut' });
    gsap.fromTo(this.zoomImg, { scale: 1.25 }, { scale: 1.04, duration: 6, ease: 'none' });
    this.zoom.onclick = async () => {
      this.zoom.onclick = null;
      await gsap.to(this.zoom, { scale: 0.08, opacity: 0, borderRadius: '50%', duration: 0.7, ease: 'power3.inOut' });
      this.zoom.hidden = true;
      onClose?.();
    };
  },
};
