/*!
 * <open-peeps-creator> — a drop-in Open Peeps (DiceBear) character creator.
 * No build step. No dependencies to install — pulls @dicebear/core +
 * @dicebear/collection from esm.sh at runtime and renders locally.
 *
 * Usage:
 *   <script type="module" src="open-peeps-creator.js"></script>
 *   <open-peeps-creator seed="Riley"></open-peeps-creator>
 *
 * JS API:
 *   const el = document.querySelector('open-peeps-creator');
 *   el.addEventListener('change', e => {
 *     e.detail.svg      // current SVG markup string
 *     e.detail.dataUri  // data:image/svg+xml;... URI
 *     e.detail.options  // the dicebear options object (JSON-serializable, re-creatable later)
 *   });
 *   el.options            // getter — current dicebear options
 *   el.options = {...}    // setter — restore a saved character (partial, from the "state" shape below)
 *   el.svg                // getter — current SVG string
 *   el.dataUri            // getter — current data URI
 *   el.randomize()        // randomize all traits
 *   el.reset()            // reset to defaults
 *
 * Open Peeps art by Pablo Stanley (CC0). DiceBear (MIT) generates the SVGs.
 */

const DICEBEAR_VERSION = '9';
const CORE_URL = `https://esm.sh/@dicebear/core@${DICEBEAR_VERSION}`;
const COLLECTION_URL = `https://esm.sh/@dicebear/collection@${DICEBEAR_VERSION}`;

const HEAD = ["afro","bangs","bangs2","bantuKnots","bear","bun","bun2","buns","cornrows","cornrows2","dreads1","dreads2","flatTop","flatTopLong","grayBun","grayMedium","grayShort","hatBeanie","hatHip","hijab","long","longAfro","longBangs","longCurly","medium1","medium2","medium3","mediumBangs","mediumBangs2","mediumBangs3","mediumStraight","mohawk","mohawk2","noHair1","noHair2","noHair3","pomp","shaved1","shaved2","shaved3","short1","short2","short3","short4","short5","turban","twists","twists2"];
const FACE = ["angryWithFang","awe","blank","calm","cheeky","concerned","concernedFear","contempt","cute","cyclops","driven","eatingHappy","explaining","eyesClosed","fear","hectic","lovingGrin1","lovingGrin2","monster","old","rage","serious","smile","smileBig","smileLOL","smileTeethGap","solemn","suspicious","tired","veryAngry"];
const FACIAL_HAIR = ["chin","full","full2","full3","full4","goatee1","goatee2","moustache1","moustache2","moustache3","moustache4","moustache5","moustache6","moustache7","moustache8","moustache9"];
const ACCESSORIES = ["eyepatch","glasses","glasses2","glasses3","glasses4","glasses5","sunglasses","sunglasses2"];
const MASK = ["medicalMask","respirator"];

const SKIN_COLORS = ["ffdbb4","edb98a","d08b5b","ae5d29","694d3d"];
const HAIR_COLORS = ["2c1b18","e8e1e1","ecdcbf","d6b370","f59797","b58143","a55728","724133","4a312c","c93305"];
const CLOTHING_COLORS = ["e78276","ffcf77","fdea6b","78e185","9ddadb","8fa7df","e279c7"];
const BG_COLORS = ["transparent","ffffff","f1f4dc","d1d4f9","c0aede","b6e3f4","ffd5dc","ffdfbf"];

const DEFAULT_STATE = {
  seed: 'peep',
  head: HEAD[0],
  headContrastColor: HAIR_COLORS[0],
  face: 'smile',
  facialHair: null,
  accessories: null,
  mask: null,
  skinColor: SKIN_COLORS[1],
  clothingColor: CLOTHING_COLORS[5],
  backgroundType: 'solid',
  backgroundColor: BG_COLORS[0],
  backgroundColor2: BG_COLORS[4],
  backgroundRotation: 0,
};

function humanize(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([0-9]+)/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

let dicebearModulesPromise = null;
function loadDicebear() {
  if (!dicebearModulesPromise) {
    dicebearModulesPromise = Promise.all([
      import(/* @vite-ignore */ CORE_URL),
      import(/* @vite-ignore */ COLLECTION_URL),
    ]);
  }
  return dicebearModulesPromise;
}

function buildAvatarOptions(state) {
  return {
    seed: state.seed || 'peep',
    randomizeIds: true,
    head: [state.head],
    headContrastColor: [state.headContrastColor],
    face: [state.face],
    facialHair: [state.facialHair || FACIAL_HAIR[0]],
    facialHairProbability: state.facialHair ? 100 : 0,
    accessories: [state.accessories || ACCESSORIES[0]],
    accessoriesProbability: state.accessories ? 100 : 0,
    mask: [state.mask || MASK[0]],
    maskProbability: state.mask ? 100 : 0,
    skinColor: [state.skinColor],
    clothingColor: [state.clothingColor],
    backgroundType: [state.backgroundType],
    backgroundColor: state.backgroundType === 'gradientLinear'
      ? [state.backgroundColor, state.backgroundColor2]
      : [state.backgroundColor],
    backgroundRotation: [state.backgroundRotation],
  };
}

const STYLE = `
  :host {
    --op-bg: #ffffff;
    --op-fg: #1a1a1a;
    --op-muted: #6b7280;
    --op-border: #e5e7eb;
    --op-panel: #f9fafb;
    --op-accent: #4f46e5;
    --op-accent-fg: #ffffff;
    --op-radius: 10px;
    display: block;
    color: var(--op-fg);
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--op-bg);
  }
  @media (prefers-color-scheme: dark) {
    :host {
      --op-bg: #16181d;
      --op-fg: #f2f2f2;
      --op-muted: #9aa0a6;
      --op-border: #2c2f36;
      --op-panel: #1d2027;
    }
  }
  :host([data-theme="dark"]) {
    --op-bg: #16181d; --op-fg: #f2f2f2; --op-muted: #9aa0a6; --op-border: #2c2f36; --op-panel: #1d2027;
  }
  :host([data-theme="light"]) {
    --op-bg: #ffffff; --op-fg: #1a1a1a; --op-muted: #6b7280; --op-border: #e5e7eb; --op-panel: #f9fafb;
  }
  * { box-sizing: border-box; }
  .wrap { display: grid; grid-template-columns: minmax(220px, 320px) 1fr; gap: 20px; }
  @media (max-width: 640px) { .wrap { grid-template-columns: 1fr; } }
  .preview {
    position: sticky; top: 12px; align-self: start;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    background: var(--op-panel); border: 1px solid var(--op-border); border-radius: var(--op-radius);
    padding: 16px;
  }
  .preview .canvas { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
  .preview .canvas svg { width: 100%; height: 100%; }
  .preview .canvas .loading, .preview .canvas .error { color: var(--op-muted); font-size: 13px; text-align: center; padding: 8px; }
  .preview .error { color: #dc2626; }
  .seed-row { display: flex; gap: 6px; width: 100%; }
  .seed-row input { flex: 1; min-width: 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
  .actions button { flex: 1; }
  button, select, input[type=text] {
    font: inherit; color: var(--op-fg); background: var(--op-bg);
    border: 1px solid var(--op-border); border-radius: 8px; padding: 7px 10px;
  }
  button { cursor: pointer; }
  button:hover { border-color: var(--op-accent); }
  button.primary { background: var(--op-accent); color: var(--op-accent-fg); border-color: var(--op-accent); }
  button.primary:hover { opacity: .9; }
  .panel { display: flex; flex-direction: column; gap: 10px; max-height: 80vh; overflow: auto; padding-right: 4px; }
  details {
    border: 1px solid var(--op-border); border-radius: var(--op-radius); background: var(--op-panel);
    padding: 0 12px;
  }
  summary {
    cursor: pointer; padding: 10px 0; font-weight: 600; list-style: none; display: flex; justify-content: space-between;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: '+'; color: var(--op-muted); }
  details[open] summary::after { content: '−'; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 0; border-top: 1px solid var(--op-border); }
  .row:first-of-type { border-top: none; }
  .row label { min-width: 110px; color: var(--op-muted); font-size: 13px; }
  .row select { flex: 1; min-width: 140px; }
  .row input[type=range] { flex: 1; min-width: 100px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
  .swatch {
    width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--op-border); cursor: pointer; padding: 0;
    background-clip: padding-box;
  }
  .swatch.selected { border-color: var(--op-accent); box-shadow: 0 0 0 2px var(--op-accent) inset; }
  .swatch.transparent { background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0; }
  input[type=color] { width: 30px; height: 26px; padding: 0; border-radius: 6px; border: 1px solid var(--op-border); background: none; }
`;

class OpenPeepsCreator extends HTMLElement {
  static get observedAttributes() { return ['seed']; }

  constructor() {
    super();
    this._state = { ...DEFAULT_STATE };
    this._svg = '';
    this._ready = false;
    this._pendingRender = null;
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const seedAttr = this.getAttribute('seed');
    if (seedAttr) this._state.seed = seedAttr;
    this._buildDOM();
    this._render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'seed' && newVal && this._ready) {
      this._state.seed = newVal;
      this._render();
    }
  }

  get options() { return buildAvatarOptions(this._state); }
  set options(partial) {
    Object.assign(this._state, partial || {});
    this._rebuildBackgroundControls();
    this._render();
    this._syncControlsFromState();
  }

  get svg() { return this._svg; }
  get dataUri() {
    return `data:image/svg+xml;utf8,${encodeURIComponent(this._svg)}`;
  }

  randomize() {
    const s = this._state;
    s.seed = randomSeed();
    s.head = randomOf(HEAD);
    s.headContrastColor = randomOf(HAIR_COLORS);
    s.face = randomOf(FACE);
    s.facialHair = Math.random() < 0.4 ? randomOf(FACIAL_HAIR) : null;
    s.accessories = Math.random() < 0.5 ? randomOf(ACCESSORIES) : null;
    s.mask = Math.random() < 0.15 ? randomOf(MASK) : null;
    s.skinColor = randomOf(SKIN_COLORS);
    s.clothingColor = randomOf(CLOTHING_COLORS);
    const solidColors = BG_COLORS.filter((c) => c !== 'transparent');
    s.backgroundColor = randomOf(solidColors);
    s.backgroundColor2 = randomOf(solidColors);
    this._rebuildBackgroundControls();
    this._render();
    this._syncControlsFromState();
  }

  reset() {
    this._state = { ...DEFAULT_STATE };
    this._rebuildBackgroundControls();
    this._render();
    this._syncControlsFromState();
  }

  _buildDOM() {
    const root = this._shadow;
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
      <div class="preview">
        <div class="canvas"><div class="loading">Loading Open Peeps…</div></div>
        <div class="seed-row">
          <input type="text" class="seed-input" placeholder="Seed / name" value="${this._state.seed}">
          <button class="seed-random" title="Random seed">🎲</button>
        </div>
        <div class="actions">
          <button class="btn-randomize primary">Randomize</button>
          <button class="btn-reset">Reset</button>
        </div>
        <div class="actions">
          <button class="btn-svg">Download SVG</button>
          <button class="btn-png">Download PNG</button>
          <button class="btn-json">Copy JSON</button>
        </div>
      </div>
      <div class="panel">
        ${this._section('Hair', [
          this._selectRow('head', 'Style', HEAD, this._state.head),
          this._swatchRow('headContrastColor', 'Color', HAIR_COLORS, this._state.headContrastColor),
        ])}
        ${this._section('Face', [
          this._selectRow('face', 'Expression', FACE, this._state.face),
        ])}
        ${this._section('Facial Hair', [
          this._selectRow('facialHair', 'Style', FACIAL_HAIR, this._state.facialHair, true),
        ])}
        ${this._section('Accessories', [
          this._selectRow('accessories', 'Item', ACCESSORIES, this._state.accessories, true),
        ])}
        ${this._section('Mask', [
          this._selectRow('mask', 'Style', MASK, this._state.mask, true),
        ])}
        ${this._section('Skin & Clothing', [
          this._swatchRow('skinColor', 'Skin tone', SKIN_COLORS, this._state.skinColor),
          this._swatchRow('clothingColor', 'Clothing', CLOTHING_COLORS, this._state.clothingColor),
        ])}
        ${this._section('Background', [
          this._selectRow('backgroundType', 'Type', ['solid', 'gradientLinear'], this._state.backgroundType, false, { solid: 'Solid', gradientLinear: 'Gradient' }),
          '<div class="bg-color-controls"></div>',
        ])}
      </div>
    `;
    root.appendChild(wrap);
    this._els = {
      canvas: wrap.querySelector('.canvas'),
      seedInput: wrap.querySelector('.seed-input'),
    };
    this._wrap = wrap;
    this._ready = true;
    this._rebuildBackgroundControls();
    this._wireEvents(wrap);
  }

  _backgroundColorControlsHTML() {
    if (this._state.backgroundType === 'gradientLinear') {
      return (
        this._swatchRow('backgroundColor', 'Color 1', BG_COLORS, this._state.backgroundColor) +
        this._swatchRow('backgroundColor2', 'Color 2', BG_COLORS, this._state.backgroundColor2) +
        this._sliderRow('backgroundRotation', 'Rotation', -360, 360, this._state.backgroundRotation)
      );
    }
    return this._swatchRow('backgroundColor', 'Color', BG_COLORS, this._state.backgroundColor);
  }

  _rebuildBackgroundControls() {
    if (!this._ready) return;
    const container = this._wrap.querySelector('.bg-color-controls');
    container.innerHTML = this._backgroundColorControlsHTML();
    this._wireControls(container);
  }

  _section(title, rowsHtml) {
    return `<details open><summary>${title}</summary>${rowsHtml.join('')}</details>`;
  }

  _selectRow(key, label, options, current, allowNone = false, labelMap = null) {
    const opts = allowNone
      ? [`<option value="" ${!current ? 'selected' : ''}>None</option>`].concat(
          options.map((o) => `<option value="${o}" ${current === o ? 'selected' : ''}>${humanize(o)}</option>`)
        )
      : options.map((o) => `<option value="${o}" ${current === o ? 'selected' : ''}>${labelMap ? labelMap[o] : humanize(o)}</option>`);
    return `<div class="row"><label>${label}</label><select data-key="${key}">${opts.join('')}</select></div>`;
  }

  _swatchRow(key, label, colors, current) {
    const swatches = colors
      .map((c) => {
        const isTransparent = c === 'transparent';
        const bg = isTransparent ? '' : `background:#${c};`;
        const sel = current === c ? 'selected' : '';
        const cls = isTransparent ? 'transparent' : '';
        return `<button class="swatch ${sel} ${cls}" style="${bg}" data-key="${key}" data-value="${c}" title="${c}"></button>`;
      })
      .join('');
    const currentHex = current === 'transparent' ? '#ffffff' : `#${current}`;
    return `<div class="row"><label>${label}</label><div class="swatches">${swatches}<input type="color" data-key="${key}" data-custom="1" value="${currentHex}"></div></div>`;
  }

  _sliderRow(key, label, min, max, value) {
    return `<div class="row"><label>${label}</label><input type="range" min="${min}" max="${max}" value="${value}" data-key="${key}"><span class="val" style="min-width:34px;text-align:right;color:var(--op-muted)">${value}</span></div>`;
  }

  _wireControls(container) {
    container.querySelectorAll('select[data-key]').forEach((el) => {
      el.addEventListener('change', () => {
        const key = el.dataset.key;
        const v = el.value === '' ? null : el.value;
        this._state[key] = v;
        if (key === 'backgroundType') this._rebuildBackgroundControls();
        this._render();
      });
    });
    container.querySelectorAll('.swatch[data-key]').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.dataset.key;
        this._state[key] = el.dataset.value;
        this._render();
        this._syncSwatchSelection(container, key, el.dataset.value);
      });
    });
    container.querySelectorAll('input[type=color][data-key]').forEach((el) => {
      el.addEventListener('input', () => {
        const key = el.dataset.key;
        this._state[key] = el.value.replace('#', '');
        this._render();
        this._syncSwatchSelection(container, key, this._state[key]);
      });
    });
    container.querySelectorAll('input[type=range][data-key]').forEach((el) => {
      el.addEventListener('input', () => {
        this._state[el.dataset.key] = Number(el.value);
        el.nextElementSibling.textContent = el.value;
        this._render();
      });
    });
  }

  _wireEvents(wrap) {
    this._wireControls(wrap);
    wrap.querySelector('.seed-input').addEventListener('input', (e) => {
      this._state.seed = e.target.value;
      this._render();
    });
    wrap.querySelector('.seed-random').addEventListener('click', () => {
      this._state.seed = randomSeed();
      wrap.querySelector('.seed-input').value = this._state.seed;
      this._render();
    });
    wrap.querySelector('.btn-randomize').addEventListener('click', () => this.randomize());
    wrap.querySelector('.btn-reset').addEventListener('click', () => this.reset());
    wrap.querySelector('.btn-svg').addEventListener('click', () => this._downloadSVG());
    wrap.querySelector('.btn-png').addEventListener('click', () => this._downloadPNG());
    wrap.querySelector('.btn-json').addEventListener('click', () => this._copyJSON());
  }

  _syncSwatchSelection(wrap, key, value) {
    wrap.querySelectorAll(`.swatch[data-key="${key}"]`).forEach((s) => {
      s.classList.toggle('selected', s.dataset.value === value);
    });
  }

  _syncControlsFromState() {
    const wrap = this._shadow.querySelector('.wrap');
    if (!wrap) return;
    wrap.querySelectorAll('select[data-key]').forEach((el) => {
      const v = this._state[el.dataset.key];
      el.value = v == null ? '' : v;
    });
    wrap.querySelectorAll('.swatch[data-key]').forEach((el) => {
      el.classList.toggle('selected', el.dataset.value === this._state[el.dataset.key]);
    });
    wrap.querySelectorAll('input[type=range][data-key]').forEach((el) => {
      el.value = this._state[el.dataset.key];
      el.nextElementSibling.textContent = el.value;
    });
    const seedInput = wrap.querySelector('.seed-input');
    if (seedInput) seedInput.value = this._state.seed;
  }

  async _render() {
    const token = (this._renderToken = Symbol());
    try {
      const [{ createAvatar }, { openPeeps }] = await loadDicebear();
      if (token !== this._renderToken) return;
      const avatar = createAvatar(openPeeps, buildAvatarOptions(this._state));
      this._svg = avatar.toString();
      this._els.canvas.innerHTML = this._svg;
      this.dispatchEvent(new CustomEvent('change', {
        detail: { svg: this._svg, dataUri: this.dataUri, options: this.options },
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      if (token !== this._renderToken) return;
      this._els.canvas.innerHTML = `<div class="error">Could not load DiceBear from esm.sh.<br>Check your internet connection.</div>`;
      console.error('[open-peeps-creator] render failed:', err);
    }
  }

  _downloadSVG() {
    const blob = new Blob([this._svg], { type: 'image/svg+xml' });
    this._download(URL.createObjectURL(blob), `${this._state.seed || 'peep'}.svg`);
  }

  _downloadPNG(size = 512) {
    const img = new Image();
    const blob = new Blob([this._svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        this._download(URL.createObjectURL(pngBlob), `${this._state.seed || 'peep'}.png`);
      }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  _download(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async _copyJSON() {
    const json = JSON.stringify(this._state, null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      console.log(json);
    }
  }
}

if (!customElements.get('open-peeps-creator')) {
  customElements.define('open-peeps-creator', OpenPeepsCreator);
}

export { OpenPeepsCreator, buildAvatarOptions, DEFAULT_STATE };
