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

  /* Scene changes close an iris on the point that was tapped, then open it from the middle. */
  iris: { r: -12 },
  drawIris() {
    this.fade.style.setProperty('--ir', `${this.iris.r}vmax`);
  },
  irisAt(x, y) {
    const r = this.fade.getBoundingClientRect();
    this.fade.style.setProperty('--ix', `${x - r.left}px`);
    this.fade.style.setProperty('--iy', `${y - r.top}px`);
  },
  open(duration = 1.1) {
    const r = this.fade.getBoundingClientRect();
    this.irisAt(r.left + r.width / 2, r.top + r.height * 0.48);
    return gsap.to(this.iris, { r: 160, duration, ease: 'power2.inOut', onUpdate: () => this.drawIris() });
  },
  async cut(fn, from) {
    this.fade.style.pointerEvents = 'auto';
    gsap.killTweensOf(this.iris);
    if (from) this.irisAt(from.x, from.y);
    await gsap.to(this.iris, { r: -12, duration: 0.6, ease: 'power3.in', onUpdate: () => this.drawIris() });
    await fn();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    this.fade.style.pointerEvents = '';
    await this.open(0.85);
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
