import * as THREE from 'three';
import { velvetTexture } from './util.js';

const gsap = window.gsap;

/**
 * One renderer, one table. Scenes put their props in `stage.world` and
 * register pickable meshes through `stage.pick(mesh, handlers)`.
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
    this.scene.background = new THREE.Color('#0a0302');
    this.scene.fog = new THREE.Fog('#0a0302', 12, 26);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
    this.rig = { px: 0, py: 6, pz: 8, tx: 0, ty: 0, tz: 0, fov: 34 };
    this.parallax = new THREE.Vector2();
    this.parallaxAmount = 0.12;

    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: '#8f8f8f', map: velvetTexture(), roughness: 0.96 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    this.table = table;
    this.scene.add(table);

    this.hemi = new THREE.HemisphereLight('#ffd9c0', '#2a0805', 0.4);
    this.scene.add(this.hemi);
    this.key = new THREE.SpotLight('#ffe2bf', 120, 30, 0.62, 0.75, 1.4);
    this.key.position.set(1, 9, 4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.radius = 6;
    this.scene.add(this.key, this.key.target);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(-9, -9);
    this.pickables = [];
    this.hovered = null;
    this.frameHooks = new Set();
    this.dragHandler = null;
    this.clock = new THREE.Clock();

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
    this.pickables = [];
    this.hovered = null;
    this.frameHooks.clear();
    this.dragHandler = null;
    this.onEmptyClick = null;
    this.host.style.cursor = '';
    gsap.killTweensOf(this.rig);
    this.world.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.world.clear();
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

  /** Light the table for a scene: spot position and where it points. */
  light({ pos = [1, 9, 4], target = [0, 0, 0], intensity = 120, angle = 0.62, hemi = 0.55 } = {}) {
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
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.parallax.set(this.ndc.x, this.ndc.y);
    };
    el.addEventListener('pointermove', (e) => {
      setNdc(e);
      if (down && this.dragHandler) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.dragging && Math.hypot(dx, dy) > 6) down.dragging = true;
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
    });
    el.addEventListener('pointerup', (e) => {
      setNdc(e);
      const wasDrag = down?.dragging;
      down = null;
      if (wasDrag) {
        this.dragHandler?.end?.(e);
        return;
      }
      const hit = this.hit();
      if (hit) hit.object.userData.pick.click?.(hit);
      else this.onEmptyClick?.();
    });
    el.addEventListener('pointerleave', () => this.ndc.set(-9, -9));
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

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const hit = this.hit();
    const obj = hit?.object ?? null;
    if (obj !== this.hovered) {
      this.hovered?.userData.pick?.leave?.();
      this.hovered = obj;
      obj?.userData.pick?.enter?.(hit);
      this.host.style.cursor = obj ? (obj.userData.pick.cursor ?? 'pointer') : this.dragHandler ? 'grab' : '';
    }
    if (obj) obj.userData.pick.over?.(hit);
    for (const fn of this.frameHooks) fn(dt, t, hit);

    const r = this.rig;
    const p = this.parallax.clone().multiplyScalar(this.parallaxAmount);
    // scenes are framed for a ~3:2 screen; on narrower screens back the camera off to keep the width
    const k = Math.max(1, 1.45 / this.camera.aspect) ** 0.85;
    this.scene.fog.near = 12 * k;
    this.scene.fog.far = 26 * k;
    this.camera.position.set(r.tx + (r.px - r.tx) * k + p.x, r.ty + (r.py - r.ty) * k + p.y * 0.5, r.tz + (r.pz - r.tz) * k);
    this.camera.lookAt(r.tx + p.x * 0.4, r.ty + p.y * 0.2, r.tz);
    if (this.camera.fov !== r.fov) {
      this.camera.fov = r.fov;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
