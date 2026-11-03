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
  ctaEl: $('#cta'),
  picker: $('#picker'),
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

  /**
   * The one big "next step" button inside the screen (to the darkroom, print them,
   * to the wall). It arrives with a pulse so it can't be missed.
   */
  cta(label, run, sub = '') {
    const el = this.ctaEl;
    if (!label) {
      el.hidden = true;
      el.onclick = null;
      el.dataset.label = '';
      return;
    }
    el.querySelector('b').textContent = label;
    el.querySelector('small').textContent = sub;
    el.onclick = run;
    if (el.dataset.label === label && !el.hidden) return;
    el.dataset.label = label;
    el.hidden = false;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    gsap.fromTo(el, { opacity: 0, y: 14, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(2)' });
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

  /**
   * A sheet of thumbnails to choose frames from. Resolves with the chosen
   * indices in order, or null when cancelled.
   */
  choose({ title, sub, done, items, selected, max }) {
    const el = this.picker;
    const pick = [...selected];
    el.querySelector('h2').textContent = title;
    el.querySelector('p').textContent = sub;
    el.querySelector('.picker-done').textContent = done;
    const grid = el.querySelector('.picker-grid');
    const count = el.querySelector('.picker-count');
    grid.innerHTML = '';
    const cells = items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'picker-cell';
      b.innerHTML = `<img alt="" src="${it.src}"><span class="picker-no">${it.no}</span><em></em><i class="picker-msg">${it.title}</i>`;
      b.onclick = () => {
        const at = pick.indexOf(i);
        if (at >= 0) pick.splice(at, 1);
        else if (pick.length < max) pick.push(i);
        else {
          gsap.fromTo(count, { x: -5 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
          return;
        }
        sync();
      };
      grid.appendChild(b);
      return b;
    });
    const sync = () => {
      cells.forEach((b, i) => {
        const at = pick.indexOf(i);
        b.classList.toggle('on', at >= 0);
        b.querySelector('em').textContent = at >= 0 ? at + 1 : '';
      });
      count.textContent = `${pick.length} / ${max}`;
      el.querySelector('.picker-done').disabled = !pick.length;
    };
    sync();
    el.hidden = false;
    gsap.fromTo(el.querySelector('.picker-card'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    return new Promise((resolve) => {
      const close = async (result) => {
        await gsap.to(el, { opacity: 0, duration: 0.3 });
        el.hidden = true;
        resolve(result);
      };
      el.querySelector('.picker-done').onclick = () => close(pick);
      el.querySelector('.picker-cancel').onclick = () => close(null);
      el.onclick = (e) => e.target === el && close(null);
    });
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
