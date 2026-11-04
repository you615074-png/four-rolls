import * as THREE from 'three';
import { damp } from './util.js';
import { walnutTexture } from './deskSet.js';

// a room at night: warm near-black, lamplight from above
const LOOK = { bg: '#0a0503', sky: '#ffdcbc', ground: '#24130a' };

const gsap = window.gsap;

/*
 * Every tween, timeline and delayed call a scene starts is remembered, so that leaving the
 * scene can stop them all: an old scene's callbacks never run on top of the next one.
 * Tweens on DOM elements (the HUD, the iris, the letter) belong to the page and are left alone.
 */
const live = new Set();
for (const k of ['to', 'from', 'fromTo', 'timeline', 'delayedCall']) {
  const make = gsap[k].bind(gsap);
  gsap[k] = (...args) => {
    const anim = make(...args);
    live.add(anim);
    if (live.size > 400) for (const a of live) if (!a.isActive() && a.progress() === 1) live.delete(a);
    return anim;
  };
}
const pageOwned = (anim) => {
  const targets = anim.targets ? anim.targets() : anim.getChildren(true, true, false).flatMap((c) => c.targets());
  return targets.some((t) => t instanceof Element || t?.pageOwned);
};
export function killSceneAnimations() {
  for (const a of live) if (!pageOwned(a)) a.kill();
  live.clear();
}

const coarse = matchMedia('(pointer: coarse)').matches;

/**
 * One renderer, one table. Scenes put their props in `stage.world` and
 * register pickable meshes through `stage.pick(mesh, handlers)`.
 *
 * Handlers: { click(hit, e), press(hit), enter(hit), leave(), over(hit), label, cursor }
 * `label` (string or function) shows as a handwritten tag next to the pointer.
 */
export class Stage {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(LOOK.bg);
    this.scene.fog = new THREE.Fog(LOOK.bg, 12, 26);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
    this.rig = { px: 0, py: 6, pz: 8, tx: 0, ty: 0, tz: 0, fov: 34 };
    this.parallax = new THREE.Vector2();
    this.parallaxTarget = new THREE.Vector2();
    this.parallaxAmount = 0.12;
    // the narrowest aspect a scene is framed for; below it the camera backs off to keep the width
    this.frameAspect = 1.45;
    // what a scene needs kept in frame: points (or a function returning them); the camera
    // backs off along its own line of sight until they all fit, easing rather than jumping
    this.keep = null;
    this.kFit = null;
    this.ndcTmp = new THREE.Vector3();

    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: '#a8968a', map: walnutTexture(), roughness: 0.5, dithering: true }),
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    this.table = table;
    this.scene.add(table);

    this.hemi = new THREE.HemisphereLight(LOOK.sky, LOOK.ground, 0.4);
    this.scene.add(this.hemi);
    this.key = new THREE.SpotLight('#ffe2bf', 120, 30, 0.62, 0.75, 1.4);
    this.key.position.set(1, 9, 4);
    this.key.castShadow = true;
    const map = coarse ? 2048 : 4096;
    this.key.shadow.mapSize.set(map, map);
    this.key.shadow.camera.near = 2;
    this.key.shadow.camera.far = 24;
    this.key.shadow.bias = -0.0002;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key, this.key.target);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(-9, -9);
    this.pointer = { x: 0, y: 0, inside: false };
    this.pickables = [];
    this.hovered = null;
    this.frameHooks = new Set();
    this.anchors = new Set();
    this.dragHandler = null;
    this.wheelHandler = null;
    this.dragging = false;
    this.clock = new THREE.Clock();
    this.tag = document.querySelector('#tag');
    this.overlay = document.querySelector('#anchors');

    this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ---------- scene content ---------- */

  clear() {
    killSceneAnimations();
    this.pickables = [];
    this.hovered = null;
    this.frameHooks.clear();
    for (const a of this.anchors) a.el.remove();
    this.anchors.clear();
    this.dragHandler = null;
    this.wheelHandler = null;
    this.onEmptyClick = null;
    this.host.style.cursor = '';
    this.tag.classList.remove('on');
    gsap.killTweensOf(this.rig);
    this.world.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.world.clear();
    // every scene starts from the room's own light; scenes that change it don't have to undo it
    this.scene.background.set(LOOK.bg);
    this.scene.fog.color.set(LOOK.bg);
    this.scene.environment = null;
    this.hemi.color.set(LOOK.sky);
    this.hemi.groundColor.set(LOOK.ground);
    this.table.visible = true;
    this.frameAspect = 1.45;
    this.keep = null;
    this.kFit = null;
  }

  pick(obj, handlers) {
    obj.userData.pick = handlers;
    this.pickables.push(obj);
    return obj;
  }

  unpick(obj) {
    this.pickables = this.pickables.filter((o) => o !== obj);
    if (this.hovered === obj) this.hovered = null;
  }

  onFrame(fn) {
    this.frameHooks.add(fn);
    return () => this.frameHooks.delete(fn);
  }

  /**
   * A handwritten note pinned to a point in the scene (a Vector3 or an Object3D),
   * showing first-time visitors where to act. Returns { el, hide() }.
   */
  anchor(target, html, { dx = 0, dy = 0, side = 'up' } = {}) {
    const el = document.createElement('div');
    el.className = `anchor anchor-${side}`;
    el.innerHTML = `<span>${html}</span>`;
    this.overlay.appendChild(el);
    const a = {
      el, target, dx, dy,
      hide: () => {
        if (!this.anchors.has(a)) return;
        el.classList.add('gone');
        this.anchors.delete(a);
        setTimeout(() => el.remove(), 500);
      },
    };
    this.anchors.add(a);
    this.placeAnchor(a);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    return a;
  }

  placeAnchor(a) {
    const v = a.target.isObject3D ? a.target.getWorldPosition(new THREE.Vector3()) : a.target;
    const s = this.toScreen(v);
    const r0 = this.overlay.getBoundingClientRect();
    a.el.style.left = `${s.x - r0.left + a.dx}px`;
    a.el.style.top = `${s.y - r0.top + a.dy}px`;
  }

  /** Light the table for a scene: spot position and where it points. */
  light({ pos = [1, 9, 4], target = [0, 0, 0], intensity = 120, angle = 0.62, hemi = 0.4 } = {}) {
    this.key.position.set(...pos);
    this.key.target.position.set(...target);
    this.key.intensity = intensity;
    this.key.angle = angle;
    this.hemi.intensity = hemi;
  }

  view({ pos, target, fov = this.rig.fov }, duration = 0) {
    const to = { px: pos[0], py: pos[1], pz: pos[2], tx: target[0], ty: target[1], tz: target[2], fov };
    gsap.killTweensOf(this.rig);
    if (!duration) Object.assign(this.rig, to);
    else return gsap.to(this.rig, { ...to, duration, ease: 'power3.inOut' });
  }

  /* ---------- pointer ---------- */

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    const setNdc = (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.parallaxTarget.copy(this.ndc);
    };
    el.addEventListener('pointermove', (e) => {
      setNdc(e);
      this.pointer.inside = true;
      if (down && this.dragHandler) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.dragging && Math.hypot(dx, dy) > 6) {
          down.dragging = this.dragging = true;
          this.dragHandler.begin?.(e);
        }
        if (down.dragging) {
          this.dragHandler.move?.(e.clientX - down.lx, e.clientY - down.ly, e);
          down.lx = e.clientX;
          down.ly = e.clientY;
        }
      }
    });
    el.addEventListener('pointerdown', (e) => {
      setNdc(e);
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, dragging: false };
      el.setPointerCapture(e.pointerId);
      this.dragHandler?.start?.(e);
      const hit = this.hit();
      hit?.object.userData.pick.press?.(hit);
    });
    const up = (e) => {
      setNdc(e);
      const wasDrag = down?.dragging;
      down = null;
      this.dragging = false;
      if (wasDrag) {
        this.dragHandler?.end?.(e);
        return;
      }
      if (e.type === 'pointercancel') return;
      const hit = this.hit();
      if (hit) hit.object.userData.pick.click?.(hit, e);
      else this.onEmptyClick?.(e);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
      this.ndc.set(-9, -9);
      this.parallaxTarget.set(0, 0);
    });
    el.addEventListener('wheel', (e) => {
      if (!this.wheelHandler) return;
      e.preventDefault();
      this.wheelHandler(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    }, { passive: false });
  }

  hit() {
    if (!this.pickables.length) return null;
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.pickables, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o && o.visible !== false) return { ...h, object: o };
    }
    return null;
  }

  /** Raycast onto a horizontal plane at height y. */
  pointOnPlane(y) {
    this.ray.setFromCamera(this.ndc, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }

  /** Client-space position of a world point. */
  toScreen(v) {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  updateTag(obj, hit) {
    let label = obj?.userData.pick?.label;
    if (typeof label === 'function') label = label(hit);
    if (!label && !obj && this.dragHandler?.label && this.pointer.inside && !this.dragging) label = this.dragHandler.label;
    if (label && !coarse && this.pointer.inside) {
      if (this.tag.textContent !== label) this.tag.textContent = label;
      this.tag.style.transform = `translate(${this.pointer.x + 18}px, ${this.pointer.y + 16}px)`;
      this.tag.classList.add('on');
    } else this.tag.classList.remove('on');
  }

  place(k, px, py) {
    const r = this.rig;
    this.camera.position.set(r.tx + (r.px - r.tx) * k + px, r.ty + (r.py - r.ty) * k + py * 0.5, r.tz + (r.pz - r.tz) * k);
    this.camera.lookAt(r.tx + px * 0.4, r.ty + py * 0.2, r.tz);
    this.camera.updateMatrixWorld();
  }

  /** The smallest distance factor ≥ k0 that keeps every kept point inside the safe frame. */
  fitFor(k0, px, py) {
    const pts = typeof this.keep === 'function' ? this.keep() : this.keep;
    if (!pts?.length) return k0;
    const mx = 0.9, my = 0.8; // leave room for the title, the hint and the corner tags
    const fits = (k) => {
      this.place(k, px, py);
      this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
      for (const p of pts) {
        const v = this.ndcTmp.copy(p).project(this.camera);
        if (v.z > 1 || Math.abs(v.x) > mx || Math.abs(v.y) > my) return false;
      }
      return true;
    };
    if (fits(k0)) return k0;
    let lo = k0, hi = k0 * 1.25;
    for (let i = 0; i < 6 && !fits(hi); i++) {
      lo = hi;
      hi *= 1.25;
    }
    for (let i = 0; i < 7; i++) {
      const m = (lo + hi) / 2;
      if (fits(m)) hi = m;
      else lo = m;
    }
    return hi;
  }

  /** The eight corners of an object's bounding box, for `keep`. */
  corners(obj, pad = 0) {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj).expandByScalar(pad);
    const out = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
    return out;
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const hit = this.dragging ? null : this.hit();
    const obj = hit?.object ?? null;
    if (obj !== this.hovered) {
      this.hovered?.userData.pick?.leave?.();
      this.hovered = obj;
      obj?.userData.pick?.enter?.(hit);
    }
    const cur = obj?.userData.pick.cursor;
    this.host.style.cursor = this.dragging ? 'grabbing' : obj ? ((typeof cur === 'function' ? cur() : cur) ?? 'pointer') : this.dragHandler ? 'grab' : '';
    if (obj) obj.userData.pick.over?.(hit);
    this.updateTag(obj, hit);
    for (const fn of this.frameHooks) fn(dt, t, hit);

    // the camera eases after the pointer instead of snapping to it
    this.parallax.x = damp(this.parallax.x, this.parallaxTarget.x, 3, dt);
    this.parallax.y = damp(this.parallax.y, this.parallaxTarget.y, 3, dt);
    const r = this.rig;
    const px = this.parallax.x * this.parallaxAmount, py = this.parallax.y * this.parallaxAmount;
    // scenes are framed for a ~3:2 screen; on narrower screens back the camera off to keep the width
    if (this.camera.fov !== r.fov) {
      this.camera.fov = r.fov;
      this.camera.updateProjectionMatrix();
    }
    let k = Math.max(1, this.frameAspect / this.camera.aspect) ** 0.85;
    if (this.keep) {
      const need = this.fitFor(k, px, py);
      this.kFit = this.kFit == null ? need : damp(this.kFit, need, 3, dt);
      k = Math.max(k, this.kFit);
    }
    this.scene.fog.near = 12 * k;
    this.scene.fog.far = 26 * k;
    this.place(k, px, py);
    for (const a of this.anchors) this.placeAnchor(a);
    this.renderer.render(this.scene, this.camera);
  }
}
