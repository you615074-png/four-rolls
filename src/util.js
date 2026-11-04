import * as THREE from 'three';

export const FONT = {
  mono: '"IBM Plex Mono", "SF Mono", Menlo, monospace',
  serif: '"Instrument Serif", "Songti SC", "STSong", Georgia, serif',
  hand: '"Caveat", "LXGW WenKai TC", "Kaiti SC", cursive',
  type: '"Special Elite", "LXGW WenKai TC", "Courier New", monospace',
  kai: '"LXGW WenKai TC", "Kaiti SC", "STKaiti", serif',
};

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function canvasTexture(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export const damp = (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt);
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let grainTile;
/** A small mid-grey noise tile; laid over a canvas with 'overlay' it adds fine, even grain. */
function grainPattern(g) {
  if (!grainTile) {
    const [c, gg] = canvas(256, 256);
    const img = gg.createImageData(256, 256);
    const r = rng(1234);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 70;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gg.putImageData(img, 0, 0);
    grainTile = c;
  }
  return g.createPattern(grainTile, 'repeat');
}

export function addGrain(g, w, h, strength = 0.3) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = strength;
  g.fillStyle = grainPattern(g);
  g.fillRect(0, 0, w, h);
  g.restore();
}

/** Soft low-frequency blotches: a tiny random canvas scaled up with smoothing. */
export function softNoise(g, w, h, seed, cells, alpha, colors) {
  const [c, gg] = canvas(cells, cells);
  const r = rng(seed);
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < cells; x++) {
      gg.fillStyle = colors[Math.floor(r() * colors.length)];
      gg.globalAlpha = r();
      gg.fillRect(x, y, 1, 1);
    }
  g.save();
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, w, h);
  g.restore();
}

/* ---------- placeholder photos ---------- */

const PALETTES = [
  ['#f2c79a', '#d9785a', '#5b3b4f', '#20182a'],
  ['#c9dbe6', '#8fb0c4', '#3d5566', '#141c24'],
  ['#f5e1a8', '#d8a95b', '#7a5a2f', '#2c2012'],
  ['#e6c2c9', '#b07a91', '#4c3550', '#191320'],
  ['#d7e3c5', '#9db584', '#4d6643', '#1b2617'],
  ['#fbd9b0', '#f08a4b', '#7d3a2a', '#21110d'],
  ['#dfe6ee', '#a9b8c9', '#5e6b80', '#22262e'],
];

const photoCache = new Map();

/** A deterministic, photo-like placeholder (3:4 portrait). */
export function placeholderPhoto(rollIndex, frameIndex, title = '', scale = 1.5) {
  const key = `${rollIndex}:${frameIndex}:${scale}`;
  if (photoCache.has(key)) return photoCache.get(key);
  // drawn in a 384×512 design space, rendered at `scale`
  const W = 384, H = 512;
  const [c, g] = canvas(Math.round(W * scale), Math.round(H * scale));
  g.scale(scale, scale);
  const r = rng(rollIndex * 997 + frameIndex * 131 + 7);
  const pal = PALETTES[Math.floor(r() * PALETTES.length)];
  const kind = (frameIndex + rollIndex * 2) % 5;
  const horizon = H * (0.48 + r() * 0.2);

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, pal[1]);
  sky.addColorStop(1, pal[0]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // sun / moon
  g.fillStyle = 'rgba(255,245,225,0.85)';
  g.beginPath();
  g.arc(W * (0.2 + r() * 0.6), horizon * (0.3 + r() * 0.4), 18 + r() * 34, 0, Math.PI * 2);
  g.fill();

  if (kind === 0) {
    // mountains
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = layer === 0 ? pal[1] : layer === 1 ? pal[2] : pal[3];
      g.globalAlpha = 0.55 + layer * 0.2;
      g.beginPath();
      g.moveTo(0, H);
      let y = horizon - 40 + layer * 30;
      for (let x = 0; x <= W; x += 24) {
        y += (r() - 0.5) * 60;
        g.lineTo(x, Math.min(horizon + layer * 40, y));
      }
      g.lineTo(W, H);
      g.fill();
    }
    g.globalAlpha = 1;
  } else if (kind === 1) {
    // city blocks with windows
    g.fillStyle = pal[3];
    g.fillRect(0, horizon, W, H - horizon);
    for (let x = -10; x < W; x += 30 + r() * 40) {
      const bw = 26 + r() * 46, bh = 80 + r() * 230;
      g.fillStyle = r() > 0.5 ? pal[2] : pal[3];
      g.fillRect(x, horizon + 30 - bh, bw, bh + H);
      g.fillStyle = 'rgba(255,220,150,0.75)';
      for (let wy = horizon + 40 - bh; wy < H; wy += 14)
        for (let wx = x + 4; wx < x + bw - 6; wx += 10) if (r() > 0.62) g.fillRect(wx, wy, 4, 6);
    }
  } else if (kind === 2) {
    // portrait silhouette against a window
    g.fillStyle = pal[2];
    g.fillRect(0, horizon, W, H);
    g.fillStyle = pal[3];
    g.fillRect(0, 0, 34, H);
    g.fillRect(W - 34, 0, 34, H);
    const cx = W * (0.4 + r() * 0.2);
    g.beginPath();
    g.ellipse(cx, H * 0.48, 46, 58, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(cx - 120, H);
    g.quadraticCurveTo(cx - 100, H * 0.58, cx, H * 0.57);
    g.quadraticCurveTo(cx + 100, H * 0.58, cx + 120, H);
    g.fill();
  } else if (kind === 3) {
    // sea and shoreline
    const sea = g.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, pal[2]);
    sea.addColorStop(1, pal[3]);
    g.fillStyle = sea;
    g.fillRect(0, horizon, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let y = horizon + 10; y < H; y += 9 + r() * 12) {
      g.beginPath();
      g.moveTo(r() * W * 0.3, y);
      g.lineTo(W * (0.6 + r() * 0.4), y + (r() - 0.5) * 3);
      g.stroke();
    }
  } else {
    // field with a tree and a road
    g.fillStyle = pal[0];
    g.fillRect(0, horizon, W, H);
    const field = g.createLinearGradient(0, horizon, 0, H);
    field.addColorStop(0, pal[1]);
    field.addColorStop(1, pal[2]);
    g.fillStyle = field;
    g.fillRect(0, horizon, W, H);
    g.fillStyle = pal[3];
    const tx = W * (0.2 + r() * 0.6);
    g.fillRect(tx - 4, horizon - 70, 8, 80);
    g.beginPath();
    g.arc(tx, horizon - 80, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.moveTo(W * 0.45, horizon);
    g.lineTo(W * 0.1, H);
    g.lineTo(W * 0.9, H);
    g.lineTo(W * 0.55, horizon);
    g.fill();
  }

  // film-ish softness + light leak
  const leak = g.createRadialGradient(W * r(), 0, 10, W * 0.5, 0, H * 0.9);
  leak.addColorStop(0, 'rgba(255,140,60,0.28)');
  leak.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = leak;
  g.fillRect(0, 0, W, H);
  addGrain(g, c.width, c.height, 0.22);

  g.font = `500 13px ${FONT.mono}`;
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillText(`PLACEHOLDER · R${rollIndex + 1}-${String(frameIndex + 1).padStart(2, '0')}`, 14, H - 16);
  if (title) {
    g.font = `italic 20px ${FONT.serif}`;
    g.fillText(title, 14, H - 36);
  }
  photoCache.set(key, c);
  return c;
}

const cropped = new Map();

/** Landscape frames: 4:3, lying sideways on the film, upright once printed or held up. */
export const isWide = (frame) => !!frame?.photo && !!frame.wide;

/**
 * Real photos are cover-cropped once, on a canvas: 3:4 portrait, or 4:3 when `wide`.
 * Until the image arrives the canvas shows the frame's placeholder.
 */
function croppedPhoto(rollIndex, frameIndex, frame) {
  if (cropped.has(frame.photo)) return cropped.get(frame.photo);
  const [W, H] = frame.wide ? [1200, 900] : [900, 1200];
  const [c, g] = canvas(W, H);
  const cover = (src, sw, sh) => {
    const k = Math.max(W / sw, H / sh);
    g.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
  };
  const ph = placeholderPhoto(rollIndex, frameIndex, frame.title);
  cover(ph, ph.width, ph.height);
  const img = new Image();
  img.src = frame.photo;
  c.ready = img
    .decode()
    .then(() => {
      g.imageSmoothingQuality = 'high';
      cover(img, img.naturalWidth, img.naturalHeight);
      if (img.naturalWidth > img.naturalHeight !== !!frame.wide) console.warn(`${frame.photo}: set wide: ${!frame.wide} for this photo`);
      return true;
    })
    .catch(() => false);
  cropped.set(frame.photo, c);
  return c;
}

/** Photo source for a frame: the cropped real image if configured, otherwise a placeholder. */
export function photoSource(rollIndex, frameIndex, frame) {
  if (!frame?.photo) return placeholderPhoto(rollIndex, frameIndex, frame?.title);
  return croppedPhoto(rollIndex, frameIndex, frame);
}

const texCache = new Map();
export function photoTexture(rollIndex, frameIndex, frame) {
  // frames that share a photo share one texture
  const key = `${rollIndex}:${frame?.photo || frameIndex}`;
  if (texCache.has(key)) return texCache.get(key);
  const src = photoSource(rollIndex, frameIndex, frame);
  const t = new THREE.CanvasTexture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  src.ready?.then((ok) => ok && (t.needsUpdate = true));
  texCache.set(key, t);
  return t;
}

/** Free a roll's GPU textures once its scene is gone. */
export function releaseRoll(rollIndex) {
  for (const [key, t] of texCache) {
    if (key.startsWith(`${rollIndex}:`)) {
      t.dispose();
      texCache.delete(key);
    }
  }
}

export function photoURL(rollIndex, frameIndex, frame) {
  if (frame?.photo) return frame.photo;
  // full-screen view gets its own sharp render
  return placeholderPhoto(rollIndex, frameIndex, frame?.title, 3.4).toDataURL('image/jpeg', 0.92);
}

const thumbCache = new Map();
/** A small JPEG of a frame for DOM thumbnails. */
export function photoThumb(rollIndex, frameIndex, frame) {
  if (frame?.photo) return frame.photo;
  const key = `${rollIndex}:${frameIndex}`;
  if (!thumbCache.has(key)) thumbCache.set(key, placeholderPhoto(rollIndex, frameIndex, frame?.title, 0.75).toDataURL('image/jpeg', 0.88));
  return thumbCache.get(key);
}

/* ---------- the one photo shader: negative, positive, print developing ---------- */

const PHOTO_VERT = /* glsl */ `
varying vec2 vUv;
uniform vec4 uCrop;
uniform float uTurn;    // 1 = a landscape photo lying sideways in a portrait film frame
#include <clipping_planes_pars_vertex>
void main() {
  vec2 c = uCrop.xy + uv * uCrop.zw;
  vUv = mix(c, vec2(c.y, 1.0 - c.x), uTurn);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;

const PHOTO_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uNeg;     // 1 = orange-mask negative, 0 = positive
uniform float uDev;     // print developing: 0 = blank paper, 1 = full image
uniform float uMono;    // 1 = warm-toned black & white
uniform float uBright;
uniform float uTime;
uniform vec3 uPaper;
uniform float uFlash;   // white flash for the slide viewer
uniform float uBlur;    // lens defocus radius, in uv units
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  vec3 c = texture2D(uMap, vUv).rgb;
  if (uBlur > 0.0004) {
    // golden-angle disc: a smooth defocus, no blocky mip steps
    vec3 acc = c;
    for (int i = 0; i < 32; i++) {
      float fi = float(i) + 0.5;
      float a = fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a) * 0.78) * sqrt(fi / 32.0) * uBlur;
      acc += texture2D(uMap, vUv + o).rgb;
    }
    c = acc / 33.0;
  }
  vec3 g = pow(max(c, 0.0), vec3(1.0 / 2.2));
  float l = dot(g, vec3(0.299, 0.587, 0.114));

  vec3 toned = vec3(l) * vec3(1.04, 0.97, 0.86);
  toned = smoothstep(0.04, 0.98, toned);
  vec3 img = mix(g, toned, uMono);

  vec3 neg = (1.0 - g) * vec3(0.98, 0.58, 0.33) * 0.82 + vec3(0.16, 0.05, 0.0);
  img = mix(img, neg, uNeg);

  float n = noise(vUv * 7.0 + uTime * 0.07) * 0.45 + noise(vUv * 31.0) * 0.12;
  float k = clamp((uDev * 1.7 - n) * (0.9 + (1.0 - l) * 0.9), 0.0, 1.0);
  // a crop wider than the photo leaves a white paper border, not stretched edge pixels
  if (any(lessThan(vUv, vec2(0.0))) || any(greaterThan(vUv, vec2(1.0)))) k = 0.0;
  vec3 col = mix(pow(uPaper, vec3(1.0 / 2.2)), img, k);
  col = mix(col, vec3(1.0, 0.97, 0.9), uFlash);

  gl_FragColor = vec4(pow(col, vec3(2.2)) * uBright, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function photoMaterial(map, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uNeg: { value: opts.neg ?? 0 },
      uDev: { value: opts.dev ?? 1 },
      uMono: { value: opts.mono ?? 0 },
      uBright: { value: opts.bright ?? 1 },
      uTime: { value: 0 },
      uPaper: { value: new THREE.Color(opts.paper ?? '#f3eee2') },
      uFlash: { value: 0 },
      uBlur: { value: opts.blur ?? 0 },
      uCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
      uTurn: { value: opts.turn ?? 0 },
    },
    vertexShader: PHOTO_VERT,
    fragmentShader: PHOTO_FRAG,
    side: opts.side ?? THREE.FrontSide,
    toneMapped: false,
    clipping: true, // honours clippingPlanes (a strip's film is cut away inside its can)
  });
}

/* ---------- static textures ---------- */

export function velvetTexture() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#741a12';
  g.fillRect(0, 0, S, S);
  softNoise(g, S, S, 42, 24, 0.22, ['#3a0806', '#9a2a1c']);
  softNoise(g, S, S, 7, 96, 0.1, ['#2a0504', '#a8341f']);
  // pile: short soft strokes that catch the light
  const r = rng(5);
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = r() > 0.5 ? 'rgba(20,0,0,0.05)' : 'rgba(210,90,70,0.05)';
    g.lineWidth = 1 + r() * 1.5;
    const x = r() * S, y = r() * S, a = r() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    g.stroke();
  }
  addGrain(g, S, S, 0.12);
  return canvasTexture(c, { repeat: [7, 7] });
}

export function corkTexture() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#86562f';
  g.fillRect(0, 0, S, S);
  softNoise(g, S, S, 11, 32, 0.25, ['#4a2a12', '#b07a48']);
  const r = rng(9);
  for (let i = 0; i < 26000; i++) {
    const v = r();
    g.fillStyle = v > 0.6 ? 'rgba(60,32,14,0.45)' : v > 0.3 ? 'rgba(176,122,74,0.4)' : 'rgba(40,20,8,0.3)';
    g.beginPath();
    g.arc(r() * S, r() * S, 0.8 + r() * 2.6, 0, Math.PI * 2);
    g.fill();
  }
  return canvasTexture(c, { repeat: [3, 2] });
}

export function glowTexture() {
  const [c, g] = canvas(256, 256);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,246,228,1)');
  grad.addColorStop(0.35, 'rgba(255,226,190,0.45)');
  grad.addColorStop(1, 'rgba(255,200,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return canvasTexture(c);
}

/** Handwritten / typed text on a paper card. */
export function cardTexture({ w = 512, h = 320, bg = '#efe6d2', lines = [], border = false, scale = 2 }) {
  const [c, g] = canvas(w * scale, h * scale);
  g.scale(scale, scale);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  addGrain(g, c.width, c.height, 0.08);
  if (border) {
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 2;
    g.strokeRect(6, 6, w - 12, h - 12);
  }
  for (const l of lines) {
    g.save();
    g.fillStyle = l.color ?? '#3a2a20';
    g.font = l.font;
    g.textAlign = l.align ?? 'left';
    g.translate(l.x, l.y);
    if (l.rot) g.rotate(l.rot);
    if (l.wrap) wrapText(g, l.text, 0, 0, l.wrap, l.lh ?? 40);
    else g.fillText(l.text, 0, 0);
    g.restore();
  }
  return canvasTexture(c);
}

export function wrapText(g, text, x, y, maxW, lh) {
  let line = '';
  let yy = y;
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, yy);
}

/** A wobbly, hand-drawn closed loop. progress 0..1 draws part of it. */
export function handLoop(g, cx, cy, rx, ry, progress, seed, { width = 5, color = '#d0261c' } = {}) {
  const r = rng(seed);
  const wob = Array.from({ length: 6 }, () => (r() - 0.5) * 0.12);
  const start = r() * Math.PI * 2;
  const turns = 1.12;
  const steps = 90;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  const n = Math.floor(steps * progress);
  for (let i = 0; i <= n; i++) {
    const t = i / steps;
    const a = start + t * Math.PI * 2 * turns;
    const k = 1 + wob[0] * Math.sin(a * 2 + wob[1] * 9) + wob[2] * Math.sin(a * 3) + t * 0.06;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.restore();
}

export function handHeart(g, cx, cy, s, progress, { width = 4, color = '#d0261c' } = {}) {
  const steps = 70;
  const n = Math.floor(steps * progress);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const px = cx + (x / 17) * s, py = cy + (y / 17) * s;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  g.restore();
}

export function easeTo(obj, props, duration = 0.8, ease = 'power3.inOut') {
  return window.gsap.to(obj, { ...props, duration, ease });
}
