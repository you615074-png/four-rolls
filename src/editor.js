// The owner's desk: set the photos, the words on their backs, and the letter.
// Everything is saved as you go; the shop reads it the next time someone walks in.

import { ROLLS, LETTER } from './content.js';
import { applySaved, clearAll, frameKey, get, preparePhoto, put } from './store.js';

const $ = (s) => document.querySelector(s);
const status = $('#status');

// which words each roll actually shows, and where
const FIELDS = {
  develop: { help: '拉出胶卷时逐帧显影；点开已显影的一帧会显示日期和标题。', fields: ['title', 'date'] },
  light: { help: '举到灯前看照片，翻过来是背面的手写纸条。', fields: ['title', 'date', 'note'] },
  viewer: { help: '看片器里随机抽到、对上焦之后，会显示地点、两地距离和一句话。', fields: ['title', 'date', 'place', 'km', 'line'] },
  contact: { help: '客人从这一卷挑要冲洗的相片；冲出来的相纸背面写着「背面的话」。', fields: ['title', 'date', 'note'] },
};
const LABELS = {
  title: ['标题', 'text', 40],
  date: ['日期', 'text', 12, '如 06.21'],
  note: ['背面的话', 'textarea', 160],
  place: ['地点', 'text', 40],
  km: ['相距（公里）', 'number'],
  line: ['一句话', 'text', 80],
};

let saving = 0;
const say = (text) => (status.textContent = text);
const saved = () => say(saving ? '保存中…' : `已保存 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`);

/* ---------- state ---------- */

await applySaved();
const thumbs = new Map(); // key → object URL of the saved blob
const blobs = new Map(); // key → saved Blob (kept so rotating doesn't lose quality twice)
for (let r = 0; r < ROLLS.length; r++) {
  for (let i = 0; i < ROLLS[r].frames.length; i++) {
    const rec = await get(frameKey(r, i)).catch(() => null);
    if (rec?.photo instanceof Blob) blobs.set(frameKey(r, i), rec.photo);
  }
}

let tab = location.hash.slice(1) || 'letter';
let roll = 0;
let sel = 0;

/* ---------- saving ---------- */

const timers = new Map();
function saveFrame(r, i, now = false) {
  const key = frameKey(r, i);
  clearTimeout(timers.get(key));
  const run = async () => {
    const f = ROLLS[r].frames[i];
    const rec = { title: f.title, date: f.date, note: f.note, place: f.place, km: f.km, line: f.line };
    if (blobs.has(key)) {
      rec.photo = blobs.get(key);
      rec.wide = f.wide;
    } else if (f.photo === null) rec.photo = null;
    saving++;
    say('保存中…');
    try {
      await put(key, rec);
    } catch (e) {
      say('保存失败：浏览器不允许本地存储');
      throw e;
    } finally {
      saving--;
    }
    saved();
  };
  if (now) return run();
  timers.set(key, setTimeout(run, 400));
}

async function saveLetter() {
  saving++;
  await put('letter', { to: $('#l-to').value, body: $('#l-body').value, sign: $('#l-sign').value }).finally(() => saving--);
  saved();
}

/* ---------- tabs ---------- */

function drawTabs() {
  const items = [['letter', '信', 'LETTER'], ...ROLLS.map((r, i) => [`roll${i}`, r.no, r.name])];
  $('#tabs').innerHTML = items.map(([id, a, b]) =>
    `<button type="button" role="tab" data-tab="${id}" aria-selected="${tab === id}"><b>${a}</b><span>${b}</span></button>`).join('');
  $('#tabs').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) go(b.dataset.tab);
  };
}

function go(id) {
  tab = id;
  history.replaceState(null, '', `#${id}`);
  drawTabs();
  $('#letter-panel').hidden = id !== 'letter';
  $('#roll-panel').hidden = id === 'letter';
  if (id !== 'letter') {
    roll = Number(id.slice(4)) || 0;
    sel = Math.min(sel, ROLLS[roll].frames.length - 1);
    drawRoll();
  }
}

/* ---------- the letter ---------- */

function drawLetterPreview() {
  $('#p-to').textContent = $('#l-to').value;
  $('#p-body').innerHTML = '';
  for (const p of $('#l-body').value.split(/\n\s*\n/)) {
    if (!p.trim()) continue;
    const el = document.createElement('p');
    el.textContent = p.trim();
    $('#p-body').appendChild(el);
  }
  $('#p-sign').textContent = $('#l-sign').value;
}
$('#l-to').value = LETTER.to;
$('#l-body').value = LETTER.paragraphs.join('\n\n');
$('#l-sign').value = LETTER.sign;
let letterTimer;
for (const id of ['#l-to', '#l-body', '#l-sign']) {
  $(id).addEventListener('input', () => {
    drawLetterPreview();
    clearTimeout(letterTimer);
    letterTimer = setTimeout(saveLetter, 400);
  });
}
drawLetterPreview();

/* ---------- a roll ---------- */

const srcOf = (r, i) => {
  const key = frameKey(r, i);
  if (blobs.has(key)) {
    if (!thumbs.has(key)) thumbs.set(key, URL.createObjectURL(blobs.get(key)));
    return thumbs.get(key);
  }
  return ROLLS[r].frames[i].photo;
};

function drawRoll() {
  const R = ROLLS[roll];
  $('#roll-title').innerHTML = `<small>ROLL ${R.no}</small> ${R.name}`;
  $('#roll-help').textContent = FIELDS[R.mode].help;
  $('#grid').innerHTML = R.frames.map((f, i) => {
    const src = srcOf(roll, i);
    return `<li><button type="button" class="ed-slot${i === sel ? ' on' : ''}${src ? '' : ' empty'}" data-i="${i}" aria-label="第 ${i + 1} 格">
      ${src ? `<img src="${src}" alt="" loading="lazy">` : '<i>+</i>'}
      <span>${String(i + 1).padStart(2, '0')}</span>${f.wide && src ? '<em>横</em>' : ''}
    </button></li>`;
  }).join('');
  drawDetail();
}

$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('.ed-slot');
  if (!b) return;
  sel = Number(b.dataset.i);
  for (const s of document.querySelectorAll('.ed-slot')) s.classList.toggle('on', s === b);
  drawDetail();
  if (b.classList.contains('empty')) $('#d-file').click();
});

function drawDetail() {
  const f = ROLLS[roll].frames[sel];
  const src = srcOf(roll, sel);
  $('#d-no').textContent = `第 ${String(sel + 1).padStart(2, '0')} 格`;
  $('#d-shape').textContent = src ? (f.wide ? '横幅 4:3' : '竖幅 3:4') : '';
  $('#d-img').hidden = !src;
  if (src) $('#d-img').src = src;
  $('#d-photo').classList.toggle('wide', !!(src && f.wide));
  $('#d-empty').hidden = !!src;
  $('#d-rotate').disabled = $('#d-remove').disabled = !src;
  $('#d-fields').innerHTML = FIELDS[ROLLS[roll].mode].fields.map((k) => {
    const [label, type, max, ph] = LABELS[k];
    const v = String(f[k] ?? '').replace(/"/g, '&quot;');
    const attrs = `data-k="${k}"${max ? ` maxlength="${max}"` : ''}${ph ? ` placeholder="${ph}"` : ''}`;
    return `<label>${label}${type === 'textarea'
      ? `<textarea rows="4" ${attrs}>${String(f[k] ?? '').replace(/</g, '&lt;')}</textarea>`
      : `<input type="${type}" ${type === 'number' ? 'min="0" step="1"' : ''} value="${v}" ${attrs}>`}</label>`;
  }).join('');
}

$('#d-fields').addEventListener('input', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const f = ROLLS[roll].frames[sel];
  f[k] = k === 'km' ? Number(e.target.value) || 0 : e.target.value;
  saveFrame(roll, sel);
});

/* ---------- photos ---------- */

async function setPhoto(r, i, file, turns = 0) {
  const { blob, wide } = await preparePhoto(file, turns);
  const key = frameKey(r, i);
  blobs.set(key, blob);
  if (thumbs.has(key)) URL.revokeObjectURL(thumbs.get(key));
  thumbs.delete(key);
  const f = ROLLS[r].frames[i];
  f.wide = wide;
  await saveFrame(r, i, true);
}

async function busy(label, fn) {
  document.body.classList.add('busy');
  say(label);
  try {
    await fn();
  } catch (e) {
    console.error(e);
    say('这张照片读不出来，换一张试试');
    return;
  } finally {
    document.body.classList.remove('busy');
  }
  drawRoll();
}

$('#d-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) busy('处理照片…', () => setPhoto(roll, sel, file));
});
$('#d-photo').addEventListener('click', () => !srcOf(roll, sel) && $('#d-file').click());

$('#d-rotate').addEventListener('click', () => busy('旋转中…', async () => {
  const src = srcOf(roll, sel);
  const file = blobs.get(frameKey(roll, sel)) ?? await (await fetch(src)).blob();
  await setPhoto(roll, sel, file, 1);
}));

$('#d-remove').addEventListener('click', () => busy('移除中…', async () => {
  const key = frameKey(roll, sel);
  blobs.delete(key);
  if (thumbs.has(key)) URL.revokeObjectURL(thumbs.get(key));
  thumbs.delete(key);
  const f = ROLLS[roll].frames[sel];
  f.photo = null;
  f.wide = false;
  await saveFrame(roll, sel, true);
}));

async function fillFrom(files) {
  const imgs = [...files].filter((f) => f.type.startsWith('image/'));
  const R = ROLLS[roll];
  const n = Math.min(imgs.length, R.frames.length - sel);
  await busy(`处理照片 0 / ${n}…`, async () => {
    for (let k = 0; k < n; k++) {
      say(`处理照片 ${k + 1} / ${n}…`);
      await setPhoto(roll, sel + k, imgs[k]);
    }
  });
  if (imgs.length > n) say(`已放入 ${n} 张，后面的格子不够，多出 ${imgs.length - n} 张没放`);
}
$('#bulk').addEventListener('change', (e) => {
  const files = e.target.files;
  if (files.length) fillFrom(files);
  e.target.value = '';
});

// drag photos onto a slot (fills from there) or onto the big preview
for (const zone of [$('#grid'), $('#d-photo')]) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drop');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drop');
    const slot = e.target.closest?.('.ed-slot');
    if (slot) sel = Number(slot.dataset.i);
    if (e.dataTransfer.files.length) fillFrom(e.dataTransfer.files);
  });
}

$('#reset').addEventListener('click', async () => {
  if (!confirm('清空你放进去的所有照片和文字，恢复成示例内容？')) return;
  await clearAll();
  location.reload();
});

drawTabs();
go(tab);
